#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
EpsTracked Pass 1: Relevance Filtering
======================================

Processes a JSONL file of email threads and uses Anthropic to score each thread
for relevance to trafficking / exploitation-related content.

Usage:
  python filtering_prompt.py --input sample_1000.json --limit 25 --output calibration_round1.csv
  python filtering_prompt.py --input sample_1000.json --output full_results.csv

Setup:
  pip install anthropic
  export ANTHROPIC_API_KEY="your-key-here"
"""

import argparse
import csv
import json
import os
import re
import sys
import time
import unicodedata
from typing import Any, Dict, List, Optional

import anthropic


# -----------------------------
# Safer stdout for Unicode#
# -----------------------------
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


SYSTEM_PROMPT = """You are an investigative analyst reviewing email threads from the Jeffrey Epstein case files.
Your task is to identify whether an email thread is potentially relevant to human trafficking,
sexual exploitation, or related activity — including communications that discuss, deny, manage,
or reference such activity, even indirectly."""

USER_PROMPT_TEMPLATE = """Read the following email thread and assess its relevance to human trafficking
or related activity in the Epstein network.

Score HIGHER (3–5) for any of the following:
- References to sexual exploitation or abuse (especially of minors)
- Coercion, manipulation, grooming, or recruitment behaviors
- Suspicious financial transactions (unexplained payments or gifts to individuals)
- Transport of individuals across locations, especially with vague or unnamed passengers
- Recruitment of young women/girls for "massage," "modeling," or similar roles
- Coded or evasive language around sensitive activities
- Scheduling or logistics for personal visits with unnamed, vague, or suspiciously described individuals
- References to concealing activities from authorities or managing legal exposure
- Reputation management, denial, or damage control around exploitation allegations
- Communications involving known Epstein network figures (e.g. Ghislaine Maxwell, Nadia Marcinkova,
  Virginia Giuffre, Sarah Kellen, Lesley Groff) discussing visits, travel, or personal arrangements
- References to "the island," "Little St. James," "Palm Beach," or other known Epstein properties
  in a personal or logistical context
- Any discussion of allegations of abuse, even if the writer is denying or rebutting them

Score LOWER (1–2) only when the thread is clearly routine with no connection to the above:
- Purely political commentary or news forwarding with no link to Epstein's personal network
- Purely financial or investment discussion with no suspicious payments or unnamed recipients
- Clearly routine business correspondence (e.g. aircraft maintenance logistics, IT support)
- Journalistic or legal inquiries that are entirely procedural with no substantive content

When in doubt, score 3. False negatives (missing relevant content) are more costly than
false positives (flagging borderline content for human review).

Rate the thread on a 1–5 scale:
1 = Clearly not relevant (routine correspondence, no connection to network activity)
2 = Unlikely relevant (minor ambiguity, probably benign)
3 = Possibly relevant (some suspicious elements or network connections warrant review)
4 = Likely relevant (clear indicators of trafficking-related activity or network coordination)
5 = Highly relevant (explicit references to exploitation, trafficking, abuse, or cover-up)

Respond in JSON format only:
{{
  "score": <1-5>,
  "reasoning": "<1-2 sentence explanation>",
  "indicators": ["<list of specific phrases or elements that influenced your decision>"]
}}

EMAIL THREAD:
Subject: {subject}

