from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import logging

# Import our master parser function
from backend.modules.parser import parse_trial_criteria, load_nlp_pipeline

# Initialize FastAPI app
app = FastAPI(
    title="Clinical Trial NLP Engine API",
    description="Extracts structured eligibility criteria from clinical trial text.",
    version="1.0.0"
)

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global NLP pipeline instance
nlp_pipeline = None

@app.on_event("startup")
async def startup_event():
    """Load the heavy NLP pipeline once at startup."""
    global nlp_pipeline
    logger.info("Loading ScispaCy + MedSpaCy NLP pipeline...")
    nlp_pipeline = load_nlp_pipeline()
    logger.info("NLP pipeline loaded successfully.")

# Request Model definitions
class ParseCriteriaRequest(BaseModel):
    trial_id: str = Field(..., description="Unique ID for the clinical trial (e.g. NCT12345678)")
    raw_inclusion_text: str = Field(..., description="Raw text containing inclusion criteria")
    raw_exclusion_text: str = Field(..., description="Raw text containing exclusion criteria")

@app.post("/parse/criteria", response_model=dict)
async def parse_criteria_endpoint(request: ParseCriteriaRequest):
    """
    Parses raw clinical trial inclusion and exclusion criteria text into a structured JSON.
    Returns the complete CriteriaJSON dictionary.
    """
    try:
        # Pass the pre-loaded global NLP pipeline to avoid reloading
        result = parse_trial_criteria(
            trial_id=request.trial_id,
            raw_inclusion_text=request.raw_inclusion_text,
            raw_exclusion_text=request.raw_exclusion_text,
            nlp=nlp_pipeline
        )
        return result
    except Exception as e:
        logger.error(f"Error parsing criteria for {request.trial_id}: {str(e)}")
        raise HTTPException(
            status_code=422,
            detail=f"Failed to parse clinical trial criteria: {str(e)}"
        )
