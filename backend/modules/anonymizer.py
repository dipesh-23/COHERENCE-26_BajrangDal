"""
PHI De-identification Module using Microsoft Presidio

Detects and anonymises Protected Health Information (PHI) from clinical text.

Entities detected (HIPAA-aligned):
    PERSON, PHONE_NUMBER, EMAIL_ADDRESS, DATE_TIME,
    LOCATION, MEDICAL_LICENSE, US_SSN, NRP,
    URL, IP_ADDRESS

Installation (already in requirements.txt):
    pip install presidio-analyzer presidio-anonymizer
    python -m spacy download en_core_web_lg   # Presidio's default NER model
"""

from __future__ import annotations

from presidio_analyzer import AnalyzerEngine, RecognizerRegistry
from presidio_analyzer.nlp_engine import NlpEngineProvider
from presidio_anonymizer import AnonymizerEngine
from presidio_anonymizer.entities import OperatorConfig


# ── PHI entity categories we care about ────────────────────────────────────
PHI_ENTITIES = [
    "PERSON",
    "PHONE_NUMBER",
    "EMAIL_ADDRESS",
    "DATE_TIME",
    "LOCATION",
    "MEDICAL_LICENSE",
    "US_SSN",
    "NRP",           # Nationality / Religion / Political group
    "URL",
    "IP_ADDRESS",
]


def build_analyzer(spacy_model: str = "en_core_web_lg") -> AnalyzerEngine:
    """
    Build and return a Presidio AnalyzerEngine backed by a spaCy NLP model.

    Parameters
    ----------
    spacy_model : str
        Name of the spaCy model to use for NER (default: en_core_web_lg).
        For biomedical text, you can pass "en_core_sci_lg" instead.

    Returns
    -------
    AnalyzerEngine
    """
    nlp_config = {
        "nlp_engine_name": "spacy",
        "models": [{"lang_code": "en", "model_name": spacy_model}],
    }
    provider = NlpEngineProvider(nlp_configuration=nlp_config)
    nlp_engine = provider.create_engine()

    analyzer = AnalyzerEngine(nlp_engine=nlp_engine, supported_languages=["en"])
    return analyzer


def anonymize_text(
    text: str,
    analyzer: AnalyzerEngine | None = None,
    entities: list[str] | None = None,
    replacement_char: str = "*",
    use_labels: bool = True,
) -> dict:
    """
    Detect and anonymise PHI in the given clinical text.

    Parameters
    ----------
    text : str
        Raw clinical text potentially containing PHI.
    analyzer : AnalyzerEngine, optional
        Pre-built Presidio analyzer. One is created automatically if not provided.
    entities : list[str], optional
        PHI entity types to detect. Defaults to PHI_ENTITIES list above.
    replacement_char : str
        Character to use for masking (ignored when use_labels=True).
    use_labels : bool
        If True, replaces PHI with a label placeholder like <PERSON>.
        If False, replaces with replacement_char repeated to same length.

    Returns
    -------
    dict with keys:
        original_text   : str   — input text
        anonymized_text : str   — text with PHI replaced
        detections      : list  — [{entity_type, start, end, score, original}]
    """
    if analyzer is None:
        analyzer = build_analyzer()

    if entities is None:
        entities = PHI_ENTITIES

    # Step 1: Detect PHI
    results = analyzer.analyze(text=text, entities=entities, language="en")

    # Step 2: Build operator map
    anonymizer_engine = AnonymizerEngine()

    if use_labels:
        # Replace with <ENTITY_TYPE> labels (e.g. <PERSON>, <DATE_TIME>)
        operators = {
            ent: OperatorConfig("replace", {"new_value": f"<{ent}>"})
            for ent in entities
        }
    else:
        # Mask with repeated replacement_char
        operators = {
            ent: OperatorConfig("mask", {
                "type": "mask",
                "masking_char": replacement_char,
                "chars_to_mask": 100,
                "from_end": False,
            })
            for ent in entities
        }

    anonymized = anonymizer_engine.anonymize(
        text=text,
        analyzer_results=results,
        operators=operators,
    )

    # Step 3: Build detection summary
    detections = [
        {
            "entity_type": r.entity_type,
            "start":       r.start,
            "end":         r.end,
            "score":       round(r.score, 3),
            "original":    text[r.start:r.end],
        }
        for r in sorted(results, key=lambda x: x.start)
    ]

    return {
        "original_text":   text,
        "anonymized_text": anonymized.text,
        "detections":      detections,
    }


def redact_patient_record(record: dict, fields_to_check: list[str] | None = None) -> dict:
    """
    Anonymise all string fields in a patient record dict.

    Parameters
    ----------
    record : dict
        A patient record (e.g. loaded from FHIR / Synthea JSON).
    fields_to_check : list[str], optional
        Specific keys to anonymise. If None, all string-valued fields are processed.

    Returns
    -------
    dict — copy of the record with PHI fields anonymised.
    """
    analyzer = build_analyzer()
    redacted = dict(record)

    keys = fields_to_check if fields_to_check else [k for k, v in record.items() if isinstance(v, str)]

    for key in keys:
        if key in redacted and isinstance(redacted[key], str):
            result = anonymize_text(redacted[key], analyzer=analyzer)
            redacted[key] = result["anonymized_text"]

    return redacted


# ---------------------------------------------------------------------------
# Smoke-test
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import json

    SAMPLE = (
        "Patient John Doe, DOB 12/03/1985, SSN 123-45-6789, "
        "residing at 42 Maple Street, Boston, MA. "
        "Contact: john.doe@email.com or +1-800-555-0199. "
        "Diagnosed with Type 2 Diabetes by Dr. Smith on January 5, 2024."
    )

    print("=" * 60)
    print("ANONYMIZER SMOKE-TEST")
    print("=" * 60)
    print("Original:\n", SAMPLE)

    analyzer = build_analyzer(spacy_model="en_core_web_lg")
    result   = anonymize_text(SAMPLE, analyzer=analyzer)

    print("\nAnonymised:\n", result["anonymized_text"])
    print("\nDetections:")
    print(json.dumps(result["detections"], indent=2))
