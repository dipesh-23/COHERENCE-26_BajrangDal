"""
Polypharmacy Drug Interaction Checker.
Cross-references trial investigational drugs against patient medications
using the OpenFDA Drug Label API (drug-drug interactions section).
Falls back gracefully if API is unreachable (offline/hackathon mode).
"""

import urllib.request
import urllib.parse
import json
import logging

log = logging.getLogger(__name__)

# Known interaction pairs for offline/fallback mode (curated from clinical databases)
# Format: frozenset({drug_a_keyword, drug_b_keyword}) -> interaction description
KNOWN_INTERACTIONS = {
    frozenset({"semaglutide", "metformin"}): {
        "severity": "LOW",
        "description": "Additive glucose-lowering effect. Monitor for hypoglycemia.",
    },
    frozenset({"semaglutide", "warfarin"}): {
        "severity": "MODERATE",
        "description": "Semaglutide may slow gastric emptying, altering warfarin absorption and increasing INR. Flag for pharmacist review.",
    },
    frozenset({"semaglutide", "lisinopril"}): {
        "severity": "LOW",
        "description": "Both lower blood pressure. Monitor for orthostatic hypotension.",
    },
    frozenset({"pembrolizumab", "methotrexate"}): {
        "severity": "HIGH",
        "description": "Combined immunosuppression risk. PD-1 inhibitors may exacerbate MTX toxicity. Contraindicated by protocol.",
    },
    frozenset({"pembrolizumab", "warfarin"}): {
        "severity": "MODERATE",
        "description": "Immune checkpoint inhibitors may cause hepatitis, altering warfarin metabolism. Monitor INR closely.",
    },
    frozenset({"pembrolizumab", "corticosteroid"}): {
        "severity": "MODERATE",
        "description": "Corticosteroids attenuate PD-1 inhibitor efficacy. Discuss with oncologist.",
    },
    frozenset({"pembrolizumab", "dexamethasone"}): {
        "severity": "MODERATE",
        "description": "Dexamethasone may reduce anti-tumor immune response from pembrolizumab.",
    },
    frozenset({"jak", "methotrexate"}): {
        "severity": "MODERATE",
        "description": "Additive immunosuppression with JAK inhibitor + MTX. Monitor for serious infection risk.",
    },
    frozenset({"tofacitinib", "methotrexate"}): {
        "severity": "MODERATE",
        "description": "Additive immunosuppression. Hepatotoxicity risk elevated.",
    },
    frozenset({"jak", "warfarin"}): {
        "severity": "LOW",
        "description": "JAK inhibitors may alter CYP3A4 pathway. Slight INR variability possible.",
    },
    frozenset({"lenacapavir", "atorvastatin"}): {
        "severity": "MODERATE",
        "description": "CYP3A4 mediated increase in atorvastatin exposure. Risk of myopathy.",
    },
    frozenset({"aducanumab", "aspirin"}): {
        "severity": "MODERATE",
        "description": "Anti-amyloid antibody + antiplatelet agent increases ARIA-H (microhemorrhage) risk on MRI.",
    },
    frozenset({"lecanemab", "aspirin"}): {
        "severity": "HIGH",
        "description": "Anti-amyloid antibody + antiplatelet increases risk of ARIA-H. Antiplatelets often excluded per protocol.",
    },
    frozenset({"lecanemab", "warfarin"}): {
        "severity": "HIGH",
        "description": "Anti-amyloid antibody + anticoagulant is high-risk for intracranial bleeding. Typically excluded.",
    },
    frozenset({"aducanumab", "warfarin"}): {
        "severity": "HIGH",
        "description": "Anti-amyloid antibody + anticoagulant is high-risk for intracranial bleeding. Typically excluded.",
    },
    # Upadacitinib (JAK-1 inhibitor for RA trial)
    frozenset({"upadacitinib", "methotrexate"}): {
        "severity": "MODERATE",
        "description": "Upadacitinib + Methotrexate combination increases immunosuppression. Additive hepatotoxicity risk. Monitor LFTs.",
    },
    frozenset({"upadacitinib", "warfarin"}): {
        "severity": "MODERATE",
        "description": "Upadacitinib inhibits CYP3A4, potentially raising warfarin levels. INR should be closely monitored.",
    },
    frozenset({"upadacitinib", "metoprolol"}): {
        "severity": "LOW",
        "description": "Upadacitinib may slightly increase metoprolol exposure via CYP2D6 inhibition. Monitor heart rate.",
    },
    # Elacestrant (SERD for ER+ Breast Cancer)
    frozenset({"elacestrant", "atorvastatin"}): {
        "severity": "MODERATE",
        "description": "Elacestrant is a CYP3A4/P-gp substrate. Atorvastatin co-administration may increase elacestrant plasma levels. Monitor for toxicity.",
    },
    frozenset({"elacestrant", "warfarin"}): {
        "severity": "MODERATE",
        "description": "CYP2C9-mediated warfarin metabolism may be altered by elacestrant. INR monitoring required.",
    },
}

