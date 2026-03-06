def evaluate_eligibility(hard_pass, soft_score):
    """
    Combines hard filter + soft similarity score
    """

    if not hard_pass:
        return {
            "match_score": 0,
            "confidence": 0,
            "status": "Not Eligible"
        }

    return {
        "match_score": round(soft_score * 100, 2),
        "confidence": round(soft_score, 2),
        "status": "Eligible"
    }