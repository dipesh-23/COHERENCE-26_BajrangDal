-- ============================================================
--  Supabase SQL Schema — Clinical Trial Matching Engine
--  Run this in your Supabase project → SQL Editor → New Query
-- ============================================================

-- 1. PATIENTS (anonymised records)
CREATE TABLE IF NOT EXISTS patients (
    patient_id   TEXT        PRIMARY KEY,
    age          INT         NOT NULL,
    gender       TEXT        NOT NULL,
    zip_code     TEXT,
    diagnoses    JSONB       DEFAULT '[]',
    labs         JSONB       DEFAULT '{}',
    medications  JSONB       DEFAULT '[]',
    history_text TEXT        DEFAULT '',
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TRIALS (seeded from backend SAMPLE_TRIALS on startup)
CREATE TABLE IF NOT EXISTS trials (
    trial_id            TEXT PRIMARY KEY,
    official_title      TEXT NOT NULL,
    brief_summary       TEXT DEFAULT '',
    phase               TEXT,
    status              TEXT,
    sponsor             TEXT,
    start_date          DATE,
    raw_inclusion       TEXT DEFAULT '',
    raw_exclusion       TEXT DEFAULT '',
    criteria_json       JSONB DEFAULT '{}',
    is_remote           BOOLEAN DEFAULT FALSE,
    location            TEXT DEFAULT 'Unknown',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 3. MATCH RESULTS (one row per patient x trial pair)
CREATE TABLE IF NOT EXISTS match_results (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id       TEXT        NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    trial_id         TEXT        NOT NULL REFERENCES trials(trial_id)   ON DELETE CASCADE,
    match_score      FLOAT       NOT NULL DEFAULT 0.0,
    eligible         BOOLEAN     NOT NULL DEFAULT FALSE,
    confidence       FLOAT       NOT NULL DEFAULT 1.0,
    criteria_breakdown JSONB     DEFAULT '[]',
    missing_data     JSONB       DEFAULT '[]',
    llm_explanation  TEXT        DEFAULT '',
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (patient_id, trial_id)
);

-- 4. AUDIT LOG (immutable PHI scrubbing record)
CREATE TABLE IF NOT EXISTS audit_log (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id     TEXT        NOT NULL,
    action         TEXT        NOT NULL DEFAULT 'PHI_ANONYMIZED',
    fields_scrubbed JSONB      DEFAULT '[]',
    endpoint       TEXT,
    status         TEXT        DEFAULT 'SUCCESS',
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes for common query patterns ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_match_patient    ON match_results(patient_id);
CREATE INDEX IF NOT EXISTS idx_match_trial      ON match_results(trial_id);
CREATE INDEX IF NOT EXISTS idx_match_score      ON match_results(match_score DESC);
CREATE INDEX IF NOT EXISTS idx_audit_patient    ON audit_log(patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_created    ON audit_log(created_at DESC);

-- ── Row Level Security (optional – enable once auth is added) ─────────────────
-- ALTER TABLE patients      ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE audit_log     ENABLE ROW LEVEL SECURITY;
