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

def ensure_dataset():
    """
    Ensures elliptic_txs_features.csv is available on disk.
    If only git-friendly compressed parts exist, reassembles and decompresses them automatically.
    """
    if FEATURES_FILE.exists() and FEATURES_FILE.stat().st_size > 100 * 1024 * 1024:
        return

    part_files = sorted(DATASET_DIR.glob("features.csv.gz.part-*"))
    if part_files:
        import gzip
        import shutil
        print(f"[CryptoForensics] Reassembling {len(part_files)} dataset parts into {FEATURES_FILE.name}...")
        gz_path = DATASET_DIR / "features.csv.gz"
        with open(gz_path, "wb") as f_out:
            for pf in part_files:
                with open(pf, "rb") as f_in:
                    shutil.copyfileobj(f_in, f_out)

        print("[CryptoForensics] Decompressing features archive to disk...")
        with gzip.open(gz_path, "rb") as f_in, open(FEATURES_FILE, "wb") as f_out:
            shutil.copyfileobj(f_in, f_out)

        if gz_path.exists():
            gz_path.unlink()
        print(f"[CryptoForensics] features.csv restored ({FEATURES_FILE.stat().st_size / 1024 / 1024:.2f} MB)")

ensure_dataset()

# Cache paths
SUMMARY_CACHE_FILE = CACHE_DIR / "dataset_summary.json"
TIMESTEPS_CACHE_FILE = CACHE_DIR / "timesteps_summary.json"
DISCOVERY_CACHE_FILE = CACHE_DIR / "discovery_candidates.json"
TIMELINE_ANALYTICS_CACHE_FILE = CACHE_DIR / "timeline_analytics.json"

# ML Model artifact paths
MODEL_FILE = MODELS_DIR / "fraud_detector_ensemble.joblib"
MODEL_METRICS_FILE = MODELS_DIR / "model_metrics.json"

# Server configuration
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

# Visualization limits
MAX_NODES_PER_VIEW = 1200