OPENFDA_URL = "https://api.fda.gov/drug/label.json"


def _normalize(drug_name: str) -> str:
    return drug_name.lower().strip()


def _check_offline(trial_drug: str, patient_medications: list[str]) -> list[dict]:
    """Fallback: use the curated interaction dictionary."""
    flags = []
    td = _normalize(trial_drug)
    for med in patient_medications:
        med_norm = _normalize(med)
        # Look for exact pair or substring match in known pairs
        for pair_set, interaction in KNOWN_INTERACTIONS.items():
            pair_list = list(pair_set)
            if any(td in p or p in td for p in pair_list) and any(med_norm in p or p in med_norm for p in pair_list):
                # Make sure it's about both drugs, not just matching one
                td_matches = any(td in p or p in td for p in pair_list)
                med_matches = any(med_norm in p or p in med_norm for p in pair_list)
                if td_matches and med_matches and td != med_norm:
                    flags.append({
                        "interacting_drug": med,
                        "severity": interaction["severity"],
                        "description": interaction["description"],
                        "source": "curated_db",
                    })
    return flags


def _check_openfda(trial_drug: str, patient_medications: list[str]) -> list[dict]:
    """Call OpenFDA Drug Label API and check for interaction mentions."""
    flags = []
    try:
        query = urllib.parse.quote(f'"{trial_drug}"')
        url = f"{OPENFDA_URL}?search=drug_interactions:{query}&limit=1"
        req = urllib.request.Request(url, headers={"User-Agent": "ClinicalTrialMatcher/1.0"})
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode())
            interactions_text = " ".join(data.get("results", [{}])[0].get("drug_interactions", [])).lower()
            for med in patient_medications:
                if _normalize(med) in interactions_text:
                    flags.append({
                        "interacting_drug": med,
                        "severity": "MODERATE",
                        "description": f"OpenFDA label lists potential interaction between {trial_drug} and {med}. Flag for pharmacist review.",
                        "source": "openfda",
                    })
    except Exception as e:
        log.debug(f"OpenFDA unreachable ({e}), using offline fallback.")
    return flags


def check_drug_interactions(trial_drug: str, patient_medications: list[str]) -> list[dict]:
    """
    Main entry point. Tries OpenFDA first, falls back to curated DB.
    Returns list of interaction flag dicts: [{interacting_drug, severity, description, source}]
    """
    if not trial_drug or not patient_medications:
        return []

    # Try live OpenFDA first
    flags = _check_openfda(trial_drug, patient_medications)

    # If OpenFDA returned nothing, run against curated fallback
    if not flags:
        flags = _check_offline(trial_drug, patient_medications)

    # De-duplicate by interacting_drug
    seen = set()
    deduped = []
    for f in flags:
        key = _normalize(f["interacting_drug"])
        if key not in seen:
            seen.add(key)
            deduped.append(f)

    return deduped
