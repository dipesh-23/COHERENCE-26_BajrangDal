"""
Clinical NLP Parser using ScispaCy + MedSpaCy

Installation (use the `clinical-nlp` conda environment):
    conda create -n clinical-nlp python=3.11 -y
    conda activate clinical-nlp
    pip install scispacy==0.5.4
    pip install git+https://github.com/medspacy/medspacy.git
    pip install https://s3-us-west-2.amazonaws.com/ai2-s2-scispacy/releases/v0.5.4/en_core_sci_lg-0.5.4.tar.gz

NOTE: scispacy v0.5.5 model URL does not exist on S3. v0.5.4 is the latest available model.
Requires Python 3.11 (spacy 3.7.x is not yet compatible with Python 3.13).
"""

import spacy
import medspacy


def load_nlp_pipeline() -> spacy.language.Language:
    """
    Load the en_core_sci_lg ScispaCy model and extend it with
    MedSpaCy clinical components:
      - concept_tagger   : assigns UMLS semantic type tags to entities
      - target_matcher   : rule-based entity recognition for clinical targets
      - sectionizer      : detects clinical note sections (history, labs, etc.)

    Returns
    -------
    nlp : spacy.language.Language
        Fully configured NLP pipeline ready for clinical text.
    """
    # 1. Load the large biomedical sci model
    nlp = spacy.load("en_core_sci_lg")

    # 2. Add MedSpaCy components (order matters)
    #    concept_tagger  – semantic type classification
    if "medspacy_concept_tagger" not in nlp.pipe_names:
        nlp.add_pipe("medspacy_concept_tagger")

    #    target_matcher  – identify clinical targets via rules
    if "medspacy_target_matcher" not in nlp.pipe_names:
        nlp.add_pipe("medspacy_target_matcher")

    #    sectionizer     – segment note into structured sections
    if "medspacy_sectionizer" not in nlp.pipe_names:
        nlp.add_pipe("medspacy_sectionizer")

    print("Loaded pipeline components:", nlp.pipe_names)
    return nlp


def parse_clinical_text(text: str, nlp: spacy.language.Language = None):
    """
    Run the NLP pipeline on a piece of clinical text and print
    detected entities, their labels, and section context.

    Parameters
    ----------
    text : str
        Raw clinical / eligibility criteria text.
    nlp  : spacy.language.Language, optional
        Pre-loaded pipeline; one is created automatically if not provided.
    """
    if nlp is None:
        nlp = load_nlp_pipeline()

    doc = nlp(text)

    print("\n--- Named Entities ---")
    if doc.ents:
        for ent in doc.ents:
            print(f"  [{ent.label_}] {ent.text!r}")
    else:
        print("  (no entities detected)")

    # MedSpaCy sectionizer attaches section info to each sentence
    print("\n--- Section Context (per sentence) ---")
    for sent in doc.sents:
        section = getattr(sent, "_.section_category", None)
        print(f"  Section: {section or 'unknown'!r} | {sent.text.strip()!r}")

    return doc


# ---------------------------------------------------------------------------
# Inclusion Criteria Entity Extractor
# ---------------------------------------------------------------------------
import re
from typing import Optional


