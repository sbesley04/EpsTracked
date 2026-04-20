#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
EpsTracked Pass 2: Multi-Stage Entity & Event Extraction
=========================================================

4-stage pipeline per email thread:
  Stage 1 — Entity extraction + intra-document coreference resolution
             (handles "Epstein" / "JE" / "he" / email addresses, etc.)
  Stage 2 — Event extraction: structured records for every
             Epstein ↔ {other entity} interaction
  Stage 3 — Temporal & location normalization (ISO 8601)
  Stage 4 — Trafficking flag + confidence score per event

Inter-document entity linking:
  A persistent entity_registry.json maps canonical names → unique IDs
  (ENT_000001 = Jeffrey Epstein, always).  Running the script multiple
  times merges new aliases into existing entries.

Usage:
  python entity_extraction.py --input /path/to/filtered_relevant.csv --limit 10
  python entity_extraction.py --input /path/to/filtered_relevant.csv --output extraction_results.csv

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
from typing import Any, Dict, List, Optional, Tuple

import anthropic


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
EPSTEIN_ID        = "ENT_000001"
EPSTEIN_CANONICAL = "Jeffrey Epstein"

# All known surface forms of Epstein (used for registry seeding & Stage-1 hints)
EPSTEIN_SEEDS = [
    "jeffrey epstein", "jeffery epstein", "jeffrey e.", "jeffery e.",
    "jeff epstein", "j. epstein", "j epstein", "epstein",
    "jee", "je", "jeevacation@gmail.com", "jeeitunes@gmail.com",
]

ENTITY_REGISTRY_FILE = "entity_registry.json"


# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    if not isinstance(value, str):
        value = str(value)
    value = unicodedata.normalize("NFKC", value)
    value = (
        value.replace("\u201c", '"').replace("\u201d", '"')
             .replace("\u2018", "'").replace("\u2019", "'")
             .replace("\u2013", "-").replace("\u2014", "-")
             .replace("\u00a0", " ").replace("\x00", "")
    )
    return value.encode("utf-8", errors="replace").decode("utf-8", errors="replace")


def safe_print(*args, sep=" ", end="\n") -> None:
    msg = sep.join(clean_text(a) for a in args)
    try:
        print(msg, end=end, flush=True)
    except UnicodeEncodeError:
        print(msg.encode("ascii", errors="replace").decode("ascii"), end=end, flush=True)


def truncate_text(text: str, max_chars: int = 6000) -> str:
    text = clean_text(text)
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "\n\n[... truncated ...]"


def extract_first_date(thread_text: str) -> str:
    """Pull the first 'Date: ...' line from a formatted thread for Stage-3 anchoring."""
    m = re.search(r"Date:\s*(.+)", thread_text)
    return m.group(1).strip() if m else "unknown"


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


def parse_model_json(raw: str) -> Any:
    raw = clean_text(raw)
    text = strip_code_fences(raw)
    start = text.find("{")
    end   = text.rfind("}")
    if start != -1 and end > start:
        text = text[start:end + 1]
    return json.loads(text)


