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
            return {
                "min": int(m.group(1)), 
                "max": int(m.group(2)),
                "source_start": m.start(),
                "source_end": m.end(),
                "source_snippet": text[m.start():m.end()]
            }

    # Single bound: "at least 18 years"
    m = re.search(r"at\s+least\s+(\d{1,3})\s+years?", text, re.IGNORECASE)
    if m:
        return {
            "min": int(m.group(1)), 
            "max": None,
            "source_start": m.start(),
            "source_end": m.end(),
            "source_snippet": text[m.start():m.end()]
        }

    return {"min": None, "max": None}


def _extract_gender(text: str) -> dict:
    """
    Detect gender requirement.
    Returns a dict containing the gender value and traceability info.
    """
    text_lower = text.lower()
    
    # We must find the bounds. Since "male or female" implies "any",
    # we'll find both bounds if both exist.
    has_male = False
    has_female = False
    start, end = len(text), 0
    
    for m in re.finditer(r"\bmale\b", text_lower):
        has_male = True
        start = min(start, m.start())
        end = max(end, m.end())
        
    for m in re.finditer(r"\bfemale\b", text_lower):
        has_female = True
        start = min(start, m.start())
        end = max(end, m.end())

    if not has_male and not has_female:
        return {"value": "any"}
        
    val = "any"
    if has_male and has_female:
        val = "any"
    elif has_female:
        val = "female"
    elif has_male:
        val = "male"
        
    return {
        "value": val,
        "source_start": start,
        "source_end": end,
        "source_snippet": text[start:end]
    }


def _extract_icd10_codes(text: str) -> list:
    """
    Extract ICD-10 code strings using regex.
    Matches codes like E11.9, I10, Z87.39, A00-Z99 style.
    """
    pattern = r"\b([A-Z]\d{2}(?:\.\d{1,4})?)\b"
    results = []
    seen = set()
    for m in re.finditer(pattern, text):
        code = m.group(1)
        if code not in seen:
            seen.add(code)
            results.append({
                "code": code,
                "source_start": m.start(),
                "source_end": m.end(),
                "source_snippet": text[m.start():m.end()]
            })
    return results


def _extract_lab_values(text: str) -> list:
    """
    Extract structured lab measurements with traceability.
    """
    # Map word operators to symbols
    word_ops = {
        r"greater than or equal to": ">=",
        r"less than or equal to":    "<=",
        r"greater than":             ">",
        r"less than":                "<",
        r"equal to":                 "=",
        r"at least":                 ">=",
        r"at most":                  "<=",
        r"more than":                ">",
        r"no more than":             "<=",
    }

    # IMPORTANT: We cannot mutate 'text' directly if we need exact start/end 
    # character indices. So we track matches on the raw text directly, 
    # but we'll accept word operators in the primary regex.
    
    # Compile a mega-pattern that catches symbols OR word operators
    op_pattern = r"(>=|<=|>|<|=|greater than or equal to|less than or equal to|greater than|less than|equal to|at least|at most|more than|no more than)"
    
    pattern = (
        r"((?:[A-Za-z][\w\-]*)(?:\s+[\w\-]+){0,3})"  # lab name
        r"\s*" + op_pattern + r"\s*"                  # operator (symbol or words)
        r"([\d]+(?:\.[\d]+)?)"                        # numeric
        r"\s*(%|mmol/L|mg/dL|mL/min(?:/1\.73\s*m²?)?|U/L|g/dL|IU/L|ng/mL|µg/L|mmHg)?"  # unit
    )
    
    results = []
    noise_words = re.compile(r"\b(month|week|day|year|for|on|per|at|least|most)\b", re.IGNORECASE)
    
    for m in re.finditer(pattern, text, re.IGNORECASE):
        lab  = m.group(1).strip()
        raw_op = m.group(2).lower()
        val  = float(m.group(3))
        unit = m.group(4) or ""
        
        # Transform word operators back to symbols for JSON
        op = raw_op
        for phrase, sym in word_ops.items():
            if phrase in raw_op:
                op = sym
                break
        
        # Filter noise
        if len(lab) >= 3 and not lab[0].isdigit() and not noise_words.search(lab):
            results.append({
                "lab": lab, 
                "operator": op, 
                "value": val, 
                "unit": unit,
                "source_start": m.start(),
                "source_end": m.end(),
                "source_snippet": text[m.start():m.end()]
            })
    return results


