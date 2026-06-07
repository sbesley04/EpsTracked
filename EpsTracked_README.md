# EpsTracked — Document Analysis Dashboard

An interactive NLP pipeline and web dashboard for exploring extracted events, entities, and indicators from the publicly released Epstein document corpus.

**Live app:** [eps-tracked.vercel.app](https://eps-tracked.vercel.app)

---

## Overview

EpsTracked processes thousands of documents from the U.S. House Oversight Committee's Epstein document release (sourced via HuggingFace) and surfaces structured, searchable insights through a full-stack web application.

The pipeline extracts discrete events, identifies named entities, classifies event types, and assigns probabilistic trafficking likelihood scores — all surfaced through an interactive React dashboard.

**At a glance:**
- 2,599 extracted events across 787 document threads
- 515 unique entities identified
- 1,025 flagged events (39% of total)
- Average trafficking likelihood score: 38%

---

## Features

### Backend (Python)
- **LLM-based event extraction** — uses large language model prompting to identify and structure discrete events from raw document text, capturing actor, recipient, description, and event type
- **Entity resolution** — identifies and deduplicates named entities (people, organizations) across the full corpus
- **Event classification** — categorizes events into six types: Communicative, Reported Allegation, Concealment, Relational, Realized, and Financial
- **Trafficking likelihood scoring** — assigns each event a probabilistic score based on content signals
- **Corpus ingestion pipeline** — loads and preprocesses documents from HuggingFace datasets, handling OCR artifacts and document metadata

### Frontend (TypeScript / React)
- **Dashboard** — high-level summary of corpus statistics, event type distribution, flagged event counts, and timeline view
- **Events view** — browsable, filterable list of all extracted events with actor/recipient, description, type, and likelihood score
- **Entities view** — all 515 unique entities with connection counts, event totals, and flagging rates
- **Flagged view** — focused view of the 1,025 highest-likelihood events
- **Threads view** — source document thread browser
- **Narrative view** — synthesized narrative across the corpus

---

## Tech Stack

| Layer | Technology |
|---|---|
| NLP / Data pipeline | Python, LLM-based extraction (OpenAI / Anthropic APIs) |
| Data processing | pandas, Jupyter Notebook |
| Data source | HuggingFace Datasets |
| Frontend | React, TypeScript |
| Deployment | Vercel |

---

## Project Context

Built as a Computational Linguistics course project (CS/QTM/LING 329) at Emory University, Spring 2026. The goal was to apply modern NLP techniques — specifically LLM-based structured extraction — to a large, real-world document corpus and make the results accessible through a purpose-built interface.

The project demonstrates an end-to-end pipeline from raw document ingestion through structured extraction, entity resolution, and interactive visualization — built and deployed solo.

---

## Repository Structure

```
EpsTracked/
├── scripts/          # Python pipeline: ingestion, extraction, scoring
├── epstracked-ui/    # React/TypeScript frontend (current)
├── epstracked-ui-v1/ # Initial frontend iteration
└── README.md
```

---

## Author

**Sam Besley** — [github.com/sbesley04](https://github.com/sbesley04) · [linkedin.com/in/sbesley](https://www.linkedin.com/in/sbesley)  
B.S. Data Science, International Studies — Emory University '26