# ---------------------------------------------------------------------------
# Entity Registry  (inter-document entity linking)
# ---------------------------------------------------------------------------
class EntityRegistry:
    """
    Persists across runs.  Maps canonical_name (lowercased) → entity_id.
    Jeffrey Epstein is always ENT_000001.
    """

    def __init__(self, path: str = ENTITY_REGISTRY_FILE):
        self.path         = path
        self.name_to_id:  Dict[str, str]        = {}
        self.id_to_info:  Dict[str, Dict]        = {}
        self._next_id = 2
        self._load()

    # ------------------------------------------------------------------
    def _load(self):
        if os.path.exists(self.path):
            with open(self.path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self.name_to_id = data.get("name_to_id", {})
            self.id_to_info = data.get("id_to_info", {})
            nums = [int(v.replace("ENT_", ""))
                    for v in self.id_to_info if v.startswith("ENT_")]
            self._next_id = max(nums, default=1) + 1
        else:
            # Seed Epstein
            self._register(EPSTEIN_CANONICAL, "PERSON", EPSTEIN_SEEDS,
                            force_id=EPSTEIN_ID)

    def save(self):
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump({"name_to_id": self.name_to_id,
                       "id_to_info": self.id_to_info}, f, indent=2)

    # ------------------------------------------------------------------
    def _register(self, canonical: str, etype: str, aliases: List[str],
                  force_id: Optional[str] = None) -> str:
        key = canonical.lower().strip()
        if key in self.name_to_id:
            eid = self.name_to_id[key]
            self._merge_aliases(eid, aliases)
            return eid

        eid = force_id if force_id else f"ENT_{self._next_id:06d}"
        if not force_id:
            self._next_id += 1

        self.name_to_id[key] = eid
        self.id_to_info[eid] = {
            "canonical_name": canonical,
            "type": etype,
            "aliases": list({a.lower().strip() for a in aliases} | {key}),
        }
        for alias in aliases:
            ak = alias.lower().strip()
            if ak and ak not in self.name_to_id:
                self.name_to_id[ak] = eid
        return eid

    def _merge_aliases(self, eid: str, aliases: List[str]):
        existing = set(self.id_to_info[eid].get("aliases", []))
        for a in aliases:
            ak = a.lower().strip()
            existing.add(ak)
            if ak not in self.name_to_id:
                self.name_to_id[ak] = eid
        self.id_to_info[eid]["aliases"] = list(existing)

    # ------------------------------------------------------------------
    def get_or_create(self, canonical: str, etype: str,
                      aliases: List[str]) -> str:
        """Return entity ID, creating + indexing a new entry if needed."""
        # Check canonical + all aliases against existing index
        for surface in [canonical] + aliases:
            key = surface.lower().strip()
            if key in self.name_to_id:
                eid = self.name_to_id[key]
                self._merge_aliases(eid, [canonical] + aliases)
                return eid
        return self._register(canonical, etype, aliases)

    def lookup(self, name: str) -> Optional[str]:
        return self.name_to_id.get(name.lower().strip())


# ---------------------------------------------------------------------------
# Anthropic API wrapper
# ---------------------------------------------------------------------------
def build_client() -> anthropic.Anthropic:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError(
            "ANTHROPIC_API_KEY is not set.\n"
            'Run: export ANTHROPIC_API_KEY="your-key-here"'
        )
    return anthropic.Anthropic(api_key=api_key)


def call_api(
    client: anthropic.Anthropic,
    system: str,
    user: str,
    model: str,
    max_tokens: int = 1500,
    max_retries: int = 3,
) -> Tuple[Any, int, int]:
    """Returns (parsed_json, input_tokens, output_tokens)."""
    last_error = None
    for attempt in range(1, max_retries + 1):
        try:
            response = client.messages.create(
                model=model,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
            raw = "".join(
                getattr(b, "text", "") for b in response.content
            ).strip()
            parsed = parse_model_json(raw)
            usage  = getattr(response, "usage", None)
            inp    = getattr(usage, "input_tokens",  0) if usage else 0
            out    = getattr(usage, "output_tokens", 0) if usage else 0
            return parsed, inp, out
        except json.JSONDecodeError as e:
            last_error = f"JSON parse error: {e}"
        except Exception as e:
            last_error = f"API error: {clean_text(str(e))}"
        safe_print(f"      attempt {attempt} failed: {last_error}")
        if attempt < max_retries:
            time.sleep(2 * attempt)
    raise RuntimeError(f"All {max_retries} attempts failed: {last_error}")


# ---------------------------------------------------------------------------
# Stage prompts
# ---------------------------------------------------------------------------
STAGE1_SYSTEM = (
    "You are an expert NLP analyst specializing in named entity recognition and "
    "intra-document coreference resolution for investigative legal documents."
)

STAGE1_USER = """\
Analyze the following email thread. Identify all named entities and resolve all \
intra-document co-references.

RULES:
1. Jeffrey Epstein is the ANCHOR entity. Treat ALL of the following as him:
   "Jeffrey Epstein", "Jeffery Epstein", "Jeffrey E.", "Jeffery E.", "Jeff Epstein",
   "Epstein", "JE", "jee", "jeevacation@gmail.com", "jeeitunes@gmail.com",
   and any pronoun (he/him/his) that refers to him.
2. For every OTHER named entity, record their CANONICAL FULL NAME
   (e.g. "Ghislaine Maxwell", NOT just "Ghislaine" or "Maxwell").
3. Resolve ALL pronouns and definite descriptions to their referent entity
   (e.g. "she" → "Ghislaine Maxwell").
4. List EVERY surface form the entity appears as in this document under "aliases"
   (including pronouns that are clearly resolved, nicknames, email addresses, titles).
5. Only include PERSON or ORGANIZATION entities that appear in relation to Epstein.
6. Do NOT include locations here.

Respond with ONLY valid JSON (no markdown):
{{
  "epstein_aliases_found": ["list every surface form of Epstein seen in this document"],
  "entities": [
    {{
      "canonical_name": "Full Name",
      "type": "PERSON" or "ORGANIZATION",
      "aliases": ["every surface form found in text"],
      "coref_confidence": "high" | "medium" | "low"
    }}
  ]
}}

EMAIL THREAD:
Subject: {subject}

{thread_text}"""

# ---------------------------------------------------------------------------
STAGE2_SYSTEM = (
    "You are an expert investigative analyst extracting structured events from "
    "Epstein case emails. Focus on interactions between Jeffrey Epstein and other entities."
)

STAGE2_USER = """\
Extract all events/interactions between Jeffrey Epstein and the entities listed below \
from the email thread.

IDENTIFIED ENTITIES (non-Epstein):
{entity_list}

An EVENT is any: communication, meeting, arrangement, transaction, request, \
transportation, payment, or activity linking Epstein to another entity.

For each event use actor = who initiated / drove the action; \
recipient = who was targeted / affected.

Respond with ONLY valid JSON (no markdown):
{{
  "events": [
    {{
      "event_id": "EVT_001",
      "actor":              "canonical name",
      "actor_entity_id":   "ENT_XXXXXX or null",
      "recipient":          "canonical name",
      "recipient_entity_id":"ENT_XXXXXX or null",
      "description":        "2-3 concrete sentences; cite exact phrases",
      "quoted_evidence":    "most relevant direct quote from the email",
      "raw_date_string":    "exact date text from email, or null",
      "raw_location_string":"exact location text from email, or null"
    }}
  ]
}}

EMAIL THREAD:
Subject: {subject}

{thread_text}"""

# ---------------------------------------------------------------------------
STAGE3_SYSTEM = (
    "You are a temporal and geographic information extraction specialist working on "
    "Epstein case documents."
)

STAGE3_USER = """\
Normalize the date and location for each event below.

Email thread first-message date (use as anchor for relative expressions): {email_date}

EVENTS:
{events_json}

Date normalization rules:
- Absolute date  → "YYYY-MM-DD"
- Date range     → {{"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}}
- Decade/era     → {{"start": "YYYY-01-01", "end": "YYYY-12-31"}}
- Relative date  → resolve against the anchor date above, then output "YYYY-MM-DD"
- Truly unknown  → null

Location normalization: "City, Country" or "Venue, City" or null.

Respond with ONLY valid JSON (no markdown):
{{
  "normalized_events": [
    {{
      "event_id":           "EVT_001",
      "date_normalized":    "YYYY-MM-DD" or {{...}} or null,
      "date_confidence":    "exact" | "approximate" | "inferred" | "unknown",
      "location_normalized":"City, Country" or null,
      "location_confidence":"explicit" | "inferred" | "unknown"
    }}
  ]
}}"""

# ---------------------------------------------------------------------------
STAGE4_SYSTEM = (
    "You are a human trafficking analyst reviewing Epstein case emails. "
    "You surface potential indicators for investigative review — you are NOT making "
    "legal determinations or accusations."
)

STAGE4_USER = """\
Review each event and assess whether it contains human trafficking indicators.

Indicators to look for:
- Procurement / recruitment of individuals (especially unnamed "girls", "women", minors)
- Sexual services disguised as "massage", "modeling", "entertainment"
- Suspicious payments or gifts involving persons
- Transport or logistics for unnamed/vaguely described individuals
- Coercion, control, grooming, or manipulation language
- Secrecy, coded language, or instructions to conceal
- References to "young", underage, or anonymous individuals
- Scheduling of visits/meetings with unnamed or suspicious participants

EVENTS:
{events_json}

Respond with ONLY valid JSON (no markdown):
{{
  "flagged_events": [
    {{
      "event_id":             "EVT_001",
      "trafficking_flag":     true or false,
      "confidence":           0.0 to 1.0,
      "trafficking_indicators": ["specific phrases / patterns that triggered the flag"],
      "flag_reasoning":       "1-2 sentence explanation"
    }}
  ]
}}"""


# ---------------------------------------------------------------------------
# QC helper
# ---------------------------------------------------------------------------
def qc_checkpoint(stage_name: str, display_data: Any) -> str:
    """
    Print stage output and prompt the user for a decision.

    Returns:
      "ok"   – accept and continue to next stage
      "skip" – mark this thread as skipped, move to next thread
      "abort"– stop the entire run immediately
    """
    sep = "-" * 60
    safe_print(f"\n{sep}")
    safe_print(f"  QC CHECKPOINT — {stage_name}")
    safe_print(sep)
    safe_print(json.dumps(display_data, indent=2, ensure_ascii=False))
    safe_print(sep)
    safe_print("  [ok] accept  |  [skip] skip this thread  |  [abort] stop run")

    while True:
        try:
            answer = input("  Your choice (ok/skip/abort): ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            answer = "abort"
        if answer in ("ok", "o", ""):
            return "ok"
        if answer in ("skip", "s"):
            return "skip"
        if answer in ("abort", "a", "q"):
            return "abort"
        safe_print("  Please type ok, skip, or abort.")


# ---------------------------------------------------------------------------
# Per-thread pipeline
# ---------------------------------------------------------------------------
def extract_thread(
    client:   anthropic.Anthropic,
    thread:   Dict[str, Any],
    registry: EntityRegistry,
    model:    str,
    qc:       bool = False,
) -> Dict[str, Any]:
    thread_id   = clean_text(thread.get("thread_id", ""))
    subject     = clean_text(thread.get("subject",   "(no subject)"))
    thread_text = truncate_text(clean_text(thread.get("full_thread_text", "")))
    email_date  = extract_first_date(thread_text)

    total_in = total_out = 0
    result: Dict[str, Any] = {
        "thread_id": thread_id,
        "subject":   subject,
        "stage1": None, "stage2": None, "stage3": None, "stage4": None,
        "error": None,
    }

    # ── Stage 1: Entity extraction + coreference ────────────────────────
    safe_print("  S1 entities...", end=" ")
    try:
        s1, inp, out = call_api(
            client,
            STAGE1_SYSTEM,
            STAGE1_USER.format(subject=subject, thread_text=thread_text),
            model=model, max_tokens=1200,
        )
        total_in += inp; total_out += out

        enriched_entities: List[Dict] = []
        for ent in s1.get("entities", []):
            canonical = clean_text(ent.get("canonical_name", "")).strip()
            if not canonical:
                continue
            etype   = clean_text(ent.get("type", "PERSON"))
            aliases = [clean_text(a) for a in ent.get("aliases", []) if a]
            eid     = registry.get_or_create(canonical, etype, aliases)
            enriched_entities.append({
                "canonical_name":    canonical,
                "entity_id":         eid,
                "type":              etype,
                "aliases":           aliases,
                "coref_confidence":  ent.get("coref_confidence", "medium"),
            })

        s1["entities"]          = enriched_entities
        s1["epstein_entity_id"] = EPSTEIN_ID
        result["stage1"]        = s1
        safe_print(f"OK ({len(enriched_entities)} entities)")

        if qc:
            qc_display = {
                "epstein_aliases_found": s1.get("epstein_aliases_found", []),
                "entities": [
                    {"canonical_name": e["canonical_name"],
                     "entity_id":      e["entity_id"],
                     "type":           e["type"],
                     "aliases":        e["aliases"],
                     "coref_confidence": e["coref_confidence"]}
                    for e in enriched_entities
                ],
            }
            decision = qc_checkpoint("Stage 1 — Entities & Coreference", qc_display)
            if decision == "skip":
                result["error"] = "skipped by QC"
                return {**result, "total_input_tokens": total_in,
                        "total_output_tokens": total_out}
            if decision == "abort":
                raise KeyboardInterrupt("Aborted by QC")
    except Exception as e:
        result["error"] = f"Stage1: {e}"
        safe_print(f"FAILED: {e}")
        return {**result,
                "total_input_tokens": total_in,
                "total_output_tokens": total_out}

    # Build lookup: canonical_name (lower) → entity_id, for Stage-2 gap-fill
    entity_id_map: Dict[str, str] = {EPSTEIN_CANONICAL.lower(): EPSTEIN_ID}
    for e in enriched_entities:
        entity_id_map[e["canonical_name"].lower()] = e["entity_id"]
        for a in e.get("aliases", []):
            if a:
                entity_id_map[a.lower()] = e["entity_id"]

    entity_list_str = "\n".join(
        f"  - {e['canonical_name']}  (ID: {e['entity_id']}, type: {e['type']})"
        for e in enriched_entities
    ) or "  (none identified beyond Epstein)"

    # ── Stage 2: Event extraction ────────────────────────────────────────
    safe_print("  S2 events...",  end=" ")
    try:
        s2, inp, out = call_api(
            client,
            STAGE2_SYSTEM,
            STAGE2_USER.format(
                entity_list=entity_list_str,
                subject=subject,
                thread_text=thread_text,
            ),
            model=model, max_tokens=2000,
        )
        total_in += inp; total_out += out

        events: List[Dict] = s2.get("events", [])
        # Gap-fill entity IDs where model left them null
        for ev in events:
            for role in ("actor", "recipient"):
                if not ev.get(f"{role}_entity_id"):
                    name = clean_text(ev.get(role, "")).lower().strip()
                    ev[f"{role}_entity_id"] = entity_id_map.get(name)

        result["stage2"] = {"events": events}
        safe_print(f"OK ({len(events)} events)")

        if qc and events:
            qc_display = {
                "event_count": len(events),
                "events": [
                    {"event_id":   ev.get("event_id"),
                     "actor":      ev.get("actor"),
                     "recipient":  ev.get("recipient"),
                     "description": ev.get("description"),
                     "quoted_evidence": ev.get("quoted_evidence")}
                    for ev in events
                ],
            }
            decision = qc_checkpoint("Stage 2 — Events", qc_display)
            if decision == "skip":
                result["error"] = "skipped by QC"
                return {**result, "total_input_tokens": total_in,
                        "total_output_tokens": total_out}
            if decision == "abort":
                raise KeyboardInterrupt("Aborted by QC")
    except Exception as e:
        result["error"] = f"Stage2: {e}"
        safe_print(f"FAILED: {e}")
        return {**result,
                "total_input_tokens": total_in,
                "total_output_tokens": total_out}

    if not events:
        result["stage3"] = {"normalized_events": []}
        result["stage4"] = {"flagged_events":    []}
        return {**result,
                "total_input_tokens": total_in,
                "total_output_tokens": total_out}

    events_json = json.dumps({"events": events}, indent=2, ensure_ascii=False)

    # ── Stage 3: Temporal + location normalization ───────────────────────
    safe_print("  S3 time/loc...", end=" ")
    try:
        s3, inp, out = call_api(
            client,
            STAGE3_SYSTEM,
            STAGE3_USER.format(email_date=email_date, events_json=events_json),
            model=model, max_tokens=1000,
        )
        total_in += inp; total_out += out
        result["stage3"] = s3
        safe_print(f"OK ({len(s3.get('normalized_events', []))} normalized)")

        if qc:
            decision = qc_checkpoint("Stage 3 — Dates & Locations",
                                     s3.get("normalized_events", []))
            if decision == "skip":
                result["error"] = "skipped by QC"
                return {**result, "total_input_tokens": total_in,
                        "total_output_tokens": total_out}
            if decision == "abort":
                raise KeyboardInterrupt("Aborted by QC")
    except Exception as e:
        result["error"] = f"Stage3: {e}"
        safe_print(f"FAILED: {e}")
        result["stage3"] = {"normalized_events": []}

    # ── Stage 4: Trafficking flag ────────────────────────────────────────
    safe_print("  S4 flag...",    end=" ")
    try:
        s4, inp, out = call_api(
            client,
            STAGE4_SYSTEM,
            STAGE4_USER.format(events_json=events_json),
            model=model, max_tokens=1500,
        )
        total_in += inp; total_out += out
        result["stage4"] = s4
        flagged = sum(1 for fe in s4.get("flagged_events", [])
                      if fe.get("trafficking_flag"))
        safe_print(f"OK ({flagged}/{len(events)} flagged)")

        if qc:
            qc_display = {
                "flagged_events": [
                    {"event_id":               fe.get("event_id"),
                     "trafficking_flag":        fe.get("trafficking_flag"),
                     "confidence":              fe.get("confidence"),
                     "trafficking_indicators":  fe.get("trafficking_indicators"),
                     "flag_reasoning":          fe.get("flag_reasoning")}
                    for fe in s4.get("flagged_events", [])
                ],
            }
            decision = qc_checkpoint("Stage 4 — Trafficking Flags", qc_display)
            if decision == "skip":
                result["error"] = "skipped by QC"
                return {**result, "total_input_tokens": total_in,
                        "total_output_tokens": total_out}
            if decision == "abort":
                raise KeyboardInterrupt("Aborted by QC")
    except Exception as e:
        result["error"] = f"Stage4: {e}"
        safe_print(f"FAILED: {e}")
        result["stage4"] = {"flagged_events": []}

    result["total_input_tokens"]  = total_in
    result["total_output_tokens"] = total_out
    return result


# ---------------------------------------------------------------------------
# Output: flatten to one row per event
# ---------------------------------------------------------------------------
def flatten_results(results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    rows = []
    for r in results:
        thread_id = r["thread_id"]
        subject   = r["subject"]

        s1 = r.get("stage1") or {}
        s2 = r.get("stage2") or {}
        s3 = r.get("stage3") or {}
        s4 = r.get("stage4") or {}

        events   = s2.get("events", [])
        norm_map = {n["event_id"]: n for n in s3.get("normalized_events", [])}
        flag_map = {f["event_id"]: f for f in s4.get("flagged_events",    [])}

        entities_str = "; ".join(
            f"{e['canonical_name']} ({e['entity_id']})"
            for e in s1.get("entities", [])
        )

        # One row per event; if no events produce a single summary row
        if not events:
            rows.append({
                "thread_id": thread_id, "subject": subject,
                "entities_found": entities_str,
                "event_id": "", "actor": "", "actor_entity_id": "",
                "recipient": "", "recipient_entity_id": "",
                "event_description": "", "quoted_evidence": "",
                "date_normalized": "", "date_confidence": "",
                "location_normalized": "", "location_confidence": "",
                "trafficking_flag": "", "trafficking_confidence": "",
                "trafficking_indicators": "", "flag_reasoning": "",
                "error": r.get("error", ""),
                "total_input_tokens":  r.get("total_input_tokens",  0),
                "total_output_tokens": r.get("total_output_tokens", 0),
            })
            continue

        for ev in events:
            eid  = ev.get("event_id", "")
            norm = norm_map.get(eid, {})
            flag = flag_map.get(eid, {})

            date_val = norm.get("date_normalized")
            if isinstance(date_val, dict):
                date_str = f"{date_val.get('start','')} to {date_val.get('end','')}"
            else:
                date_str = date_val or ""

            rows.append({
                "thread_id":            thread_id,
                "subject":              subject,
                "entities_found":       entities_str,
                "event_id":             eid,
                "actor":                clean_text(ev.get("actor", "")),
                "actor_entity_id":      clean_text(str(ev.get("actor_entity_id") or "")),
                "recipient":            clean_text(ev.get("recipient", "")),
                "recipient_entity_id":  clean_text(str(ev.get("recipient_entity_id") or "")),
                "event_description":    clean_text(ev.get("description", "")),
                "quoted_evidence":      clean_text(ev.get("quoted_evidence", "")),
                "date_normalized":      date_str,
                "date_confidence":      clean_text(norm.get("date_confidence", "")),
                "location_normalized":  clean_text(str(norm.get("location_normalized") or "")),
                "location_confidence":  clean_text(norm.get("location_confidence", "")),
                "trafficking_flag":     str(flag.get("trafficking_flag", "")),
                "trafficking_confidence": str(flag.get("confidence", "")),
                "trafficking_indicators": "; ".join(
                    clean_text(x) for x in flag.get("trafficking_indicators", [])
                ),
                "flag_reasoning":       clean_text(flag.get("flag_reasoning", "")),
                "error":                r.get("error", ""),
                "total_input_tokens":   r.get("total_input_tokens",  0),
                "total_output_tokens":  r.get("total_output_tokens", 0),
            })
    return rows


def save_csv(path: str, rows: List[Dict[str, Any]]) -> None:
    if not rows:
        safe_print("No rows to save.")
        return
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()),
                                extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def save_jsonl(path: str, results: List[Dict[str, Any]]) -> None:
    with open(path, "w", encoding="utf-8") as f:
        for r in results:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def summarize(results: List[Dict[str, Any]]) -> None:
    total_events   = sum(len((r.get("stage2") or {}).get("events", []))
                         for r in results)
    total_flagged  = sum(
        sum(1 for fe in (r.get("stage4") or {}).get("flagged_events", [])
            if fe.get("trafficking_flag"))
        for r in results
    )
    total_in  = sum(r.get("total_input_tokens",  0) for r in results)
    total_out = sum(r.get("total_output_tokens", 0) for r in results)
    cost = total_in / 1_000_000 * 1.0 + total_out / 1_000_000 * 5.0

    safe_print("\n" + "=" * 60)
    safe_print("EXTRACTION SUMMARY")
    safe_print("=" * 60)
    safe_print(f"Threads processed : {len(results)}")
    safe_print(f"Total events      : {total_events}")
    pct = (total_flagged / total_events * 100) if total_events else 0
    safe_print(f"Trafficking flags : {total_flagged} ({pct:.0f}%)")
    safe_print(f"Total tokens      : {total_in:,} in / {total_out:,} out")
    safe_print(f"Estimated cost    : ${cost:.4f}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def load_filtered_csv(path: str) -> List[Dict[str, Any]]:
    with open(path, "r", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    safe_print(f"Loaded {len(rows)} threads from {path}")
    return rows


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="EpsTracked Pass 2: Multi-Stage Entity & Event Extraction"
    )
    p.add_argument("--input",  required=True,
                   help="Path to filtered_relevant.csv")
    p.add_argument("--output", default="extraction_results.csv",
                   help="Flat CSV output (one row per event)")
    p.add_argument("--jsonl",  default="extraction_results.jsonl",
                   help="Raw JSONL output (full nested structure)")
    p.add_argument("--registry", default=ENTITY_REGISTRY_FILE,
                   help="Entity registry JSON (inter-document linking)")
    p.add_argument("--model",  default="claude-haiku-4-5",
                   help="Anthropic model ID")
    p.add_argument("--limit",  type=int, default=10,
                   help="Max threads to process (default 10 for cost control)")
    p.add_argument("--sleep",  type=float, default=0.5,
                   help="Seconds to sleep between threads")
    p.add_argument("--qc",     action="store_true",
                   help="Pause after each stage for human QC (recommended for calibration)")
    return p.parse_args()


def main():
    args     = parse_args()
    client   = build_client()
    registry = EntityRegistry(path=args.registry)

    threads = load_filtered_csv(args.input)
    if args.limit:
        threads = threads[:args.limit]
        safe_print(f"Processing first {args.limit} threads "
                   f"(use --limit 0 or omit for full run)")

    results: List[Dict[str, Any]] = []

    for i, thread in enumerate(threads, start=1):
        subject = clean_text(thread.get("subject", "(no subject)"))
        safe_print(f"\n[{i}/{len(threads)}] {subject[:70]}")

        try:
            result = extract_thread(client, thread, registry,
                                    model=args.model, qc=args.qc)
        except KeyboardInterrupt:
            safe_print("\nRun aborted by QC. Saving partial results...")
            break
        results.append(result)

        if args.sleep > 0:
            time.sleep(args.sleep)

    # Persist registry (inter-document entity linking carries over to next run)
    registry.save()
    safe_print(f"\nEntity registry: {len(registry.id_to_info)} entities "
               f"→ {args.registry}")

    save_jsonl(args.jsonl, results)
    rows = flatten_results(results)
    save_csv(args.output, rows)

    summarize(results)
    safe_print(f"\nFlat CSV : {args.output}")
    safe_print(f"Raw JSONL: {args.jsonl}")


if __name__ == "__main__":
    main()