{thread_text}
"""


# -----------------------------
# Text cleaning / normalization
# -----------------------------
def clean_text(value: Any) -> str:
    """Convert any input into a safe UTF-8 normalized string."""
    if value is None:
        return ""

    if not isinstance(value, str):
        value = str(value)

    # Normalize Unicode
    value = unicodedata.normalize("NFKC", value)

    # Replace common smart punctuation with plain equivalents
    value = (
        value.replace("\u201c", '"')
             .replace("\u201d", '"')
             .replace("\u2018", "'")
             .replace("\u2019", "'")
             .replace("\u2013", "-")
             .replace("\u2014", "-")
             .replace("\u00a0", " ")
    )

    # Remove null bytes and other dangerous chars
    value = value.replace("\x00", "")

    # Force safe UTF-8 roundtrip
    value = value.encode("utf-8", errors="replace").decode("utf-8", errors="replace")

    return value


def safe_print(*args, sep=" ", end="\n") -> None:
    """Print without crashing on encoding issues."""
    message = sep.join(clean_text(a) for a in args)
    try:
        print(message, end=end)
    except UnicodeEncodeError:
        fallback = message.encode("ascii", errors="replace").decode("ascii")
        print(fallback, end=end)


def normalize_whitespace(text: str) -> str:
    """Clean excessive whitespace while keeping structure readable."""
    text = clean_text(text)

    # Keep line breaks, but reduce excessive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def truncate_text(text: str, max_chars: int = 5000) -> str:
    text = clean_text(text)
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "\n\n[... truncated ...]"


# -----------------------------
# Data loading / parsing
# -----------------------------
def load_threads(input_path: str) -> List[Dict[str, Any]]:
    """Load JSONL file of email threads."""
    threads = []
    with open(input_path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                threads.append(json.loads(line))
            except json.JSONDecodeError as e:
                safe_print(f"Skipping malformed JSON on line {line_num}: {e}")

    safe_print(f"Loaded {len(threads)} email threads from {input_path}")
    return threads


def parse_messages(messages_field: Any) -> List[Dict[str, Any]]:
    """Handle messages stored either as a JSON string or a native list."""
    if isinstance(messages_field, list):
        return messages_field

    if isinstance(messages_field, str):
        try:
            parsed = json.loads(messages_field)
            if isinstance(parsed, list):
                return parsed
        except json.JSONDecodeError:
            return []

    return []


def format_thread(thread: Dict[str, Any]) -> str:
    """Convert one thread into a readable block for the model."""
    messages = parse_messages(thread.get("messages", []))
    parts = []

    for idx, msg in enumerate(messages, start=1):
        sender = clean_text(msg.get("sender", "Unknown"))
        recipients = msg.get("recipients", [])
        timestamp = clean_text(msg.get("timestamp", ""))
        subject = clean_text(msg.get("subject", ""))
        body = normalize_whitespace(msg.get("body", "") or "")

        if isinstance(recipients, list):
            recipients_str = ", ".join(clean_text(r) for r in recipients)
        else:
            recipients_str = clean_text(recipients)

        part = [
            f"Message {idx}",
            f"From: {sender}",
            f"To: {recipients_str}",
            f"Date: {timestamp}",
            f"Subject: {subject}",
            "Body:",
            body if body else "(no body)",
        ]
        parts.append("\n".join(part))

    return "\n\n---\n\n".join(parts).strip()


# -----------------------------
# Model output parsing
# -----------------------------
def strip_code_fences(text: str) -> str:
    """Remove markdown code fences if model wraps JSON in them."""
    text = clean_text(text).strip()

    if not text.startswith("```"):
        return text

    lines = text.splitlines()

    # Remove first fence
    if lines and lines[0].startswith("```"):
        lines = lines[1:]

    # Remove last fence
    if lines and lines[-1].startswith("```"):
        lines = lines[:-1]

    # Remove leading 'json'
    if lines and lines[0].strip().lower() == "json":
        lines = lines[1:]

    return "\n".join(lines).strip()


def extract_json_object(text: str) -> str:
    """
    Extract the first JSON object from the model output.
    Useful if the model adds extra commentary despite instructions.
    """
    text = strip_code_fences(text)

    start = text.find("{")
    end = text.rfind("}")

    if start != -1 and end != -1 and end > start:
        return text[start:end + 1]

    return text


def parse_model_json(raw_text: str) -> Dict[str, Any]:
    """Parse and normalize the model JSON response."""
    raw_text = clean_text(raw_text)
    json_text = extract_json_object(raw_text)
    result = json.loads(json_text)

    if not isinstance(result, dict):
        raise ValueError("Model output was not a JSON object.")

    score = result.get("score", -1)
    reasoning = clean_text(result.get("reasoning", ""))
    indicators = result.get("indicators", [])

    if not isinstance(indicators, list):
        indicators = [clean_text(indicators)]

    try:
        score = int(score)
    except Exception:
        score = -1

    return {
        "score": score,
        "reasoning": reasoning,
        "indicators": [clean_text(x) for x in indicators],
    }


# -----------------------------
# Anthropic API
# -----------------------------
def build_client() -> anthropic.Anthropic:
    """Build Anthropic client and fail fast if API key is missing."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError(
            "ANTHROPIC_API_KEY is not set. Run:\n"
            'export ANTHROPIC_API_KEY="your-key-here"'
        )

    return anthropic.Anthropic(api_key=api_key)


