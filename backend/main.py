from typing import Optional
import csv
import io
import uuid
import os
import shutil
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status
from pydantic import ValidationError

from models.patient import Patient
from models.trial import Trial
from modules.anonymizer import anonymize_patient, parse_trial_pdf, fetch_trial_from_gov

app = FastAPI(
    title="Clinical Trial Matching API",
    description="Endpoints for ingesting and anonymising patients and trials.",
    version="1.0.0",
)

TEMP_DIR = Path("temp_uploads")
TEMP_DIR.mkdir(exist_ok=True)


@app.get("/")
def read_root():
    return {"status": "ok", "message": "Clinical Trial Matching API is running"}


@app.post(
    "/ingest/patient",
    response_model=Patient,
    status_code=status.HTTP_200_OK,
    summary="Ingest and anonymise a patient profile",
)
def ingest_patient(patient: Patient):
    """
    Accepts a complete patient JSON profile.
    Passes it through the Presidio anonymiser to scrub PHI from `history_text`.
    Returns the scrubbed Patient object.
    """
    try:
        # anonymize_patient takes a dict and returns a dict
        patient_dict = patient.model_dump()
        anonymised_dict = anonymize_patient(patient_dict)
        
        # Validate the anonymised dict back into a Pydantic model to ensure 
        # we didn't break the schema during anonymisation
        return Patient(**anonymised_dict)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Anonymisation failed: {str(e)}",
        )


@app.post(
    "/ingest/trial",
    response_model=Trial,
    status_code=status.HTTP_200_OK,
    summary="Ingest a clinical trial from PDF or text",
)
async def ingest_trial(
    title: Optional[str] = Form(None),
    phase: Optional[str] = Form("N/A"),
    sponsor: Optional[str] = Form("Unknown"),
    location: Optional[str] = Form("Unknown"),
    start_date: Optional[str] = Form("1970-01-01"),
    end_date: Optional[str] = Form("2099-12-31"),
    criteria_text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
):
    """
    Accepts trial metadata as Form fields, plus EITHER:
      - `criteria_text`: Raw clinical criteria string
      - `file`: A PDF UploadFile to extract criteria from
      
    Generates a mock NCT ID if none is provided format-wise.
    """
    if not criteria_text and not file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide either 'criteria_text' or a PDF 'file'.",
        )

    extracted_title = ""
    extracted_text = ""

    if file:
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file must be a PDF.",
            )
            
        # Save uploaded file to disk temporarily for pdfplumber
        temp_path = TEMP_DIR / f"{uuid.uuid4()}_{file.filename}"
        try:
            with temp_path.open("wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
                
            # Parse the PDF
            pdf_data = parse_trial_pdf(str(temp_path))
            extracted_title = pdf_data.get("title", "")
            extracted_text = pdf_data.get("criteria_text", "")
            
        finally:
            if temp_path.exists():
                os.remove(temp_path)
    
    # Use provided text/title if available, otherwise fallback to PDF extraction
    final_text = criteria_text if criteria_text else extracted_text
    final_title = title if title else extracted_title

    if not final_title:
        final_title = "Untitled Trial"

    if not final_text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not extract any criteria text from the provided input.",
        )

    # Generate a fake NCT-style ID since we need it for the Pydantic schema
    # The Pydantic model strictly requires format ^NCT\d{8}$
    fake_id_num = str(uuid.uuid4().int)[:8]
    trial_id = f"NCT{fake_id_num}"

    try:
        trial = Trial(
            trial_id=trial_id,
            title=final_title,
            phase=phase,
            sponsor=sponsor,
            location=location,
            start_date=start_date,
            end_date=end_date,
            criteria_text=final_text,
        )
        return trial
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Trial data validation failed: {e.errors()}",
        )


@app.get(
    "/fetch/trial/{nct_id}",
    response_model=Trial,
    status_code=status.HTTP_200_OK,
    summary="Fetch clinical trial criteria from ClinicalTrials.gov",
)
def fetch_trial(nct_id: str):
    """
    Fetches trial metadata and eligibility criteria from ClinicalTrials.gov API v2.
    """
    trial_data = fetch_trial_from_gov(nct_id)
    if "error" in trial_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=trial_data["error"],
        )
    
    try:
        trial = Trial(**trial_data)
        return trial
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Trial data validation failed: {e.errors()}",
        )


@app.post(
    "/ingest/patients/bulk",
    status_code=status.HTTP_200_OK,
    summary="Bulk ingest patients from a CSV file",
)
async def ingest_patients_bulk(file: UploadFile = File(...)):
    """
    Accepts a CSV upload with columns:
        patient_id, age, gender, zip_code, diagnoses (pipe-sep),
        medications (pipe-sep), HbA1c, eGFR, creatinine, history_text

    Each row is parsed into a Patient model, anonymised, and logged.
    Rows that fail validation are skipped and counted.
    """
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must be a .csv",
        )

    content = await file.read()
    text = content.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text))

    results = []
    failed = 0

    for row in reader:
        try:
            # Parse pipe-separated list columns
            diagnoses = [d.strip() for d in row.get("diagnoses", "").split("|") if d.strip()]
            medications = [m.strip() for m in row.get("medications", "").split("|") if m.strip()]

            # Build labs dict from individual CSV columns
            labs: dict[str, float] = {}
            for lab_col in ("HbA1c", "eGFR", "creatinine"):
                raw = row.get(lab_col, "").strip()
                if raw:
                    try:
                        labs[lab_col] = float(raw)
                    except ValueError:
                        pass  # skip unparseable lab values

            patient = Patient(
                patient_id=row["patient_id"].strip(),
                age=int(row["age"]),
                gender=row["gender"].strip(),
                zip_code=row["zip_code"].strip(),
                diagnoses=diagnoses,
                labs=labs,
                medications=medications,
                history_text=row.get("history_text", "").strip(),
            )

            anonymised = anonymize_patient(patient.model_dump())
            results.append(anonymised)

        except Exception:
            failed += 1
            continue

    return {
        "total_uploaded": len(results) + failed,
        "successfully_anonymized": len(results),
        "failed": failed,
        "patients": results,
    }
