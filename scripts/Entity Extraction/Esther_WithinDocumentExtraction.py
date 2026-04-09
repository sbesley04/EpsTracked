#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
EpsTracked Pass 2: Within-Document Structured Extraction
=========================================================

For each document that passes the Pass 1 relevance filter, performs a single
LLM call to extract:
  §3.3.1  Named entities  (PERSON / ORGANIZATION / LOCATION) with aliases
  §3.3.2  Events          (actor, recipient, event, date, location, trafficking_flag)
  §3.3.3  Temporal        (ISO 8601 normalisation, fuzzy ranges, relative resolution)
  §3.3.4  Co-references   (pronoun → canonical entity, with confidence)

Usage:
  # Run on all documents that scored >= 3 in Pass 1
  python Esther_WithinDocumentExtraction.py --input relevance_results.csv --output Esther_pass2_results.jsonl

  # Calibration run — first 5 rows only
  python Esther_WithinDocumentExtraction.py --input relevance_results.csv --limit 5 --output Esther_calibration_pass2.jsonl

  # Override model or score threshold
  python Esther_WithinDocumentExtraction.py --input relevance_results.csv --min-score 4 --model claude-sonnet-4-20250514

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


# ──────────────────────────────────────────────────────────────────────────────
# Safer stdout  (copied from filtering_prompt.py)
# ──────────────────────────────────────────────────────────────────────────────
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


# ──────────────────────────────────────────────────────────────────────────────
# Text helpers  (identical to filtering_prompt.py)
# ──────────────────────────────────────────────────────────────────────────────

def clean_text(value: Any) -> str:
    """Convert any input into a safe UTF-8 normalised string."""
    if value is None:
        return ""
    if not isinstance(value, str):
        value = str(value)
    value = unicodedata.normalize("NFKC", value)
    value = (
        value.replace("\u201c", '"').replace("\u201d", '"')
             .replace("\u2018", "'").replace("\u2019", "'")
             .replace("\u2013", "-").replace("\u2014", "-")
             .replace("\u00a0", " ")
    )
    value = value.replace("\x00", "")
    value = value.encode("utf-8", errors="replace").decode("utf-8", errors="replace")
    return value


def safe_print(*args, sep=" ", end="\n") -> None:
    message = sep.join(clean_text(a) for a in args)
    try:
        print(message, end=end)
    except UnicodeEncodeError:
        fallback = message.encode("ascii", errors="replace").decode("ascii")
        print(fallback, end=end)


def normalize_whitespace(text: str) -> str:
    text = clean_text(text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def truncate_text(text: str, max_chars: int = 8000) -> str:
    text = clean_text(text)
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "\n\n[... truncated ...]"


def strip_code_fences(text: str) -> str:
    text = clean_text(text).strip()
    if not text.startswith("```"):
        return text
    lines = text.splitlines()
    if lines and lines[0].startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].startswith("```"):
        lines = lines[:-1]
    if lines and lines[0].strip().lower() == "json":
        lines = lines[1:]
    return "\n".join(lines).strip()


def extract_json_object(text: str) -> str:
    text = strip_code_fences(text)
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return text[start:end + 1]
    return text


