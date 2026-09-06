# CryptoForensics: 3D Bitcoin Anti-Money Laundering (AML) Platform

An advanced cyber-forensics platform built on the **Elliptic Bitcoin Dataset** (MIT-IBM Watson AI Lab & Elliptic). Combines a memory-efficient Python streaming backend with an interactive Three.js 3D force-directed graph dashboard.

---

## Key Highlights

- **Untouched Dataset**: The original CSV files in `dataset/elliptic_bitcoin_dataset/` are preserved in read-only mode.
- **Zero-Bloat Streaming I/O**: The 690MB `elliptic_txs_features.csv` is indexed without loading the entire matrix into memory (<100MB RAM usage).
- **Interactive 3D WebGL Visualization**: Three.js force-directed graph with animated Bitcoin flow particles, glowing illicit node halos, and orbit controls.
- **Complete Dataset Metrics**:
  - **Total Transactions**: 203,769
  - **Illicit Transactions**: 4,545 (2.23%)
  - **Licit Transactions**: 42,019 (20.62%)
  - **Unknown Transactions**: 157,205 (77.15%)
  - **Directed Payment Edges**: 234,355
  - **Temporal Strata**: 49 Discrete Time Steps
- **Interpretable AI Engine & Model-Ready Slot**: Operating via expert rule-based heuristic and topological taint propagation; modular architecture is model-ready for future PyTorch-Geometric / GCN / GAT / XGBoost weights.

---

## Quick Start (How to Run)

### Option 1: Single-Click Launcher (Windows)
Double-click:
```bat
start.bat
```

---

### Option 2: Running via Terminal (Manual)

#### 1. Start the Backend API (FastAPI)
```bash
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- Health Check: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

#### 2. Start the Frontend Dashboard (Vite + Three.js)
In a new terminal window:
```bash
cd frontend
npm run dev
```
- Web Application: [http://localhost:5173](http://localhost:5173)

---

## Directory Structure

```
CryptoForensics/
├── dataset/
│   └── elliptic_bitcoin_dataset/          # Elliptic Bitcoin Dataset (MIT-IBM Watson AI Lab)
│       ├── elliptic_txs_classes.csv
│       ├── elliptic_txs_edgelist.csv
│       └── elliptic_txs_features.csv
├── backend/
│   ├── app/
│   │   ├── config.py                      # Dataset paths & parameters
│   │   ├── data_processor.py              # Memory-safe streaming byte-seek parser
│   │   ├── dataset_service.py             # Subgraph query engine & intelligence aggregator
│   │   ├── case_store.py                  # SQLite case persistence engine
│   │   ├── models.py                      # Pydantic schemas
│   │   ├── main.py                        # FastAPI REST endpoints
│   │   └── ml/
│   │       └── predictor_interface.py     # Expert heuristic & taint engine (GNN slot ready)
│   ├── tests/
│   │   └── test_api.py                    # Automated pytest suite (11 tests)
│   ├── scripts/
│   │   └── process_data.py                # Standalone ingestion & seek verification
│   └── requirements.txt
├── frontend/
│   ├── index.html                         # Professional AML Forensic Workstation
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── style.css                      # Modern dark-mode enterprise styling
│       ├── main.js                        # App orchestrator & workflow coordinator
│       ├── components/
│       │   ├── ForensicCaseManager.js     # Case lifecycle, notes, checklist, SAR reports
│       │   ├── ForensicCommandCenter.js   # Global network intelligence & strata chart
│       │   ├── ForensicIntelligencePanel.js # Risk scoring, why flagged, & multi-hop flow
│       │   ├── InvestigationControls.js   # Search, segmented filters, priority targets
│       │   ├── InvestigationTimeline.js   # 49-window timeline navigator
│       │   └── CommandTelemetry.js        # Global summary telemetry
│       └── visualization/
│           └── ThreeForensicGraph.js      # Three.js 3D WebGL graph engine
├── start.bat                              # 1-click dual launcher
├── run_backend.bat                        # Backend launcher
└── run_frontend.bat                       # Frontend launcher
```