def _extract_prior_treatments(text: str, nlp=None) -> list:
    """
    Use ScispaCy NER to identify drug / treatment names.
    Falls back to a simple regex keyword list if nlp is not provided.
    """
    treatments = []
    seen = set()

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
                t = ent.text.strip()
                if t.lower() not in seen:
                    seen.add(t.lower())
                    treatments.append({
                        "name": t,
                        "source_start": ent.start_char,
                        "source_end": ent.end_char,
                        "source_snippet": text[ent.start_char:ent.end_char]
                    })
    
    # Regex fallback / supplement for common drug mentions
    drug_pattern = re.compile(
        r"\b(metformin|insulin(?:\s+\w+)?|aspirin|atorvastatin|lisinopril|"
        r"glipizide|sitagliptin|empagliflozin|liraglutide|"
        r"(?:\w+umab|\w+tinib|\w+mab))\b",
        re.IGNORECASE,
    )
    for m in drug_pattern.finditer(text):
        drug = m.group(1).strip()
        if drug.lower() not in seen:
            seen.add(drug.lower())
            treatments.append({
                "name": drug,
                "source_start": m.start(),
                "source_end": m.end(),
                "source_snippet": text[m.start():m.end()]
            })

    return treatments


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
    seen = set()

    # Regex sweep
    for m in _DRUG_RE.finditer(text):
        d = m.group(1).strip()
        if d.lower() not in seen:
            seen.add(d.lower())
            drugs.append({
                "name": d,
                "source_start": m.start(),
                "source_end": m.end(),
                "source_snippet": text[m.start():m.end()]
            })

    # ScispaCy NER supplement
    if nlp is not None:
        doc = nlp(text)
        for ent in doc.ents:
            if _DRUG_RE.search(ent.text):
                d = ent.text.strip()
                if d.lower() not in seen:
                    seen.add(d.lower())
                    drugs.append({
                        "name": d,
                        "source_start": ent.start_char,
                        "source_end": ent.end_char,
                        "source_snippet": text[ent.start_char:ent.end_char]
                    })

    return drugs


def _extract_forbidden_conditions(text: str, nlp=None) -> list:
    """
    Extract condition/diagnosis strings using ScispaCy NER.
    Falls back to clause-level heuristics when nlp is absent.
    """
    conditions = []
    seen = set()

    if nlp is not None:
        doc = nlp(text)
        for ent in doc.ents:
            # Skip if it looks like a drug or a number
            if _DRUG_RE.search(ent.text):
                continue
            if re.match(r"^\d", ent.text.strip()):
                continue
            
            # Since _NOISE strips characters, we want to maintain accurate source bounds
            # So we grab the bounds exactly as NER saw them first.
            raw_text = ent.text
            start = ent.start_char
            end = ent.end_char
            
            cleaned = _NOISE.sub("", raw_text).strip(" ,.")
            if len(cleaned) >= 4 and cleaned.lower() not in seen:
                seen.add(cleaned.lower())
                conditions.append({
                    "name": cleaned,
                    "source_start": start,
                    "source_end": end,
                    "source_snippet": text[start:end]
                })

    return conditions


def _extract_pregnancy_flag(text: str) -> dict:
    """Return dict if pregnancy / breastfeeding is mentioned as an exclusion."""
    m = _PREGNANCY_RE.search(text)
    if m:
        return {
            "value": True,
            "source_start": m.start(),
            "source_end": m.end(),
            "source_snippet": text[m.start():m.end()]
        }
    return {"value": False}


def _extract_prior_conditions(text: str) -> list:
    """
    Extract timed prior-condition clauses like
    'myocardial infarction within the last 12 months'.
    Returns list of condition dicts with exact character indices.
    """
    results = []
    for m in _TEMPORAL_RE.finditer(text):
        raw_cond = m.group(1).strip(" ,.")
        # Clean noise words from condition string
        condition = _NOISE.sub("", raw_cond).strip(" ,.")
        raw_n = int(m.group(2))
        unit = m.group(3).lower()

        # Normalise all to months
        if unit.startswith("week"):
            months = round(raw_n / 4.33)
        elif unit.startswith("year"):
            months = raw_n * 12
        else:
            months = raw_n

        if len(condition) >= 4:
            results.append({
                "condition": condition, 
                "within_months": months,
                "source_start": m.start(),
                "source_end": m.end(),
                "source_snippet": text[m.start():m.end()]
            })

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
        already_covered.add(d["name"].lower())
    for c in forbidden_conditions:
        already_covered.add(c["name"].lower())
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
# Logic Tree Builder
# ---------------------------------------------------------------------------

