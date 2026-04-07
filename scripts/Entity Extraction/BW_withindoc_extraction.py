"""
BW: Within-Document Structured Extraction
"""

import json
import os
import re
import sqlite3
import sys
import time
import unicodedata
from datetime import datetime
from typing import Any, Optional

import anthropic
from dotenv import load_dotenv

load_dotenv()

# Configurations
ANALYSIS_MODEL = "claude-haiku-4-5-20251001"
MAX_TOKENS     = 8192
SLEEP_BETWEEN  = 0.3   # seconds between API calls

SAMPLE_JSON    = "/Users/bradywestergren/PycharmProjects/EpsTracked/scripts/data/sample_1000.json"   # path to your sampled JSONL
DB_PATH        = "bw_withindoc_extraction.db"
TARGET_IDS = [
    "IMAGES-010-HOUSE_OVERSIGHT_029224.txt_14243",
    "IMAGES-006-HOUSE_OVERSIGHT_021811.txt_24585",
    "IMAGES-011-HOUSE_OVERSIGHT_030525.txt_8512",
    "TEXT-001-HOUSE_OVERSIGHT_030589.txt_46",
    "TEXT-001-HOUSE_OVERSIGHT_031079.txt_2423",
]


# TEXT UTILITIES

def clean_text(value: Any) -> str:
    if value is None:
        return ""
    if not isinstance(value, str):
        value = str(value)
    value = unicodedata.normalize("NFKC", value)
    value = (value.replace("\u201c", '"').replace("\u201d", '"')
                  .replace("\u2018", "'").replace("\u2019", "'")
                  .replace("\u2013", "-").replace("\u2014", "-")
                  .replace("\u00a0", " ").replace("\x00", ""))
    return value.encode("utf-8", errors="replace").decode("utf-8", errors="replace")


