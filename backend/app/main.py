import os
import time
from contextlib import asynccontextmanager
from typing import Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware

from . import case_store
from .data_processor import DataProcessor
from .dataset_service import DatasetService
from .models import (
    DatasetSummary,
    TimestepSummary,
    GraphResponse,
    TransactionDetail,
    PredictionRequest,
    PredictionResponse,
    CommandCenterIntel,
    DiscoveryResponse,
    TraceResponse,
    TimelineAnalyticsResponse,
    ModelInfoResponse,
    DatasetProvenanceResponse,
)
from .ml.predictor_interface import ForensicAnalystEngine

# Initialize singletons
processor = DataProcessor()
service = DatasetService(processor)
ai_engine = ForensicAnalystEngine()

@asynccontextmanager
async def lifespan(app: FastAPI):
    start_t = time.time()
    print("================================================================")
    print("  Initializing CryptoForensics Memory-Safe Investigation Engine ")
    print("================================================================")
    processor.build_or_load_index()
    ai_engine.load_model()
    elapsed = time.time() - start_t
    print(f"[CryptoForensics] Initialization complete in {elapsed:.2f}s!")
    yield
    print("[CryptoForensics] Shutting down...")

app = FastAPI(
    title="CryptoForensics API // Cyber Intelligence Command",
    description="3D Cyber-Forensics & Anti-Money Laundering Intelligence Engine for Bitcoin (SIH 26146)",
    version="2.1.0",
    lifespan=lifespan,
)

allowed_origins_env = os.getenv("ALLOWED_ORIGINS")
allowed_origins = [orig.strip() for orig in allowed_origins_env.split(",") if orig.strip()] if allowed_origins_env else [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "system": "CryptoForensics API // SIH 26146 Workstation",
        "status": "Online",
        "version": "2.1.0",
        "dataset": "Elliptic Bitcoin Dataset (MIT-IBM Watson AI Lab)",
        "total_indexed_transactions": len(processor.classes),
        "temporal_windows": 49,
        "docs_url": "/docs",
        "health_url": "/api/health"
    }

@app.get("/health")
@app.get("/api/health")
async def health_check():
    return {
        "status": "online",
        "system": "CryptoForensics Cyber Command",
        "dataset_indexed": processor.is_indexed,
        "total_nodes": len(processor.classes),
        "ml_model_loaded": (ai_engine.model is not None),
    }

@app.get("/api/metrics/command_center", response_model=CommandCenterIntel)
async def get_command_center_intel():
    """Returns comprehensive command center metrics, 49-window risk timeline, hotspots, and top targets."""
    return service.get_command_center_intel()

@app.get("/api/metrics/summary", response_model=DatasetSummary)
async def get_summary():
    """Returns total transactions, illicit, licit, unknown counts, total edges, and timesteps."""
    return service.get_summary()

@app.get("/api/metrics/timesteps", response_model=list[TimestepSummary])
async def get_timesteps():
    """Returns metrics for all 49 timesteps."""
    return service.get_timesteps()

@app.get("/api/analytics/timeline", response_model=TimelineAnalyticsResponse)
async def get_timeline_analytics():
    """Returns detailed 49-period analytics with narrative historical context."""
    return service.get_timeline_analytics()

@app.get("/api/discovery/suspicious", response_model=DiscoveryResponse)
async def get_suspicious_discovery(
    timestep: Optional[int] = Query(default=None, ge=1, le=49),
    limit: int = Query(default=30, ge=5, le=200),
    category: Optional[str] = Query(default=None),
):
    """
    Automated Suspicious Transaction Discovery Queue.
    Enables investigators to find illicit targets, peeling chains, and mixer hubs without knowing TXIDs.
    """
    return service.get_suspicious_discovery(timestep=timestep, limit=limit, category=category)

@app.get("/api/graph/trace", response_model=TraceResponse)
async def get_graph_trace(
    target_tx: str = Query(..., description="Bitcoin transaction ID to trace"),
    depth: int = Query(default=2, ge=1, le=3),
    direction: str = Query(default="both", description="'forward', 'backward', or 'both'"),
):
    """Directional multi-hop path tracing for source-of-funds (backward) and fund dispersal (forward)."""
    res = service.get_graph_trace(target_tx=target_tx, depth=depth, direction=direction)
    if res.total_nodes == 0:
        raise HTTPException(status_code=404, detail=f"Transaction '{target_tx}' not found for tracing")
    return res