def build_logic_tree(inclusion_entities: dict, exclusion_entities: dict) -> dict:
    """
    Converts parsed inclusion and exclusion entities into a structured Boolean logic JSON.
    Each condition in inclusion uses AND logic.
    Each condition in exclusion uses OR logic.
    """
    incl_conditions = []
    
    # 1. Inclusion Age
    age = inclusion_entities.get("age_range", {})
    if age.get("min") is not None or age.get("max") is not None:
        cond = {
            "field": "age", 
            "operator": "between",
            "source_start": age.get("source_start", 0),
            "source_end": age.get("source_end", 0),
            "source_snippet": age.get("source_snippet", "")
        }
        if age.get("min") is not None:
            cond["min"] = age["min"]
        if age.get("max") is not None:
            cond["max"] = age["max"]
        incl_conditions.append(cond)
        
    # 2. Inclusion Gender
    gender = inclusion_entities.get("gender", {})
    val = gender.get("value")
    if val and val != "any":
        incl_conditions.append({
            "field": "gender", 
            "operator": "is", 
            "value": val,
            "source_start": gender.get("source_start", 0),
            "source_end": gender.get("source_end", 0),
            "source_snippet": gender.get("source_snippet", "")
        })
        
    # 3. Inclusion ICD-10
    icd10_list = inclusion_entities.get("icd10_codes", [])
    for icd in icd10_list:
        incl_conditions.append({
            "field": "diagnosis", 
            "operator": "in", 
            "values": [icd["code"]],
            "source_start": icd["source_start"],
            "source_end": icd["source_end"],
            "source_snippet": icd["source_snippet"]
        })
        
    # 4. Inclusion Labs
    labs = inclusion_entities.get("lab_values", [])
    for lab in labs:
        incl_conditions.append({
            "field": "lab",
            "name": lab["lab"],
            "operator": lab["operator"],
            "value": lab["value"],
            "unit": lab["unit"],
            "source_start": lab["source_start"],
            "source_end": lab["source_end"],
            "source_snippet": lab["source_snippet"]
        })
        
    # 5. Inclusion Treatments
    treatments = inclusion_entities.get("prior_treatments", [])
    for treatment in treatments:
        incl_conditions.append({
            "field": "treatment",
            "operator": "required",
            "name": treatment["name"],
            "source_start": treatment["source_start"],
            "source_end": treatment["source_end"],
            "source_snippet": treatment["source_snippet"]
        })
        
    # ---- Exclusions ----
    excl_conditions = []
    
    # 1. Exclusion Drugs
    forbidden_drugs = exclusion_entities.get("forbidden_drugs", [])
    for drug in forbidden_drugs:
        excl_conditions.append({
            "field": "drug",
            "operator": "current_use",
            "name": drug["name"],
            "source_start": drug["source_start"],
            "source_end": drug["source_end"],
            "source_snippet": drug["source_snippet"]
        })
        
    # 2. Exclusion Conditions
    forbidden_conds = exclusion_entities.get("forbidden_conditions", [])
    for cond in forbidden_conds:
        excl_conditions.append({
            "field": "condition",
            "operator": "history",
            "name": cond["name"],
            "source_start": cond["source_start"],
            "source_end": cond["source_end"],
            "source_snippet": cond["source_snippet"]
        })
        
    # 3. Pregnancy
    preg = exclusion_entities.get("pregnancy_excluded", {})
    if preg.get("value"):
        excl_conditions.append({
            "field": "status",
            "operator": "is",
            "name": "pregnant",
            "value": True,
            "source_start": preg.get("source_start", 0),
            "source_end": preg.get("source_end", 0),
            "source_snippet": preg.get("source_snippet", "")
        })
        
    # 4. Prior Conditions (Timed)
    prior_conds = exclusion_entities.get("prior_conditions", [])
    for pc in prior_conds:
        excl_conditions.append({
            "field": "condition",
            "operator": "history_within_months",
            "name": pc["condition"],
            "months": pc["within_months"],
            "source_start": pc["source_start"],
            "source_end": pc["source_end"],
            "source_snippet": pc["source_snippet"]
        })
        
    # 5. Other Exclusions
    # Note: Other exclusions are free-text splits so they don't have exact token match boundaries.
    # For the hackathon, we supply a graceful 0 for these.
    others = exclusion_entities.get("other_exclusions", [])
    for other in others:
        excl_conditions.append({
            "field": "other",
            "operator": "contains",
            "value": other,
            "source_start": 0,
            "source_end": 0,
            "source_snippet": other
        })

    return {
        "inclusion": {
            "logic": "AND",
            "conditions": incl_conditions
        },
        "exclusion": {
            "logic": "OR",
            "conditions": excl_conditions
        }
    }


# ---------------------------------------------------------------------------
# Master Parsing Function
# ---------------------------------------------------------------------------