def normalize_whitespace(text: str) -> str:
    text = clean_text(text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def parse_messages(messages_field: Any) -> list:
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


def format_thread(thread: dict) -> str:
    """Convert one thread dict into a readable block for the model."""
    messages = parse_messages(thread.get("messages", []))
    parts = []
    for idx, msg in enumerate(messages, start=1):
        sender     = clean_text(msg.get("sender", "Unknown"))
        recipients = msg.get("recipients", [])
        timestamp  = clean_text(msg.get("timestamp", ""))
        subject    = clean_text(msg.get("subject", ""))
        body       = normalize_whitespace(msg.get("body", "") or "")

        if isinstance(recipients, list):
            recipients_str = ", ".join(clean_text(r) for r in recipients)
        else:
            recipients_str = clean_text(recipients)

        part = "\n".join([
            f"Message {idx}",
            f"From: {sender}",
            f"To: {recipients_str}",
            f"Date: {timestamp}",
            f"Subject: {subject}",
            "Body:",
            body if body else "(no body)",
        ])
        parts.append(part)

    return "\n\n---\n\n".join(parts).strip()


def get_doc_date(thread: dict) -> Optional[str]:
    """Pull timestamp from the first message as the document date."""
    messages = parse_messages(thread.get("messages", []))
    if messages:
        return clean_text(messages[0].get("timestamp", "")) or None
    return None


# PROMPT

WITHIN_DOC_PROMPT = """You are an analyst specializing in human trafficking investigations. You have been given the text of an email thread from the Jeffrey Epstein document corpus released under the Epstein Files Transparency Act.

Your task is to perform comprehensive structured extraction of ALL information in this document. You must return a single valid JSON object — no markdown, no explanation, no preamble, no trailing text. ONLY the JSON object.

IDENTITY RESOLUTION RULES (apply throughout)
The following identifiers ALL refer to Jeffrey Epstein. Whenever you encounter any of them as a sender, recipient, actor, or reference, resolve to "Jeffrey Epstein":
  - jeeitunes@gmail.com
  - e:jeeitunes@gmail.com
  - jee
  - jeffrey
  - epstein
  - j.epstein

Use CANONICAL FULL NAMES throughout (e.g., "Ghislaine Maxwell", not "Ghislaine" or "Maxwell").
Use CONSISTENT naming throughout the entire response.

OUTPUT SCHEMA:
{{
  "doc_id": "{doc_id}",
  "document_date": "<ISO 8601 date of this email if determinable, else null>",
  "one_sentence_summary": "<one sentence naming main actors and core action>",
  "paragraph_summary": "<3-5 sentences: who is involved, what happened, what it implies, trafficking-relevant significance>",

  "entities": [
    {{
      "name": "<canonical full name>",
      "type": "<PERSON | ORGANIZATION | LOCATION>",
      "role_in_document": "<e.g. email sender, referenced victim, travel destination>",
      "aliases_in_document": ["<every name variant used for this entity in this document>"],
      "coref_mentions": [
        {{
          "mention_text": "<exact text span, e.g. he, the girl, her assistant>",
          "context_snippet": "<5-10 surrounding words>",
          "confidence": "<high | medium | low>"
        }}
      ],
      "trafficking_relevant": <true | false>,
      "trafficking_relevance_note": "<brief note if true, else null>"
    }}
  ],

  "events": [
    {{
      "sequence_order": <integer starting at 0>,
      "actor": "<canonical person name — never an org or abstraction>",
      "recipient": "<canonical name or null>",
      "event_description": "<specific description — quote or closely paraphrase the text. Never reduce to vague summaries like 'sent email'>",
      "date_normalized": "<ISO 8601: YYYY-MM-DD | YYYY-MM | YYYY | YYYY/YYYY | null>",
      "date_raw": "<original date string from document, or null>",
      "date_resolution_method": "<absolute | relative_to_doc_date | fuzzy_range | unresolvable>",
      "location": "<place name if mentioned, else null>",
      "event_type": "<communication | meeting | travel | financial_transaction | recruitment | coercion | exploitation | legal_action | scheduling | social_event | other>",
      "trafficking_flag": <true | false>,
      "trafficking_indicators": ["<specific indicators if flagged — empty list if false>"],
      "triple_tags": ["<2-4 snake_case tags>"],
      "explicit_topic": "<3-7 words: what this event is directly about>",
      "implicit_topic": "<3-7 words: what this event likely implies>"
    }}
  ],

  "coref_chains": [
    {{
      "canonical_entity": "<resolved canonical name>",
      "mentions": [
        {{
          "mention_text": "<exact text from document>",
          "mention_type": "<full_name | partial_name | pronoun | definite_description | title | alias>",
          "context_snippet": "<surrounding 5-10 word context>",
          "confidence": "<high | medium | low>"
        }}
      ]
    }}
  ],

  "temporal_expressions": [
    {{
      "raw_expression": "<exact date/time string from document>",
      "normalized": "<ISO 8601 value or range>",
      "type": "<absolute | relative | fuzzy | duration | recurring>",
      "resolved_against": "<doc_date | prior_event | unresolvable>",
      "context_snippet": "<surrounding 5-10 word context>"
    }}
  ],

  "unknown_persons": [
    {{
      "placeholder_id": "<e.g. unknown_person_A, unnamed_young_woman_1>",
      "description": "<all descriptive details from document>",
      "inferred_role": "<victim | witness | recruiter | associate | staff | unknown>",
      "inferred_role_confidence": "<high | medium | low>",
      "trafficking_relevant": <true | false>
    }}
  ]
}}

INSTRUCTIONS:

ENTITIES — List every named person, org, and location. For each PERSON, populate coref_mentions with every pronoun and definite description that refers to them. Mark trafficking_relevant true for any entity implicated in exploitation, coercion, transport, recruitment, or suspicious financial activity.

EVENTS — Extract EVERY discrete action. event_description must be SPECIFIC.
  BAD: "Jeffrey Epstein sent an email."
  GOOD: "Jeffrey Epstein emailed Ghislaine Maxwell instructing her to arrange for two young women to be flown from New York to Palm Beach on Saturday morning."
Set trafficking_flag true if any of the following appear:
  - References to minors in non-familial contexts
  - Scheduling massage or similar services with unnamed persons
  - Transport of unnamed/young/female persons with no stated purpose
  - Unusual financial transfers with vague descriptions
  - Requests for personal info (age, appearance, origin) about unnamed individuals
  - References to girls, young women, models in scheduling/travel contexts
  - Language suggesting coercion, dependency, or control
Use unknown_persons for unnamed individuals; reference them by placeholder_id in events.

COREF CHAINS — Consolidate ALL mentions of each entity into unified chains.

TEMPORAL EXPRESSIONS — Capture every date/time/duration. Normalize relative expressions against document_date: {doc_date}. For fuzzy expressions use year ranges (e.g. 1990/1993).

UNKNOWN PERSONS — Use for any unnamed, redacted, or described-but-not-named individual.

DOCUMENT DATE: {doc_date}
DOCUMENT ID: {doc_id}

EMAIL THREAD:
{thread_text}

OUTPUT (valid JSON object only — no markdown, no explanation):"""

# DATABASE

def init_database(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            doc_id TEXT UNIQUE NOT NULL,
            full_text TEXT,
            document_date TEXT,
            one_sentence_summary TEXT,
            paragraph_summary TEXT,
            analysis_timestamp TEXT,
            input_tokens INTEGER,
            output_tokens INTEGER,
            error TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_docs_doc_id ON documents(doc_id);

        CREATE TABLE IF NOT EXISTS extracted_entities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            doc_id TEXT NOT NULL,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            role_in_document TEXT,
            aliases_in_document TEXT,
            coref_mentions TEXT,
            trafficking_relevant INTEGER DEFAULT 0,
            trafficking_relevance_note TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (doc_id) REFERENCES documents(doc_id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_ent_doc_id ON extracted_entities(doc_id);
        CREATE INDEX IF NOT EXISTS idx_ent_name ON extracted_entities(name);

        CREATE TABLE IF NOT EXISTS extracted_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            doc_id TEXT NOT NULL,
            sequence_order INTEGER,
            actor TEXT,
            recipient TEXT,
            event_description TEXT,
            date_normalized TEXT,
            date_raw TEXT,
            date_resolution_method TEXT,
            location TEXT,
            event_type TEXT,
            trafficking_flag INTEGER DEFAULT 0,
            trafficking_indicators TEXT,
            triple_tags TEXT,
            explicit_topic TEXT,
            implicit_topic TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (doc_id) REFERENCES documents(doc_id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_ev_doc_id ON extracted_events(doc_id);
        CREATE INDEX IF NOT EXISTS idx_ev_actor ON extracted_events(actor);
        CREATE INDEX IF NOT EXISTS idx_ev_trafficking ON extracted_events(trafficking_flag);

        CREATE TABLE IF NOT EXISTS coref_chains (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            doc_id TEXT NOT NULL,
            canonical_entity TEXT NOT NULL,
            mentions TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (doc_id) REFERENCES documents(doc_id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_coref_doc_id ON coref_chains(doc_id);

        CREATE TABLE IF NOT EXISTS temporal_expressions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            doc_id TEXT NOT NULL,
            raw_expression TEXT,
            normalized TEXT,
            type TEXT,
            resolved_against TEXT,
            context_snippet TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (doc_id) REFERENCES documents(doc_id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_temp_doc_id ON temporal_expressions(doc_id);

        CREATE TABLE IF NOT EXISTS unknown_persons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            doc_id TEXT NOT NULL,
            placeholder_id TEXT NOT NULL,
            description TEXT,
            inferred_role TEXT,
            inferred_role_confidence TEXT,
            trafficking_relevant INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (doc_id) REFERENCES documents(doc_id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_unk_doc_id ON unknown_persons(doc_id);
    """)
    conn.commit()
    print(f"✓ Database initialized at: {db_path}\n")
    return conn


def save_to_database(conn: sqlite3.Connection, result: dict):
    a      = result["analysis"]
    doc_id = result["doc_id"]
    c      = conn.cursor()

    c.execute("""
        INSERT OR REPLACE INTO documents
        (doc_id, full_text, document_date, one_sentence_summary, paragraph_summary,
         analysis_timestamp, input_tokens, output_tokens, error)
        VALUES (?,?,?,?,?,?,?,?,?)
    """, (
        doc_id, result["full_text"], a.get("document_date"),
        a.get("one_sentence_summary"), a.get("paragraph_summary"),
        result["extracted_at"], result["input_tokens"], result["output_tokens"],
        result["error"]
    ))

    for ent in a.get("entities", []):
        if not ent.get("name"):
            continue
        c.execute("""
            INSERT INTO extracted_entities
            (doc_id, name, type, role_in_document, aliases_in_document,
             coref_mentions, trafficking_relevant, trafficking_relevance_note)
            VALUES (?,?,?,?,?,?,?,?)
        """, (
            doc_id, ent["name"], ent.get("type", "PERSON"),
            ent.get("role_in_document"),
            json.dumps(ent.get("aliases_in_document", [])),
            json.dumps(ent.get("coref_mentions", [])),
            1 if ent.get("trafficking_relevant") else 0,
            ent.get("trafficking_relevance_note")
        ))

    for i, ev in enumerate(a.get("events", [])):
        if not ev.get("actor"):
            print(f"  ⚠️  Skipping malformed event (no actor) in {doc_id}")
            continue
        c.execute("""
            INSERT INTO extracted_events
            (doc_id, sequence_order, actor, recipient, event_description,
             date_normalized, date_raw, date_resolution_method, location,
             event_type, trafficking_flag, trafficking_indicators,
             triple_tags, explicit_topic, implicit_topic)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            doc_id, ev.get("sequence_order", i),
            ev["actor"], ev.get("recipient"),
            ev.get("event_description"),
            ev.get("date_normalized"), ev.get("date_raw"),
            ev.get("date_resolution_method"),
            ev.get("location"), ev.get("event_type"),
            1 if ev.get("trafficking_flag") else 0,
            json.dumps(ev.get("trafficking_indicators", [])),
            json.dumps(ev.get("triple_tags", [])),
            ev.get("explicit_topic"), ev.get("implicit_topic")
        ))

    for chain in a.get("coref_chains", []):
        if not chain.get("canonical_entity"):
            continue
        c.execute("""
            INSERT INTO coref_chains (doc_id, canonical_entity, mentions)
            VALUES (?,?,?)
        """, (doc_id, chain["canonical_entity"], json.dumps(chain.get("mentions", []))))

    for te in a.get("temporal_expressions", []):
        c.execute("""
            INSERT INTO temporal_expressions
            (doc_id, raw_expression, normalized, type, resolved_against, context_snippet)
            VALUES (?,?,?,?,?,?)
        """, (
            doc_id, te.get("raw_expression"), te.get("normalized"),
            te.get("type"), te.get("resolved_against"), te.get("context_snippet")
        ))

    for up in a.get("unknown_persons", []):
        c.execute("""
            INSERT INTO unknown_persons
            (doc_id, placeholder_id, description, inferred_role,
             inferred_role_confidence, trafficking_relevant)
            VALUES (?,?,?,?,?,?)
        """, (
            doc_id, up.get("placeholder_id"), up.get("description"),
            up.get("inferred_role"), up.get("inferred_role_confidence"),
            1 if up.get("trafficking_relevant") else 0
        ))

    conn.commit()


# EXTRACTION

def repair_json(client: anthropic.Anthropic, raw_text: str, doc_id: str) -> Optional[dict]:
    repair_prompt = (
        "The following JSON has a syntax error. Fix ONLY the syntax — do not change "
        "any content values. Return ONLY the corrected JSON object with no explanation.\n\n"
        + raw_text
    )
    try:
        msg = client.messages.create(
            model=ANALYSIS_MODEL,
            max_tokens=MAX_TOKENS,
            messages=[{"role": "user", "content": repair_prompt}]
        )
        repaired = msg.content[0].text.strip()
        repaired = re.sub(r'^```(?:json)?\s*', '', repaired)
        repaired = re.sub(r'\s*```$', '', repaired)
        parsed = json.loads(repaired)
        print(f"  ✓ JSON repaired for {doc_id}")
        return parsed
    except Exception as e:
        print(f"  ❌ Repair failed for {doc_id}: {e}")
        return None


def error_result(doc_id: str, full_text: str, error: str) -> dict:
    return {
        "doc_id": doc_id,
        "full_text": full_text,
        "analysis": {
            "doc_id": doc_id,
            "one_sentence_summary": "Error during analysis",
            "paragraph_summary": "",
            "entities": [], "events": [],
            "coref_chains": [], "temporal_expressions": [], "unknown_persons": []
        },
        "input_tokens": 0, "output_tokens": 0,
        "extracted_at": datetime.utcnow().isoformat(),
        "error": error
    }


def extract_thread(client: anthropic.Anthropic, thread: dict) -> dict:
    doc_id      = clean_text(thread.get("thread_id", "unknown"))
    thread_text = format_thread(thread)
    doc_date    = get_doc_date(thread)
    subject     = clean_text(thread.get("subject", "(no subject)"))

    print(f"  Analyzing [{doc_id}] {subject[:60]}")

    prompt = WITHIN_DOC_PROMPT.format(
        doc_id=doc_id,
        thread_text=thread_text,
        doc_date=doc_date if doc_date else "unknown — infer from document content if possible"
    )

    try:
        message = client.messages.create(
            model=ANALYSIS_MODEL,
            max_tokens=MAX_TOKENS,
            messages=[{"role": "user", "content": prompt}]
        )
    except Exception as e:
        print(f"  ❌ API error for {doc_id}: {e}")
        return error_result(doc_id, thread_text, str(e))

    raw = message.content[0].text.strip()
    raw = re.sub(r'^```(?:json)?\s*', '', raw)
    raw = re.sub(r'\s*```$', '', raw)

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        print(f"  ⚠️  JSON parse failed for {doc_id}, attempting repair...")
        parsed = repair_json(client, raw, doc_id)
        if parsed is None:
            return error_result(doc_id, thread_text, "JSON parse error — repair failed")

    parsed["doc_id"] = doc_id

    return {
        "doc_id": doc_id,
        "full_text": thread_text,
        "analysis": parsed,
        "input_tokens": message.usage.input_tokens,
        "output_tokens": message.usage.output_tokens,
        "extracted_at": datetime.utcnow().isoformat(),
        "error": None
    }


# MAIN

def main():
    print("\n=== EpsTracked — Pass 2: Within-Document Extraction ===\n")

    client = anthropic.Anthropic(api_key="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")
    conn   = init_database(DB_PATH)

    # ── Load JSONL and index by thread_id ─────────────────────────────────
    print(f"Loading threads from {SAMPLE_JSON}...")
    threads_by_id = {}
    with open(SAMPLE_JSON, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                thread = json.loads(line)
                tid = clean_text(thread.get("thread_id", ""))
                if tid:
                    threads_by_id[tid] = thread
            except json.JSONDecodeError:
                continue

    print(f"Total threads in file : {len(threads_by_id)}")

    # ── Match TARGET_IDS ──────────────────────────────────────────────────
    found   = [tid for tid in TARGET_IDS if tid in threads_by_id]
    missing = [tid for tid in TARGET_IDS if tid not in threads_by_id]

    if missing:
        print(f"⚠️  thread_id(s) not found in file: {missing}")

    already_done = {r[0] for r in conn.execute("SELECT doc_id FROM documents").fetchall()}
    to_process   = [tid for tid in found if tid not in already_done]
    skipped      = [tid for tid in found if tid in already_done]

    if skipped:
        print(f"Skipping already processed: {skipped}")

    print(f"Running extraction on {len(to_process)} thread(s)...\n")

    # ── Process ───────────────────────────────────────────────────────────
    total_input  = 0
    total_output = 0
    errors       = []

    for tid in to_process:
        thread = threads_by_id[tid]
        result = extract_thread(client, thread)

        if result["error"]:
            errors.append((tid, result["error"]))

        save_to_database(conn, result)

        n_events  = len(result["analysis"].get("events", []))
        n_flagged = sum(1 for e in result["analysis"].get("events", []) if e.get("trafficking_flag"))
        n_ents    = len(result["analysis"].get("entities", []))
        n_coref   = len(result["analysis"].get("coref_chains", []))

        total_input  += result["input_tokens"]
        total_output += result["output_tokens"]

        print(f"  ✓ {tid}: {n_events} events ({n_flagged} flagged) | "
              f"{n_ents} entities | {n_coref} coref chains")

        time.sleep(SLEEP_BETWEEN)

    # ── Summary ───────────────────────────────────────────────────────────
    estimated_cost = (total_input / 1_000_000 * 0.80) + (total_output / 1_000_000 * 4.00)
    print(f"\n=== Done ===")
    print(f"Processed      : {len(to_process)}")
    print(f"Errors         : {len(errors)}")
    print(f"Input tokens   : {total_input:,}")
    print(f"Output tokens  : {total_output:,}")
    print(f"Estimated cost : ${estimated_cost:.4f}")
    print(f"Database       : {DB_PATH}")

    if errors:
        print("\nErrors:")
        for tid, msg in errors:
            print(f"  {tid}: {msg}")

    conn.close()


if __name__ == "__main__":
    main()