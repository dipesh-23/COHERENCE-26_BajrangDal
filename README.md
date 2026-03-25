# COHERENCE-26: Clinical Trial Matching Engine

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.9%2B-blue.svg)
![React](https://img.shields.io/badge/react-18.x-orange.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-green.svg)
![Docker](https://img.shields.io/badge/Docker-Enabled-blue.svg)

A full-stack, AI-powered system designed to parse unstructured clinical trial data, analyze complex inclusion/exclusion criteria, and intelligently match patients to experimental trials. Built for the **COHERENCE-26** hackathon by team **BajrangDal**.

---

## 📖 The Problem

Finding the right clinical trial for a patient is famously difficult because trial criteria are almost always written as **unstructured text** (paragraphs of medical jargon). Manually parsing through inclusion requirements (e.g., "Patients with severe Asthma, but excluding those with recent cardiac events") and matching them against a patient's Electronic Health Record (EHR) is slow, error-prone, and exclusionary.

## 💡 The Solution

We built an intelligent **Clinical Trial Matching Engine** that automates this workflow from end-to-end. By leveraging cutting-edge Natural Language Processing (NLP) specifically tuned for medical texts (ScispaCy) alongside a rigid deterministic matching algorithm, we can confidently match patients to trials at scale. Furthermore, our frontend provides a beautiful, user-friendly interface to visualize geospatial trials and drill down into match reports.

---

## 🌟 Deep Dive into Core Features

### 1. 🧠 Advanced NLP Pipeline & Criteria Parsing
Located in the `clinical-trial-engine/` and `backend/modules/` directories, this is the brain of the project.
- **Medical Entity Extraction:** We don't just use basic keyword searches; the engine routes unstructured text through ScispaCy (a SpaCy model specifically tailored for biomedical texts) and complex Regex rules. It securely tags clinical conditions, required medications, biomarkers, and biometrics (e.g., BMI, age ranges).
- **Explainable AI with Character-Level Traceability:** Trust is paramount in healthcare. We implemented deep traceability mechanisms that record exactly where a data point was extracted from. Every extracted condition in our JSON output includes `source_start`, `source_end`, and `source_snippet` metadata. This allows doctors and auditors to instantly trace a matched (or excluded) condition back to the exact sentence in the original trial description.
- **Logic Tree Generation:** Criteria are not a simple list—they are complex boolean logic (e.g., "Condition A AND (Condition B OR Condition C)"). Our parser reconstructs unstructured criteria into explicit, programmatic Logic Trees (AND/OR nodes) to enable deterministic computing.

### 2. 🎯 Intelligent Patient Matching Engine
- **Deterministic Evaluation:** Once a Trial Logic Tree and a Patient JSON Profile are generated, the engine executes a matching script. It strictly evaluates the inclusions against the patient's existing conditions, vitals, and medications, while aggressively verifying the patient triggers none of the exclusion criteria.
- **Score Formulation & Breakdown:** Instead of a simple "Yes/No", the engine calculates a percentage match confidence. It accounts for partial matches or missing patient data that prevent a definitive 100% score.
- **Explainable Match Reports:** When a patient is denied from a trial, the system pinpoints exactly which node in the logic tree failed (e.g., *Patient failed Exclusion node: Recent Cardiac Event identified*), ensuring the physician knows precisely *why* a trial is off the table.

### 3. 💻 Interactive React Dashboard
Our frontend (`frontend/`) is a sleek, component-driven Single Page Application built on Vite, React, and TailwindCSS.
- **Geographic Filtering & Trial Map (`TrialMap.jsx` / `GeographyFilter.jsx`):** Clinical trials require immense patient commitment. Our map interface lets doctors constrain trial searches geographically, making sure the recommended trials aren't just a clinical match, but a logistical possibility.
- **Patient Uploader (`PatientUploader.jsx`):** A streamlined modal to instantly upload and convert standard patient data formats into the JSON structures required by the matching engine.
- **Visual Match Analytics (`ScoreGauge.jsx` / `ScoreBreakdown.jsx`):** Real-time, animated gauge charts and detailed accordion breakdowns that make dense criteria reports easily readable at a glance.
- **Detailed Trial View (`TrialDetail.jsx` / `TrialCard.jsx`):** Expanded contexts for any selected trial, bringing everything from location to principal investigator info into one unified view.

### 4. ⚙️ Robust Backend & Infrastructure
- **FastAPI Backend (`backend/main.py`):** An asynchronous REST API offering low-latency endpoints for NLP processing, trial fetching, and match generation.
- **Supabase Integration & Database Schema (`database.py` / `supabase_schema.sql`):** Uses Supabase for secure, scalable PostgreSQL database modeling, complete with table relationships mapped out for trials, patients, and saved matches.
- **Dockerized Environment (`docker-compose.yml`):** We prioritize developer experience and production parity. A single `docker-compose up --build` command brings up the backend, the frontend, and links them perfectly via an internal network.

---

## 🛠️ Tech Stack & Technologies Used

Our stack was carefully chosen to optimize for high-throughput NLP processing, rapid development, and a visually engaging interface.

**Frontend:**
- **React.js & Vite:** Powers the fast, interactive Single Page Application, ensuring a snappy experience when doctors browse trials or upload patient data.
- **TailwindCSS:** A utility-first CSS framework used for building the custom, responsive UI (like the Gauge score components and match reports).

**Backend & Data Parsing:**
- **FastAPI (Python 3.9+):** The asynchronous REST API backend. Chosen for its extreme speed and built-in Pydantic data validation, which is crucial when handling complex medical JSON objects.
- **ScispaCy & SpaCy:** Deep Learning models for Natural Language Processing specifically customized to identify biomedical and clinical conditions in text.
- **Regex & Deterministic Logic Pipelines:** Used to construct precise boolean criteria trees from the entities extracted by ScispaCy.

**Infrastructure & Database:**
- **Supabase (PostgreSQL):** An open-source Firebase alternative. We use its powerful relational PostgreSQL database for robust data modeling and its authentication services to secure patient/trial data.
- **Docker & Docker Compose:** Containerization ensures our complex environment (Python/NLP backend + Node/React frontend) spins up seamlessly across any machine.

---

## 🏗️ Project Architecture Map

```
COHERENCE-26_BajrangDal/
├── backend/                  # FastAPI Application Segment
│   ├── main.py               # Core API routes and application initialization
│   ├── database.py           # Supabase connection handlers
│   ├── modules/parser.py     # The ScispaCy & Traceability NLP Engine
│   └── tests/                # Unit test suite validating parser and logic
├── frontend/                 # React Application Segment
│   ├── src/components/       # Reusable UI (Maps, Gauges, Filters)
│   ├── src/pages/            # Full-page View logic (Dashboard, Detail)
│   ├── src/hooks/            # Custom logic (e.g., useTrialEngine)
│   └── tailwind.config.js    # Design system tokens
├── clinical-trial-engine/    # Isolated logic pipelines and trial definitions
└── docker-compose.yml        # Orchestration configuration
```

---

## 🚀 Getting Started

### Prerequisites
- [Docker Engine & Compose](https://docs.docker.com/get-docker/) (Highly Recommended)
- Node.js (v18+) and Python 3.9+ (Optional, for manual local setups)
- A configured Supabase project 

### Path A: Running with Docker (Recommended)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/kvsvar/COHERENCE-26_BajrangDal.git
   cd COHERENCE-26_BajrangDal
   ```

2. **Configure environment variables:**
   Create `./backend/.env` with your Supabase credentials to link the database.
   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_KEY=your_supabase_service_key_or_anon_key
   ```

3. **Spin up the stack:**
   ```bash
   docker-compose up --build
   ```
   - **Frontend Application:** http://localhost:80
   - **Backend API Server:** http://localhost:8000
   - **Interactive API Docs (Swagger):** http://localhost:8000/docs

### Path B: Running Locally (Without Docker)

**1. Boot the Backend:**
```bash
cd backend
python -m venv venv
# On Windows: venv\Scripts\activate | On Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**2. Boot the Frontend:**
```bash
cd frontend
# Ensure you have an .env file here exposing VITE_API_BASE_URL=http://localhost:8000
npm install
npm run dev
```

---

## 🤝 Contributing

We welcome contributions to make clinical trial matching more accessible!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
