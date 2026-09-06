# CryptoForensics Production Backend Container
# Multi-platform Python 3.11 container with 100% real dataset & ML model intact
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy complete authentic dataset, ML models, and backend code
COPY dataset /app/dataset
COPY models /app/models
COPY backend /app/backend

# Create cache directory with write permissions
RUN mkdir -p /app/backend/cache /tmp && chmod -R 777 /app/backend/cache /tmp

EXPOSE 8000

# Start FastAPI server on dynamic $PORT
CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