@app.get("/api/graph/{timestep}", response_model=GraphResponse)
async def get_timestep_graph(
    timestep: int,
    max_nodes: int = Query(default=1200, ge=50, le=5000),
    include_unknown: bool = Query(default=True),
    target_tx: Optional[str] = Query(default=None, description="Optional target transaction to prioritize in subgraph"),
):
    """Returns 3D graph nodes and directed links for a specific timestep (1 to 49)."""
    if timestep < 1 or timestep > 49:
        raise HTTPException(status_code=400, detail="Timestep must be between 1 and 49")
    
    return service.get_timestep_graph(
        timestep=timestep,
        max_nodes=max_nodes,
        include_unknown=include_unknown,
        target_tx=target_tx,
    )

@app.get("/api/transaction/{tx_id}", response_model=TransactionDetail)
async def get_transaction(tx_id: str):
    """Returns deep forensic metadata, real AI analysis, risk score, in/out degree, and neighbor nodes."""
    detail = service.get_transaction_detail(tx_id)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Transaction '{tx_id}' not found in dataset")
    return detail

@app.post("/api/ml/predict", response_model=PredictionResponse)
async def predict_fraud(req: PredictionRequest):
    """Real AI Forensic Analyst inference endpoint."""
    tx_id = req.target_tx_id or "UNKNOWN"
    timestep = processor.tx_timesteps.get(tx_id, 1)
    label = processor.classes.get(tx_id, "unknown")
    feats = req.features or processor.get_transaction_features(tx_id) or []
    
    all_edges = processor.timestep_edges.get(timestep, [])
    upstream = [t1 for t1, t2 in all_edges if t2 == tx_id]
    downstream = [t2 for t1, t2 in all_edges if t1 == tx_id]
    neighbor_labels = {nid: processor.classes.get(nid, "unknown") for nid in (upstream + downstream)}

    return ai_engine.predict(
        tx_id=tx_id,
        label=label,
        timestep=timestep,
        in_degree=len(upstream),
        out_degree=len(downstream),
        features=feats,
        upstream_txs=upstream,
        downstream_txs=downstream,
        neighbor_labels=neighbor_labels,
    )

@app.get("/api/ml/predict", response_model=PredictionResponse)
async def predict_fraud_get(
    tx_id: Optional[str] = Query(None, alias="tx_id"),
    transaction_id: Optional[str] = Query(None, alias="transaction_id"),
):
    """GET endpoint for Real ML model prediction."""
    target_id = transaction_id or tx_id or "UNKNOWN"
    req = PredictionRequest(tx_id=target_id, transaction_id=target_id)
    return await predict_fraud(req)

@app.get("/api/ml/metrics", response_model=ModelInfoResponse)
async def get_ml_metrics():
    """Returns certified Random Forest model metrics (ROC-AUC 0.938) and feature importances."""
    return service.get_model_info()

@app.get("/api/dataset/provenance", response_model=DatasetProvenanceResponse)
async def get_dataset_provenance():
    """Returns full dataset provenance and ethical research boundaries."""
    return service.get_dataset_provenance()

# Case Management & SAR Report Endpoints
@app.get("/api/cases")
async def list_persisted_cases():
    """Retrieve all persisted forensic AML case files from SQLite."""
    return case_store.get_all_cases()

@app.post("/api/cases")
async def save_persisted_case(req: Dict[str, Any] = Body(...)):
    """Persist or update an AML forensic case file into SQLite."""
    case_store.save_case(req)
    return {"status": "saved", "case_id": req.get("caseId")}

@app.get("/api/cases/{case_id}")
async def get_persisted_case(case_id: str):
    """Retrieve a single AML case file with full evidence locker."""
    case = case_store.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case file not found")
    return case

@app.delete("/api/cases/{case_id}")
async def delete_persisted_case(case_id: str):
    """Delete an AML case file from SQLite by ID."""
    deleted = case_store.delete_case(case_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Case file not found")
    return {"status": "deleted", "case_id": case_id}

@app.post("/api/cases/{case_id}/evidence")
async def add_case_evidence(case_id: str, evidence_item: Dict[str, Any] = Body(...)):
    """Pin an evidence item (graph node, path trace, or AI insight) to an active case."""
    updated_case = case_store.add_evidence_to_case(case_id, evidence_item)
    if not updated_case:
        raise HTTPException(status_code=404, detail="Case file not found")
    return {"status": "evidence_pinned", "case": updated_case}

@app.get("/api/cases/{case_id}/sar")
async def get_case_sar_report(case_id: str):
    """Generates a structured FinCEN/FIU compliant Suspicious Activity Report (SAR) for the case."""
    report = case_store.generate_sar_report(case_id)
    if not report:
        raise HTTPException(status_code=404, detail="Case file not found")
    return report