# ──────────────────────────────────────────────────────────────────────────────
# Prompts
# ──────────────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a forensic information-extraction engine specialising in legal and
investigative documents. You always respond with a single, valid JSON object and nothing else.
You never add markdown code fences or explanatory text outside the JSON."""

_SCHEMA_SNIPPET = """{
  "entities": [
    {
      "canonical_name": "string — most fully-specified name",
      "type": "PERSON | ORGANIZATION | LOCATION",
      "aliases": ["all other surface forms seen in the document"],
      "span_start": <int | null>,
      "span_end":   <int | null>
    }
  ],
  "events": [
    {
      "actor":            "canonical_name of entity who initiated the action",
      "recipient":        "canonical_name | null",
      "event":            "third-person description, ≤2 sentences, zero pronouns",
      "date": {
        "iso":         "YYYY-MM-DD | YYYY-MM | YYYY | null",
        "range_start": "YYYY-MM-DD | null",
        "range_end":   "YYYY-MM-DD | null",
        "precision":   "exact | month | year | decade | range | relative | unknown",
        "raw_text":    "original date string from document"
      },
      "location":         "canonical_name of location entity | null",
      "trafficking_flag": true | false,
      "source_quote":     "verbatim excerpt ≤60 chars that grounds this event | null"
    }
  ],
  "coreference_mappings": [
    {
      "mention":      "pronoun or definite description as it appears in text",
      "resolved_to":  "canonical_name from entities list",
      "confidence":   "high | medium | low"
    }
  ],
  "all_dates": [
    /* same shape as event.date — every distinct date in the document, de-duplicated */
  ],
  "extraction_notes": "free-text notes about ambiguous cases | null"
}"""


def build_user_prompt(doc_text: str, doc_date: Optional[str] = None) -> str:
    anchor_clause = (
        f"The document creation date is **{doc_date}**. "
        "Use this to resolve relative temporal expressions "
        "(e.g. 'three days later', 'last Tuesday')."
        if doc_date
        else (
            "The document creation date is unknown. "
            "Mark unresolvable relative dates with precision='relative'."
        )
    )

    return f"""Read the document below and return a single JSON object conforming exactly to the
schema provided. No markdown, no commentary — JSON only.

{anchor_clause}

━━━━━━━━━━━━━━━━━━━━━━━━━━━ EXTRACTION RULES ━━━━━━━━━━━━━━━━━━━━━━━━━━━

§1  ENTITY EXTRACTION
• Identify every named entity: persons, organisations, and locations.
• Assign exactly one type: "PERSON", "ORGANIZATION", or "LOCATION".
• Use the most fully-specified name (e.g. "Jeffrey Epstein", not "Epstein")
  as canonical_name.
• Collect ALL surface forms (nicknames, abbreviations, mis-spellings) in aliases.
• Populate span_start / span_end (character offsets) for the first mention
  when you can determine them; otherwise set both to null.

§2  EVENT EXTRACTION
• Extract every distinct action or event described.
• actor and recipient must be canonical_names from the entities list.
• Write event in third-person, ≤ 2 sentences, with NO pronouns — use
  canonical names throughout.
• Populate date using the normalisation rules in §3.
• trafficking_flag = true if the event involves any of:
    - sexual exploitation, grooming, abuse, or coercion
    - financial inducements related to sexual activity
    - recruitment or transport of persons for exploitation
    - coordination, concealment, or cover-up of the above
• source_quote: verbatim excerpt (≤ 60 characters) from the document that
  directly grounds this event; null if none applies.

§3  TEMPORAL NORMALISATION
Normalise every date reference in the document (inside events AND standalone):
• Absolute dates  → "YYYY-MM-DD" (precision "exact"), "YYYY-MM" (precision
  "month"), "YYYY" (precision "year").
• Fuzzy ranges ("the 1980s", "early 1990s") → precision "decade" or "range";
  populate range_start and range_end as ISO dates.
• Relative dates ("three days later", "yesterday") → resolve against the
  document creation date when provided; otherwise set precision to "relative".
• Collect every distinct date in all_dates (de-duplicated).

