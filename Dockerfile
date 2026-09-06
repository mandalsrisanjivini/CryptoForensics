# CryptoForensics Production Backend Container for Railway / Cloud Container Deployments
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

# Install Python dependencies
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy dataset, models, and backend code
COPY dataset /app/dataset
COPY models /app/models
COPY backend /app/backend

# Create required cache directories and grant full permissions
RUN mkdir -p /app/backend/cache /tmp && chmod -R 777 /app /tmp

# Pre-assemble and decompress authentic dataset at build time
RUN python -c "from backend.app.config import ensure_dataset; ensure_dataset()"

EXPOSE 8000

# Built-in container healthcheck
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

# Launch FastAPI Uvicorn server binding to dynamic Railway $PORT
CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
