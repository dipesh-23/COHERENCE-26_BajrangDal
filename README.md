# 🏥 TrialSync.ai — Clinical Trial Matching Engine

> **AI-powered patient-to-clinical-trial eligibility matching system** built for COHERENCE 2026 Hackathon by **Team BajrangDal**.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Disease Categories & Trials](#disease-categories--trials)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [Dataset](#dataset)
- [Ethical & Safety Safeguards](#ethical--safety-safeguards)

---

## Overview

TrialSync.ai is a full-stack clinical decision-support platform that matches patients to eligible clinical trials using:

1. **Structured hard-filter engine** — evaluates ICD-10 diagnoses, lab values, age, gender, and prior treatments against each trial's `criteria_json`
2. **S-BiomedBERT semantic scorer** — a fine-tuned sentence transformer that computes similarity between a patient's clinical history and trial criteria to produce a meaningful match score (0–100)
3. **Geographic distance engine** — calculates patient-to-site distance using Haversine formula; supports ZIP-based radius filtering
4. **Dropout predictor** — heuristic model penalising high visit burden and long distance, rewarding telehealth availability
5. **Polypharmacy safety check** — flags known drug interactions with the investigational drug
6. **PHI anonymisation** — strips Protected Health Information via Microsoft Presidio before any processing

---

## Key Features

### 🔐 Authentication
- Supabase-backed JWT authentication
- Role-aware UI (`doctor` / `nurse`)
- Secure sign-in / sign-out with session management

### 📤 Patient Intake (Module 1)
- **CSV batch upload** — drop a multi-row CSV; all patients load simultaneously into the left panel
- **JSON single upload** — structured single-patient records
- **Manual intake modal** — fill a form to create a patient on the fly
- PHI is automatically stripped (names, DOBs, identifiers) via Presidio before matching
- Patient anonymisation shown in the left panel (no real names displayed)

### 🧬 Trial Matching Engine (Module 3)
- Evaluates each patient against **8 active clinical trials** spanning 3 disease categories
- **Eligible patients** → semantic similarity score × confidence weight (range 46–100)
- **Ineligible patients** → proportional partial score based on % criteria passed (range 0–45), so zero scores are eliminated
- Confidence penalty applied for every missing lab value (`-15%` per missing field)
- Full `criteria_breakdown` returned per trial — every criterion is labelled `pass / fail / verify`

### 🗺️ Interactive Trial Map
- Leaflet.js map with **unique colour-coded pins** per trial (20-colour palette, no repeats)
- Pulsing radar animation on markers
- Click any pin → popup shows trial ID, match score, site name, city, and distance from patient
- **Geography filter** — filter trials by ZIP + radius (miles)
- **HPSA toggle** — surface trials in Health Professional Shortage Areas

### 📊 Reports & Scoring
- Score breakdown gauge with animated arc
- Criteria breakdown panel — pass/fail/verify badges per criterion
- **Flag for Review** — per-trial toggleable flag; increments the patient's REVIEW count in the summary header
- Completion likelihood percentage with dropout reasons
- Polypharmacy interaction warnings
- Recommendation badge: `✅ Eligible — Proceed` / `⚠️ Verify First` / `🚫 Not Suitable`

### 🎨 UI/UX
- Premium animated dashboard with slide-in navbar (spring easing)
- Glowing logo pulse, staggered nav tab entrance, animated active-tab underline gradient
- Stats strip slides up on load; stat chips lift on hover
- Micro-animations throughout: hover scale, active scale-down, colour transitions
- Dark-mode-ready colour system (`#0D9488` teal, `#0F1E34` navy)

### 📈 Audit & Fairness
- In-memory audit log tracking age group, gender, eligibility, and HPSA boost per match decision
- Exposed via `/audit/log` endpoint for fairness analysis

---

## System Architecture

```
┌─────────────────────────────────────────────┐
│               React Frontend                │
│  Dashboard · Login · TrialDetail            │
│  PatientUploader · TrialMap · ScoreGauge    │
│  GeographyFilter · MatchReport              │
└──────────────────┬──────────────────────────┘
                   │  REST (JSON)
┌──────────────────▼──────────────────────────┐
│            FastAPI Backend                  │
│                                             │
│  /ingest/patient  →  Presidio Anonymizer    │
│  /match           →  Matcher Engine         │
│                       ├─ hard_filter()      │
│                       ├─ S-BiomedBERT scorer│
│                       ├─ distance calc      │
│                       └─ dropout predictor  │
│  /audit/log       →  Fairness log           │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│              Supabase (PostgreSQL)          │
│  patients · trials · match_results          │
│  audit_log                                  │
└─────────────────────────────────────────────┘
```

---

## Disease Categories & Trials

The system currently contains **8 active trials** across 3 categories:

### 🔴 Metabolic (3 Trials)
| Trial ID | Study | Drug | Site |
|---|---|---|---|
| NCT04521234 | Phase 3 Semaglutide — Type 2 Diabetes | Semaglutide | KEM Hospital, Mumbai |
| NCT05559999 | Early Intervention — CKD Stage 3 | Sparsentan | AIIMS, New Delhi |
| NCT07884455 | Cardiovascular Outcomes — Hypertension | Sacubitril-Valsartan | Global Hospital, Chennai |

### 🟣 Neurologic (2 Trials)
| Trial ID | Study | Drug | Site |
|---|---|---|---|
| NCT09112222 | CLARITY-AD — Alzheimer's MCI (Lecanemab) | Lecanemab | AIG Hospitals, Hyderabad |
| NCT09500001 | PASADENA — Early Parkinson's Disease | Prasinezumab | NIMHANS, Bangalore |

### 🟢 Oncologic (3 Trials)
| Trial ID | Study | Drug | Site |
|---|---|---|---|
| NCT09001111 | Oral SERD — ER+/HER2- Breast Cancer | Elacestrant | Breach Candy Hospital, Mumbai |
| NCT09334444 | KEYNOTE-789 — EGFR+ NSCLC | Pembrolizumab + Carbo | Tata Memorial Hospital, Mumbai |
| NCT09889999 | POLARIX — DLBCL Lymphoma | Polatuzumab Vedotin | CMC, Vellore |

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 + Vite | SPA framework |
| Tailwind CSS | Utility-first styling |
| Leaflet / React-Leaflet | Interactive trial site map |
| Supabase JS Client | Auth & realtime |
| Vanilla CSS animations | Premium micro-animations |

### Backend
| Technology | Purpose |
|---|---|
| FastAPI | REST API framework |
| Pydantic v2 | Data validation & models |
| Microsoft Presidio | PHI anonymisation (HIPAA) |
| Sentence-Transformers | S-BiomedBERT semantic scorer |
| Supabase Python SDK | Database persistence |
| Docker + docker-compose | Containerised deployment |

---

## Getting Started

### Prerequisites
- Node.js ≥ 18
- Python ≥ 3.11
- A Supabase project (or run in demo/offline mode without one)

### Backend

```bash
cd backend
pip install -r requirements.txt

# Copy and fill in your Supabase credentials:
cp .env.example .env

uvicorn main:app --reload --port 8001
```

The backend starts in **demo mode** (no Supabase needed) if `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` are not set — all DB writes are silently no-op'd.

### Frontend

```bash
cd frontend
npm install

# Set API base URL:
cp .env.example .env
# VITE_API_BASE_URL=http://localhost:8001

npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Docker (Full Stack)

```bash
docker-compose up --build
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/ingest/patient` | Ingest & anonymise a patient record |
| `POST` | `/ingest/trial-pdf` | Parse a trial PDF and extract criteria |
| `POST` | `/match` | Match a patient against all active trials |
| `GET` | `/trials` | List all seeded trials |
| `GET` | `/patients` | List anonymised patients |
| `GET` | `/audit/log` | Retrieve fairness audit log |
| `GET` | `/health` | Health check |

### Match Request Body
```json
{
  "patient_id": "P-IND-001",
  "age": 52,
  "gender": "Female",
  "diagnoses": ["C50.919"],
  "labs": { "CA15-3": 86.4, "CEA": 5.3 },
  "medications": ["Letrozole 2.5mg", "Palbociclib 125mg"],
  "history_text": "ER+/HER2- metastatic breast cancer...",
  "zip_code": "400026",
  "lat": 18.9719,
  "lng": 72.8093,
  "filter_zip": "400026",
  "filter_radius_miles": 200,
  "filter_hpsa_only": false
}
```

---

## Dataset

A ready-to-use patient dataset is included at `backend/indian_patients_20.csv`:

- **20 Indian patients** with realistic clinical profiles
- Balanced across 3 disease categories:
  - 🔴 **Metabolic** (7): T2DM, CKD, Hypertension
  - 🟣 **Neurologic** (6): Alzheimer's MCI, Parkinson's Disease
  - 🟢 **Oncologic** (7): Breast Cancer, NSCLC, DLBCL
- Each patient has ICD-10 diagnoses, lab values, medications, clinical history, and geographic coordinates across Mumbai, Delhi, Bangalore, Hyderabad, Chennai, Kochi, Vellore

Upload directly from the dashboard via **Upload Patient Record → CSV**.

---

## Ethical & Safety Safeguards

1. **PHI Redaction** — All patient names and identifiers are stripped by Microsoft Presidio before any matching or storage
2. **Missing Data = Verify, not Fail** — Lab values not present in the record are flagged as `verify` rather than hard-failing the patient, ensuring no patient is incorrectly excluded
3. **Partial Scoring for Ineligible Patients** — Ineligible patients receive a proportional score (0–45) based on the percentage of criteria they satisfy, enabling clinicians to see how close a patient is to eligibility
4. **Confidence Weighting** — Confidence decreases by 15% per missing required data field, making uncertainty visible rather than hidden
5. **Dropout Predictor** — Flags high-risk enrolment combinations (remote site + high visit burden) to protect patient wellbeing
6. **Polypharmacy Safety** — Checks investigational drug against patient's current medications for known interactions
7. **HPSA Equity Scoring** — Bonus weighting for trials in Health Professional Shortage Areas to promote research equity in underserved populations
8. **Audit Logging** — Every match decision is logged with age group, gender, eligibility, and HPSA boost for post-hoc fairness analysis

---

## Team

**Team BajrangDal** — COHERENCE 2026 Hackathon

---

*Built with ❤️ for advancing equitable access to clinical research.*