def _extract_age_range(text: str) -> dict:
    """
    Extract min/max age using regex patterns.
    Handles: "18-65 years", "18 to 65 years", "aged 40-70", "age between 18 and 65"
    """
    patterns = [
        r"(?:aged?|age(?:d|\s+between)?)\s*(\d{1,3})\s*(?:to|-|and)\s*(\d{1,3})\s*(?:years?)?",
        r"(\d{1,3})\s*(?:-|to|and)\s*(\d{1,3})\s+years?",
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            return {"min": int(m.group(1)), "max": int(m.group(2))}

    # Single bound: "at least 18 years"
    m = re.search(r"at\s+least\s+(\d{1,3})\s+years?", text, re.IGNORECASE)
    if m:
        return {"min": int(m.group(1)), "max": None}

    return {"min": None, "max": None}


def _extract_gender(text: str) -> str:
    """
    Detect gender requirement.
    Returns: "male" | "female" | "any"
    """
    text_lower = text.lower()
    has_male   = bool(re.search(r"\bmale\b", text_lower))
    has_female = bool(re.search(r"\bfemale\b", text_lower))

    if has_male and has_female:
        return "any"
    elif has_female:
        return "female"
    elif has_male:
        return "male"
    return "any"


def _extract_icd10_codes(text: str) -> list:
    """
    Extract ICD-10 code strings using regex.
    Matches codes like E11.9, I10, Z87.39, A00-Z99 style.
    """
    # ICD-10 codes: 1 letter + 2 digits, optionally followed by . and 1-4 chars
    pattern = r"\b([A-Z]\d{2}(?:\.\d{1,4})?)\b"
    codes = re.findall(pattern, text)
    return list(dict.fromkeys(codes))  # deduplicated, order-preserved


def _extract_lab_values(text: str) -> list:
    """
    Extract structured lab measurements.
    Handles: "HbA1c > 7%", "HbA1c greater than 7%", "eGFR >= 60 mL/min"
    """
    # Map word operators to symbols
    word_ops = {
        "greater than or equal to": ">=",
        "less than or equal to":    "<=",
        "greater than":             ">",
        "less than":                "<",
        "equal to":                 "=",
        "at least":                 ">=",
        "at most":                  "<=",
        "more than":                ">",
        "no more than":             "<=",
    }

    # Normalise word operators first
    normalised = text
    for phrase, sym in word_ops.items():
        normalised = re.sub(phrase, sym, normalised, flags=re.IGNORECASE)

    # Pattern: LAB_NAME OPERATOR VALUE UNIT?
    # Lab names: word chars, spaces, digits, slashes (e.g. HbA1c, eGFR, LDL-C)
    pattern = (
        r"((?:[A-Za-z][\w\-]*)(?:\s+[\w\-]+){0,3})"  # lab name (1–4 tokens)
        r"\s*(>=|<=|>|<|=)\s*"                         # operator
        r"([\d]+(?:\.[\d]+)?)"                         # numeric value
        r"\s*(%|mmol/L|mg/dL|mL/min(?:/1\.73\s*m²?)?|U/L|g/dL|IU/L|ng/mL|µg/L|mmHg)?"  # unit
    )
    results = []
    # Words that indicate a duration/context phrase, not a lab name
    noise_words = re.compile(r"\b(month|week|day|year|for|on|per|at|least|most)\b", re.IGNORECASE)
    for m in re.finditer(pattern, normalised, re.IGNORECASE):
        lab  = m.group(1).strip()
        op   = m.group(2)
        val  = float(m.group(3))
        unit = m.group(4) or ""
        # Filter out noise (pure numbers, very short tokens, or duration phrases)
        if len(lab) >= 3 and not lab[0].isdigit() and not noise_words.search(lab):
            results.append({"lab": lab, "operator": op, "value": val, "unit": unit})
    return results


def _extract_prior_treatments(text: str, nlp=None) -> list:
    """
    Use ScispaCy NER to identify drug / treatment names.
    Falls back to a simple regex keyword list if nlp is not provided.
    """
    treatments = []

    if nlp is not None:
        doc = nlp(text)
        # ScispaCy uses generic ENTITY label; filter likely drugs by context keywords
        treatment_keywords = re.compile(
            r"metformin|insulin|aspirin|statin|lisinopril|atorvastatin|"
            r"glipizide|sitagliptin|empagliflozin|liraglutide|therapy|treatment",
            re.IGNORECASE,
        )
        for ent in doc.ents:
            if treatment_keywords.search(ent.text):
                treatments.append(ent.text.strip())
    
    # Regex fallback / supplement for common drug mentions
    drug_pattern = re.compile(
        r"\b(metformin|insulin(?:\s+\w+)?|aspirin|atorvastatin|lisinopril|"
        r"glipizide|sitagliptin|empagliflozin|liraglutide|"
        r"(?:\w+umab|\w+tinib|\w+mab))\b",
        re.IGNORECASE,
    )
    for m in drug_pattern.finditer(text):
        drug = m.group(1).strip()
        if drug not in treatments:
            treatments.append(drug)

    return list(dict.fromkeys(treatments))  # deduplicated


def extract_inclusion_entities(text: str, nlp=None) -> dict:
    """
    Extract structured clinical inclusion-criteria entities from free text.

    Parameters
    ----------
    text : str
        Raw inclusion criteria text from a clinical trial.
    nlp  : spacy.language.Language, optional
        Pre-loaded ScispaCy pipeline. If None, NER-based extraction
        falls back to regex-only for treatments.

    Returns
    -------
    dict with keys:
        age_range        : {"min": int|None, "max": int|None}
        gender           : "male" | "female" | "any"
        icd10_codes      : list[str]
        lab_values       : list[{"lab", "operator", "value", "unit"}]
        prior_treatments : list[str]
    """
    return {
        "age_range":        _extract_age_range(text),
        "gender":           _extract_gender(text),
        "icd10_codes":      _extract_icd10_codes(text),
        "lab_values":       _extract_lab_values(text),
        "prior_treatments": _extract_prior_treatments(text, nlp),
    }


# ---------------------------------------------------------------------------
# Exclusion Criteria Entity Extractor
# ---------------------------------------------------------------------------

# Known drug / substance patterns
_DRUG_RE = re.compile(
    r"\b(metformin|insulin(?:\s+\w+)?|aspirin|atorvastatin|lisinopril|"
    r"warfarin|clopidogrel|glipizide|sitagliptin|empagliflozin|liraglutide|"
    r"steroids?|corticosteroids?|immunosuppressants?|"
    r"(?:\w+umab|\w+tinib|\w+mab|\w+pril|\w+sartan))\b",
    re.IGNORECASE,
)

# Pregnancy / breastfeeding keywords
_PREGNANCY_RE = re.compile(
    r"\b(pregnan(?:t|cy)|breastfeeding|lactating?|nursing)\b",
    re.IGNORECASE,
)

# Temporal pattern: "within the last N months/weeks/years"
_TEMPORAL_RE = re.compile(
    r"(?:history\s+of\s+)?(.+?)\s+within\s+(?:the\s+)?(?:last\s+)?(\d+)\s+(month|week|year)s?",
    re.IGNORECASE,
)

# Sentence / clause splitter
_CLAUSE_RE = re.compile(r"[.;]|\bexclusion criteria\s*:\s*", re.IGNORECASE)

# Lab threshold pattern (catches "eGFR < 30", "creatinine > 1.5")
_LAB_EXCL_RE = re.compile(
    r"((?:[A-Za-z][\w\-]*)(?:\s+[\w\-]+){0,2})\s*(>=|<=|>|<|=)\s*([\d]+(?:\.[\d]+)?)"
    r"\s*(%|mmol/L|mg/dL|mL/min(?:/1\.73\s*m²?)?|U/L|g/dL)?",
    re.IGNORECASE,
)

_NOISE = re.compile(
    r"\b(exclusion\s+criteria|known|history\s+of|current\s+use\s+of|"
    r"use\s+of|patients?\s+with|women|men|subjects?|individuals?)\b",
    re.IGNORECASE,
)

_TIME_NOISE = re.compile(
    r"\b(month|week|day|year|for|on|per|at|least|most)\b",
    re.IGNORECASE,
)


def _extract_forbidden_drugs(text: str, nlp=None) -> list:
    """Extract drug names mentioned as exclusions using regex + NER."""
    drugs = []

    # Regex sweep
    for m in _DRUG_RE.finditer(text):
        d = m.group(1).strip()
        if d.lower() not in [x.lower() for x in drugs]:
            drugs.append(d)

    # ScispaCy NER supplement
    if nlp is not None:
        doc = nlp(text)
        for ent in doc.ents:
            if _DRUG_RE.search(ent.text):
                if ent.text.strip().lower() not in [x.lower() for x in drugs]:
                    drugs.append(ent.text.strip())

    return drugs


def _extract_forbidden_conditions(text: str, nlp=None) -> list:
    """
    Extract condition/diagnosis strings using ScispaCy NER.
    Falls back to clause-level heuristics when nlp is absent.
    """
    conditions = []

    if nlp is not None:
        doc = nlp(text)
        for ent in doc.ents:
            # Skip if it looks like a drug or a number
            if _DRUG_RE.search(ent.text):
                continue
            if re.match(r"^\d", ent.text.strip()):
                continue
            cleaned = _NOISE.sub("", ent.text).strip(" ,.")
            if len(cleaned) >= 4 and cleaned.lower() not in [c.lower() for c in conditions]:
                conditions.append(cleaned)

    return conditions


def _extract_pregnancy_flag(text: str) -> bool:
    """Return True if pregnancy / breastfeeding is mentioned as an exclusion."""
    return bool(_PREGNANCY_RE.search(text))


def _extract_prior_conditions(text: str) -> list:
    """
    Extract timed prior-condition clauses like
    'myocardial infarction within the last 12 months'.
    Returns list of {"condition": str, "within_months": int}.
    """
    results = []
    for m in _TEMPORAL_RE.finditer(text):
        condition   = m.group(1).strip(" ,.")
        # Clean noise words from condition string
        condition   = _NOISE.sub("", condition).strip(" ,.")
        raw_n       = int(m.group(2))
        unit        = m.group(3).lower()

        # Normalise all to months
        if unit.startswith("week"):
            months = round(raw_n / 4.33)
        elif unit.startswith("year"):
            months = raw_n * 12
        else:
            months = raw_n

        if len(condition) >= 4:
            results.append({"condition": condition, "within_months": months})

    return results


def _extract_other_exclusions(text: str,
                               forbidden_drugs: list,
                               forbidden_conditions: list,
                               prior_conditions: list) -> list:
    """
    Collect clauses not already captured by the structured extractors.
    Splits on sentence boundaries and filters out already-matched content.
    """
    already_covered = set()
    for d in forbidden_drugs:
        already_covered.add(d.lower())
    for c in forbidden_conditions:
        already_covered.add(c.lower())
    for p in prior_conditions:
        already_covered.add(p["condition"].lower())

    others = []
    for clause in _CLAUSE_RE.split(text):
        clause = clause.strip(" ,.")
        if not clause or len(clause) < 8:
            continue
        clause_lower = clause.lower()

        # Skip if clause is already captured
        if any(covered in clause_lower for covered in already_covered):
            continue
        # Skip pregnancy (already flagged)
        if _PREGNANCY_RE.search(clause):
            continue
        # Skip if it's just noisy header text
        if re.fullmatch(r"exclusion criteria", clause, re.IGNORECASE):
            continue

        cleaned = _NOISE.sub("", clause).strip(" ,.")
        if len(cleaned) >= 5:
            others.append(cleaned)

    return others


def extract_exclusion_entities(text: str, nlp=None) -> dict:
    """
    Extract structured exclusion criteria from clinical trial text.

    Parameters
    ----------
    text : str
        Raw exclusion criteria text from a clinical trial.
    nlp  : spacy.language.Language, optional
        Pre-loaded ScispaCy pipeline. Improves condition/drug NER when provided.

    Returns
    -------
    dict with keys:
        forbidden_conditions : list[str]
        forbidden_drugs      : list[str]
        pregnancy_excluded   : bool
        prior_conditions     : list[{"condition": str, "within_months": int}]
        other_exclusions     : list[str]
    """
    forbidden_drugs      = _extract_forbidden_drugs(text, nlp)
    forbidden_conditions = _extract_forbidden_conditions(text, nlp)
    pregnancy_excluded   = _extract_pregnancy_flag(text)
    prior_conditions     = _extract_prior_conditions(text)
    other_exclusions     = _extract_other_exclusions(
        text, forbidden_drugs, forbidden_conditions, prior_conditions
    )

    return {
        "forbidden_conditions": forbidden_conditions,
        "forbidden_drugs":      forbidden_drugs,
        "pregnancy_excluded":   pregnancy_excluded,
        "prior_conditions":     prior_conditions,
        "other_exclusions":     other_exclusions,
    }


# ---------------------------------------------------------------------------
# Smoke-tests (run: conda activate clinical-nlp && python backend/modules/parser.py)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import json

    pipeline = load_nlp_pipeline()

    # ── Test 1: pipeline ──────────────────────────────────────────────────────
    TEST_SENTENCE = (
        "Patient must be 18-65 years old with HbA1c > 7% "
        "and diagnosed with Type 2 Diabetes (ICD E11.9)"
    )
    print("=" * 60)
    print("SMOKE-TEST 1: load_nlp_pipeline")
    print("=" * 60)
    parse_clinical_text(TEST_SENTENCE, pipeline)

    # ── Test 2: inclusion extractor ───────────────────────────────────────────
    INCL_SAMPLE = (
        "Patients aged 40-70 years, male or female, with Type 2 Diabetes "
        "Mellitus (ICD-10: E11.9), HbA1c greater than 7%, on metformin "
        "for at least 6 months."
    )
    print("\n" + "=" * 60)
    print("SMOKE-TEST 2: extract_inclusion_entities")
    print("=" * 60)
    print(json.dumps(extract_inclusion_entities(INCL_SAMPLE, nlp=pipeline), indent=2))

    # ── Test 3: exclusion extractor ───────────────────────────────────────────
    EXCL_SAMPLE = (
        "Exclusion criteria: Known hypersensitivity to metformin. "
        "Current use of insulin therapy. Pregnant or breastfeeding women. "
        "History of myocardial infarction within the last 12 months. "
        "eGFR < 30 mL/min."
    )
    print("\n" + "=" * 60)
    print("SMOKE-TEST 3: extract_exclusion_entities")
    print("=" * 60)
    print(json.dumps(extract_exclusion_entities(EXCL_SAMPLE, nlp=pipeline), indent=2))