§4  CO-REFERENCE RESOLUTION
• Resolve every pronoun and definite description to its referent entity.
• Add one entry per mapping to coreference_mappings.
• confidence: "high" = unambiguous, "medium" = likely, "low" = best guess.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━ OUTPUT SCHEMA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{_SCHEMA_SNIPPET}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━ DOCUMENT TEXT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{doc_text}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return ONLY the JSON object."""


# ──────────────────────────────────────────────────────────────────────────────
# Anthropic client  (same pattern as filtering_prompt.py)
# ──────────────────────────────────────────────────────────────────────────────

def build_client() -> anthropic.Anthropic:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError(
            "ANTHROPIC_API_KEY is not set. Run:\n"
            'export ANTHROPIC_API_KEY="your-key-here"'
        )
    return anthropic.Anthropic(api_key=api_key)


def extract_document(
    client: anthropic.Anthropic,
    doc_text: str,
    doc_id: str,
    doc_date: Optional[str],
    model: str,
    max_retries: int = 3,
) -> Dict[str, Any]:
    """
    Send one document to the model and return a parsed extraction dict.
    Mirrors the retry / error-handling structure of classify_thread().
    """
    prompt = build_user_prompt(
        truncate_text(normalize_whitespace(doc_text), max_chars=8000),
        doc_date=doc_date,
    )
    prompt = clean_text(prompt)

    last_error: Optional[str] = None

    for attempt in range(1, max_retries + 1):
        try:
            response = client.messages.create(
                model=model,
                max_tokens=4096,
                system=clean_text(SYSTEM_PROMPT),
                messages=[{"role": "user", "content": prompt}],
            )

            # Collect all text blocks (same pattern as filtering_prompt.py)
            chunks = []
            for block in getattr(response, "content", []):
                text_piece = getattr(block, "text", "")
                if text_piece:
                    chunks.append(clean_text(text_piece))
            raw_text = "\n".join(chunks).strip()

            json_text = extract_json_object(raw_text)
            payload = json.loads(json_text)

            if not isinstance(payload, dict):
                raise ValueError("Model output was not a JSON object.")

            # Attach token usage metadata
            usage = getattr(response, "usage", None)
            payload["doc_id"] = doc_id
            payload["input_tokens"] = getattr(usage, "input_tokens", 0) if usage else 0
            payload["output_tokens"] = getattr(usage, "output_tokens", 0) if usage else 0
            payload["error"] = None

            # Ensure required top-level keys exist so downstream code never KeyErrors
            for key in ("entities", "events", "coreference_mappings", "all_dates"):
                if key not in payload or not isinstance(payload[key], list):
                    payload[key] = []
            if "extraction_notes" not in payload:
                payload["extraction_notes"] = None

            return payload

        except json.JSONDecodeError as e:
            last_error = f"PARSE_ERROR: {e}"
            safe_print(f"  WARNING attempt {attempt}: JSON parse error: {e}")

        except Exception as e:
            last_error = f"API_ERROR: {clean_text(str(e))}"
            safe_print(f"  ERROR on attempt {attempt}: {clean_text(str(e))}")

        if attempt < max_retries:
            time.sleep(2 * attempt)

    # All retries exhausted — return error sentinel with same shape
    return {
        "doc_id": doc_id,
        "entities": [],
        "events": [],
        "coreference_mappings": [],
        "all_dates": [],
        "extraction_notes": None,
        "input_tokens": 0,
        "output_tokens": 0,
        "error": last_error or "Unknown error",
    }


# ──────────────────────────────────────────────────────────────────────────────
# I/O helpers
# ──────────────────────────────────────────────────────────────────────────────

def load_pass1_csv(input_path: str, min_score: int) -> List[Dict[str, Any]]:
    """
    Load the Pass 1 CSV produced by filtering_prompt.py and return only the
    rows whose score >= min_score.

    Expects at minimum these columns (as written by save_results()):
      thread_id, score, full_thread_text
    Optional: source_file
    """
    rows = []
    with open(input_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                score = int(row.get("score", -1))
            except (ValueError, TypeError):
                score = -1
            if score >= min_score:
                rows.append(row)

    safe_print(
        f"Loaded {len(rows)} documents with score >= {min_score} from {input_path}"
    )
    return rows


def save_jsonl(output_path: str, results: List[Dict[str, Any]]) -> None:
    """Write one JSON object per line (JSONL) — same format as the existing pipeline."""
    with open(output_path, "w", encoding="utf-8") as f:
        for record in results:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")


def summarize(results: List[Dict[str, Any]], output_path: str) -> None:
    ok = [r for r in results if not r.get("error")]
    errors = [r for r in results if r.get("error")]

    total_in = sum(r.get("input_tokens", 0) for r in results)
    total_out = sum(r.get("output_tokens", 0) for r in results)

    # Sonnet pricing — update if pricing changes
    cost = total_in / 1_000_000 * 3.0 + total_out / 1_000_000 * 15.0

    total_entities = sum(len(r.get("entities", [])) for r in ok)
    total_events = sum(len(r.get("events", [])) for r in ok)
    total_flagged = sum(
        sum(1 for e in r.get("events", []) if e.get("trafficking_flag"))
        for r in ok
    )
    total_corefs = sum(len(r.get("coreference_mappings", [])) for r in ok)

    safe_print("\n" + "=" * 60)
    safe_print("PASS 2 SUMMARY")
    safe_print("=" * 60)
    safe_print(f"Documents processed:      {len(results)}")
    safe_print(f"  Successful:             {len(ok)}")
    safe_print(f"  Errors:                 {len(errors)}")
    safe_print(f"Entities extracted:       {total_entities}")
    safe_print(f"Events extracted:         {total_events}")
    safe_print(f"  Trafficking-flagged:    {total_flagged}")
    safe_print(f"Co-reference mappings:    {total_corefs}")
    safe_print(f"Total tokens:             {total_in:,} in / {total_out:,} out")
    safe_print(f"Estimated cost:           ${cost:.4f}")
    safe_print(f"Results saved to:         {output_path}")
    safe_print()
    safe_print("NEXT STEPS:")
    safe_print(f"  1. Inspect {output_path} (one JSON object per line)")
    safe_print("  2. Run entity deduplication (dedupe_with_llm.ts or equivalent)")
    safe_print("  3. Load events into SQLite for graph construction")


# ──────────────────────────────────────────────────────────────────────────────
# Main pipeline
# ──────────────────────────────────────────────────────────────────────────────

def run_extraction(
    input_path: str,
    output_path: str,
    model: str,
    min_score: int = 3,
    limit: Optional[int] = None,
    sleep_sec: float = 0.3,
) -> None:
    client = build_client()
    rows = load_pass1_csv(input_path, min_score=min_score)

    if limit is not None:
        rows = rows[:limit]
        safe_print(f"Limiting to first {limit} documents (calibration mode)")

    results = []

    for i, row in enumerate(rows, start=1):
        doc_id = clean_text(row.get("thread_id", f"row-{i}"))
        subject = clean_text(row.get("subject", "(no subject)"))
        doc_text = clean_text(row.get("full_thread_text", ""))

        # Pass 1 CSV doesn't store a parsed creation date; extend here if your
        # schema adds one (e.g. row.get("earliest_date")).
        doc_date: Optional[str] = None

        safe_print(f"[{i}/{len(rows)}] {subject[:50]:50s}", end="  ")

        result = extract_document(
            client,
            doc_text=doc_text,
            doc_id=doc_id,
            doc_date=doc_date,
            model=model,
        )

        # Carry forward Pass 1 metadata for traceability
        result["pass1_score"] = row.get("score", "")
        result["subject"] = subject
        result["source_file"] = clean_text(row.get("source_file", ""))

        results.append(result)

        n_entities = len(result.get("entities", []))
        n_events = len(result.get("events", []))
        n_flagged = sum(1 for e in result.get("events", []) if e.get("trafficking_flag"))
        err = result.get("error")

        if err:
            safe_print(f"ERROR: {err[:80]}")
        else:
            safe_print(
                f"entities={n_entities}  events={n_events}  flagged={n_flagged}"
            )

        if sleep_sec > 0:
            time.sleep(sleep_sec)

    save_jsonl(output_path, results)
    summarize(results, output_path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="EpsTracked Pass 2: Within-Document Structured Extraction"
    )
    parser.add_argument(
        "--input", required=True,
        help="Path to Pass 1 CSV output (from filtering_prompt.py)"
    )
    parser.add_argument(
        "--output", default="pass2_results.jsonl",
        help="Path to output JSONL file (default: pass2_results.jsonl)"
    )
    parser.add_argument(
        "--model", default="claude-sonnet-4-20250514",
        help="Anthropic model name (default: claude-sonnet-4-20250514)"
    )
    parser.add_argument(
        "--min-score", type=int, default=3,
        help="Only process documents with Pass 1 score >= this value (default: 3)"
    )
    parser.add_argument(
        "--limit", type=int, default=None,
        help="Only process first N documents (calibration mode)"
    )
    parser.add_argument(
        "--sleep", type=float, default=0.3,
        help="Seconds to sleep between requests (default: 0.3)"
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    run_extraction(
        input_path=args.input,
        output_path=args.output,
        model=args.model,
        min_score=args.min_score,
        limit=args.limit,
        sleep_sec=args.sleep,
    )