def classify_thread(
    client: anthropic.Anthropic,
    thread: Dict[str, Any],
    model: str,
    max_retries: int = 3,
) -> Dict[str, Any]:
    """Send one email thread to Anthropic and return parsed result."""
    subject = clean_text(thread.get("subject", "(no subject)"))
    thread_text = truncate_text(format_thread(thread), max_chars=5000)

    prompt = USER_PROMPT_TEMPLATE.format(
        subject=clean_text(subject),
        thread_text=clean_text(thread_text),
    )
    prompt = clean_text(prompt)

    last_error: Optional[str] = None

    for attempt in range(1, max_retries + 1):
        try:
            response = client.messages.create(
                model=model,
                max_tokens=350,
                system=clean_text(SYSTEM_PROMPT),
                messages=[
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
            )

            raw_text = ""
            if getattr(response, "content", None):
                # Join all text blocks, not just [0]
                chunks = []
                for block in response.content:
                    text_piece = getattr(block, "text", "")
                    if text_piece:
                        chunks.append(clean_text(text_piece))
                raw_text = "\n".join(chunks).strip()

            parsed = parse_model_json(raw_text)

            usage = getattr(response, "usage", None)
            parsed["input_tokens"] = getattr(usage, "input_tokens", 0) if usage else 0
            parsed["output_tokens"] = getattr(usage, "output_tokens", 0) if usage else 0

            return parsed

        except json.JSONDecodeError as e:
            last_error = f"PARSE_ERROR: {e}"
            safe_print(f"  WARNING attempt {attempt}: JSON parse error: {e}")

        except Exception as e:
            last_error = f"API_ERROR: {clean_text(e)}"
            safe_print(f"  ERROR on attempt {attempt}: {clean_text(e)}")

        if attempt < max_retries:
            time.sleep(2 * attempt)

    return {
        "score": -1,
        "reasoning": last_error or "Unknown error",
        "indicators": [],
        "input_tokens": 0,
        "output_tokens": 0,
    }


# -----------------------------
# Metadata / output
# -----------------------------
def enrich_result(result: Dict[str, Any], thread: Dict[str, Any]) -> Dict[str, Any]:
    """Add useful metadata for CSV review."""
    enriched = dict(result)

    enriched["thread_id"] = clean_text(thread.get("thread_id", ""))
    enriched["subject"] = clean_text(thread.get("subject", "(no subject)"))
    enriched["message_count"] = thread.get("message_count", 0)
    enriched["source_file"] = clean_text(thread.get("source_file", ""))

    messages = parse_messages(thread.get("messages", []))
    if messages:
        first_msg = messages[0]
        enriched["first_sender"] = clean_text(first_msg.get("sender", ""))

        recipients = first_msg.get("recipients", [])
        if isinstance(recipients, list):
            enriched["first_recipients"] = ", ".join(clean_text(r) for r in recipients)
        else:
            enriched["first_recipients"] = clean_text(recipients)

        body_preview = clean_text(first_msg.get("body", "") or "").replace("\n", " ")
        enriched["body_preview"] = body_preview[:180]
    else:
        enriched["first_sender"] = ""
        enriched["first_recipients"] = ""
        enriched["body_preview"] = ""

    # Full thread text for human annotation
    enriched["full_thread_text"] = truncate_text(format_thread(thread), max_chars=4000)
    # Blank columns for annotators to fill in
    enriched["human_label"] = ""
    enriched["human_notes"] = ""

    return enriched


def save_results(output_csv: str, results: List[Dict[str, Any]]) -> None:
    fieldnames = [
        "thread_id",
        "subject",
        "score",
        "reasoning",
        "indicators",
        "human_label",
        "human_notes",
        "first_sender",
        "first_recipients",
        "message_count",
        "body_preview",
        "full_thread_text",
        "source_file",
        "input_tokens",
        "output_tokens",
    ]

    with open(output_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()

        for row in results:
            out = dict(row)
            out["indicators"] = "; ".join(clean_text(x) for x in row.get("indicators", []))
            writer.writerow(out)


def summarize_results(results: List[Dict[str, Any]], output_csv: str) -> None:
    scores = [r["score"] for r in results if isinstance(r.get("score"), int) and r["score"] > 0]
    relevant = [s for s in scores if s >= 3]

    total_input = sum(r.get("input_tokens", 0) for r in results)
    total_output = sum(r.get("output_tokens", 0) for r in results)

    # Placeholder estimates; update if you want exact current pricing logic
    cost_in = total_input / 1_000_000 * 1.0
    cost_out = total_output / 1_000_000 * 5.0

    safe_print("\n" + "=" * 60)
    safe_print("RESULTS SUMMARY")
    safe_print("=" * 60)
    safe_print(f"Total threads processed: {len(scores)}")

    pct = (len(relevant) / len(scores) * 100) if scores else 0
    safe_print(f"Relevant (score >= 3):  {len(relevant)} ({pct:.0f}%)")

    distribution = {s: scores.count(s) for s in sorted(set(scores))}
    safe_print(f"Score distribution:     {distribution}")
    safe_print(f"Total tokens:           {total_input:,} in / {total_output:,} out")
    safe_print(f"Estimated cost:         ${cost_in + cost_out:.4f}")
    safe_print(f"Results saved to:       {output_csv}")
    safe_print()
    safe_print("NEXT STEPS:")
    safe_print(f"  1. Open {output_csv}")
    safe_print("  2. Add a column called human_label (1=relevant, 0=not)")
    safe_print("  3. Fill in your labels")
    safe_print(f"  4. Compare model vs human labels")


# -----------------------------
# Main pipeline
# -----------------------------
def run_filtering(
    input_path: str,
    output_csv: str,
    model: str,
    limit: Optional[int] = None,
    sleep_sec: float = 0.3,
) -> None:
    client = build_client()
    threads = load_threads(input_path)

    if limit is not None:
        threads = threads[:limit]
        safe_print(f"Limiting to first {limit} threads (calibration mode)")

    results = []

    for i, thread in enumerate(threads, start=1):
        subject = clean_text(thread.get("subject", "(no subject)"))
        safe_print(f"[{i}/{len(threads)}] {subject[:50]:50s}", end="  ")

        result = classify_thread(client, thread, model=model)
        enriched = enrich_result(result, thread)
        results.append(enriched)

        score = enriched.get("score", -1)
        reasoning_preview = clean_text(enriched.get("reasoning", ""))[:90]
        safe_print(f"Score: {score}  |  {reasoning_preview}")

        if sleep_sec > 0:
            time.sleep(sleep_sec)

    save_results(output_csv, results)
    summarize_results(results, output_csv)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="EpsTracked Pass 1: Relevance Filtering")
    parser.add_argument("--input", required=True, help="Path to input JSONL file")
    parser.add_argument("--output", default="relevance_results.csv", help="Path to output CSV")
    parser.add_argument("--model", default="claude-haiku-4-5-20251001", help="Anthropic model name")
    parser.add_argument("--limit", type=int, default=None, help="Only process first N threads")
    parser.add_argument("--sleep", type=float, default=0.3, help="Seconds to sleep between requests")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    run_filtering(
        input_path=args.input,
        output_csv=args.output,
        model=args.model,
        limit=args.limit,
        sleep_sec=args.sleep,
    )