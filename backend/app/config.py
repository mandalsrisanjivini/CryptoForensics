import os
from pathlib import Path

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATASET_DIR = BASE_DIR / "dataset" / "elliptic_bitcoin_dataset"
CACHE_DIR = BASE_DIR / "backend" / "cache"
ML_DIR = BASE_DIR / "backend" / "app" / "ml"
MODELS_DIR = ML_DIR / "models"

# Dataset file paths
CLASSES_FILE = DATASET_DIR / "elliptic_txs_classes.csv"
EDGELIST_FILE = DATASET_DIR / "elliptic_txs_edgelist.csv"
FEATURES_FILE = DATASET_DIR / "elliptic_txs_features.csv"

# Cache paths
SUMMARY_CACHE_FILE = CACHE_DIR / "dataset_summary.json"
TIMESTEPS_CACHE_FILE = CACHE_DIR / "timesteps_summary.json"
DISCOVERY_CACHE_FILE = CACHE_DIR / "discovery_candidates.json"
TIMELINE_ANALYTICS_CACHE_FILE = CACHE_DIR / "timeline_analytics.json"

# ML Model artifact paths
MODEL_FILE = MODELS_DIR / "fraud_detector_ensemble.joblib"
MODEL_METRICS_FILE = MODELS_DIR / "model_metrics.json"

# Server configuration
HOST = "0.0.0.0"
PORT = 8000

# Visualization limits
MAX_NODES_PER_VIEW = 1200