def parse_trial_criteria(trial_id: str, raw_inclusion_text: str, raw_exclusion_text: str, nlp=None) -> dict:
    """
    Complete NLP pipeline to extract and structure clinical trial criteria.
    Returns the final CriteriaJSON dictionary matching the API contract.
    """
    if nlp is None:
        nlp = load_nlp_pipeline()

    # 1. Extract entities
    incl_entities = extract_inclusion_entities(raw_inclusion_text, nlp=nlp)
    excl_entities = extract_exclusion_entities(raw_exclusion_text, nlp=nlp)

    # 2. Build logic tree
    logic_tree = build_logic_tree(incl_entities, excl_entities)

    # 3. Extract purely structured numeric thresholds for quick filtering
    thresholds = {}
    for lab in incl_entities.get("lab_values", []):
        thresholds[lab["lab"]] = {"operator": lab["operator"], "value": lab["value"], "unit": lab.get("unit", "")}

    # 4. Construct final API payload
    return {
        "trial_id": trial_id,
        "inclusion": logic_tree["inclusion"]["conditions"],
        "exclusion": logic_tree["exclusion"]["conditions"],
        "logic": {
            "inclusion_operator": logic_tree["inclusion"]["logic"],
            "exclusion_operator": logic_tree["exclusion"]["logic"]
        },
        "thresholds": thresholds,
        "raw_text": {
            "inclusion": raw_inclusion_text,
            "exclusion": raw_exclusion_text
        }
    }


# ---------------------------------------------------------------------------
# BioGPT Nuanced Criteria Parser (LLM Fallback)
# ---------------------------------------------------------------------------

def parse_nuanced_criteria_with_biogpt(criteria_text: str) -> list[dict]:
    """
    Uses Microsoft's BioGPT model via HuggingFace transformers to extract structured
    eligibility criteria from nuanced, non-standard clinical text.

    If BioGPT fails to load or prediction times out, gracefully falls back to returning
    an empty list and logs a warning.
    
    Returns
    -------
    list[dict]
        A list of condition dicts parsed from the LLM output.
    """
    import logging
    import json
    try:
        from transformers import pipeline, set_seed
    except ImportError:
        logging.warning("transformers library not found. Run pip install transformers torch. Returning empty list.")
        return []

    logger = logging.getLogger(__name__)

    try:
        # We load pipeline with max_length to prevent timeouts.
        # This pipeline download might take a while on first run.
        generator = pipeline("text-generation", model="microsoft/BioGPT-Large", device=-1)
        set_seed(42)

        prompt = (
            "Extract structured eligibility criteria from this clinical trial text "
            f"as a JSON list of conditions:\nText: {criteria_text}\nJSON:\n["
        )

        response = generator(prompt, max_new_tokens=150, num_return_sequences=1, temperature=0.1)
        output_str = response[0]["generated_text"]

        # Try to parse the output as JSON
        # The prompt ends with "[", so we extract everything after "JSON:\n"
        try:
            json_str = output_str.split("JSON:\n")[-1].strip()
            # It might have generated extra text after the list, so we safely parse
            if not json_str.startswith("["):
                json_str = "[" + json_str
            if json_str.endswith(","):
                json_str = json_str[:-1] + "]"
            
            # Use json loads
            conditions = json.loads(json_str)
            if isinstance(conditions, list):
                return conditions
            else:
                return [conditions] # if it returned a single dict
        except Exception as parse_err:
            logger.warning(f"BioGPT JSON parsing failed: {parse_err}. Raw output: {output_str[:100]}...")
            return []

    except Exception as e:
        logger.warning(f"BioGPT inference failed or timed out: {e}")
        return []


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
    incl_res = extract_inclusion_entities(INCL_SAMPLE, nlp=pipeline)
    print(json.dumps(incl_res, indent=2))

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
    excl_res = extract_exclusion_entities(EXCL_SAMPLE, nlp=pipeline)
    print(json.dumps(excl_res, indent=2))

    # ── Test 4: logic tree builder ────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("SMOKE-TEST 4: build_logic_tree")
    print("=" * 60)
    logic_tree = build_logic_tree(incl_res, excl_res)
    print(json.dumps(logic_tree, indent=2))

    # ── Test 5: master parse_trial_criteria ───────────────────────────────────
    print("\n" + "=" * 60)
    print("SMOKE-TEST 5: parse_trial_criteria")
    print("=" * 60)
    final_payload = parse_trial_criteria("NCT12345678", INCL_SAMPLE, EXCL_SAMPLE, nlp=pipeline)
    print(json.dumps(final_payload, indent=2))


