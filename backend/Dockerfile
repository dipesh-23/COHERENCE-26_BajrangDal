# ── Backend Dockerfile ────────────────────────────────────────────────────────
FROM python:3.12-slim

# System deps for spaCy / presidio
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential libgomp1 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download the smallest spaCy model for Presidio NER
RUN python -m spacy download en_core_web_sm

# Copy application source
COPY . .

# Expose FastAPI port
EXPOSE 8000

# Start production server (4 workers)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
