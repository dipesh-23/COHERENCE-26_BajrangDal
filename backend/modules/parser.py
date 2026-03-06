

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
    nlp = spacy.load("en_core_sci_sm")

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
# Quick smoke-test
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    TEST_SENTENCE = (
        "Patient must be 18-65 years old with HbA1c > 7% "
        "and diagnosed with Type 2 Diabetes (ICD E11.9)"
    )
    print("Input:", TEST_SENTENCE)
    pipeline = load_nlp_pipeline()
    parse_clinical_text(TEST_SENTENCE, pipeline)