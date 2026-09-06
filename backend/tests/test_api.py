"""
Lightweight automated test suite for CryptoForensics API.
Covers core endpoints, dataset queries, transaction lookup, and AI heuristic / taint logic.
"""

import sys
from pathlib import Path
root_dir = Path(__file__).resolve().parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

@pytest.fixture(scope="session")
def client():
    """Session-scoped test client that runs lifespan once."""
    with TestClient(app) as test_client:
        yield test_client


def test_health_endpoint(client):
    """Verify /api/health reports online status and indexed dataset."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert data["dataset_indexed"] is True
    assert data["total_nodes"] == 203769


def test_dataset_summary(client):
    """Verify global metrics summary across the 203,769 transactions and 49 windows."""
    response = client.get("/api/metrics/summary")
    assert response.status_code == 200
    data = response.json()
    assert data["total_transactions"] == 203769
    assert data["illicit_transactions"] == 4545
    assert data["licit_transactions"] == 42019
    assert data["unknown_transactions"] == 157205
    assert data["total_edges"] == 234355
    assert data["total_timesteps"] == 49


def test_valid_transaction_lookup(client):
    """Verify deep drilldown for valid ground-truth illicit transaction #16742787."""
    response = client.get("/api/transaction/16742787")
    assert response.status_code == 200
    data = response.json()
    assert data["tx_id"] == "16742787"
    assert data["label"] == "1"
    assert data["risk_level"] == "CRITICAL"
    assert data["ai_analysis"] is not None
    assert data["ai_analysis"]["risk_score"] >= 0.88
    assert "reasons" in data["ai_analysis"]
    assert len(data["ai_analysis"]["reasons"]) > 0


def test_invalid_transaction_lookup(client):
    """Verify 404 response for nonexistent transaction ID."""
    response = client.get("/api/transaction/nonexistent_tx_999999")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_graph_endpoint(client):
    """Verify graph subgraph extraction for window #1."""
    response = client.get("/api/graph/1?max_nodes=150&include_unknown=true")
    assert response.status_code == 200
    data = response.json()
    assert data["timestep"] == 1
    assert len(data["nodes"]) <= 150
    assert len(data["links"]) > 0
    assert data["illicit_count"] > 0
    # Ensure node schema is complete
    first_node = data["nodes"][0]
    assert "id" in first_node
    assert "risk_level" in first_node
    assert "color" in first_node


def test_ml_prediction_illicit(client):
    """Verify /api/ml/predict correctly classifies ground-truth illicit transaction #16742787."""
    response = client.post("/api/ml/predict", json={"tx_id": "16742787"})
    assert response.status_code == 200
    data = response.json()
    assert data["predicted_class"] in ("1", "Illicit")
    assert data["threat_level"] == "CRITICAL"
    assert data["risk_score"] >= 0.88
    assert data["pattern_detected"] == "ILLICIT_BTC_LAUNDERING_RING"


def test_ml_prediction_licit(client):
    """Verify /api/ml/predict correctly classifies ground-truth licit transaction #13239490."""
    response = client.post("/api/ml/predict", json={"tx_id": "13239490"})
    assert response.status_code == 200
    data = response.json()
    assert data["predicted_class"] in ("2", "Licit")
    assert data["threat_level"] == "LOW"
    assert data["risk_score"] <= 0.20
    assert "LICIT" in data["pattern_detected"] or "EXCHANGE" in data["pattern_detected"] or "COMPLIANT" in data["pattern_detected"]


def test_ml_prediction_unknown_peeling(client):
    """Verify /api/ml/predict detects peeling chain signature on unlabeled transaction #232022460."""
    response = client.post("/api/ml/predict", json={"tx_id": "232022460"})
    assert response.status_code == 200
    data = response.json()
    assert data["pattern_detected"] == "PEELING_CHAIN_OBFUSCATION"
    assert data["threat_level"] == "MODERATE"
    assert 0.50 <= data["risk_score"] <= 0.65


def test_neighbor_taint_behavior(client):
    """Verify /api/ml/predict propagates 1-hop taint to unlabeled transaction #232658952 adjacent to illicit nodes."""
    response = client.post("/api/ml/predict", json={"tx_id": "232658952"})
    assert response.status_code == 200
    data = response.json()
    assert data["pattern_detected"] == "TAINTED_INTERMEDIARY_HOP"
    assert data["threat_level"] in ("HIGH", "CRITICAL")
    assert data["risk_score"] >= 0.70


def test_command_center_intel(client):
    """Verify /api/metrics/command_center returns summary, hotspots, and dynamically evaluated priority targets."""
    response = client.get("/api/metrics/command_center")
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "timesteps" in data
    assert len(data["timesteps"]) == 49
    assert "top_priority_targets" in data
    assert len(data["top_priority_targets"]) > 0
    # Ensure targets are evaluated with real threat levels and scores
    target = data["top_priority_targets"][0]
    assert "tx_id" in target
    assert "risk_score" in target
    assert "risk_level" in target


def test_case_persistence_sqlite(client):
    """Verify SQLite persistence for saving, retrieving, and deleting AML case files."""
    test_case = {
        "caseId": "CF-TEST-999",
        "txId": "16742787",
        "title": "Automated QA Test Case",
        "priority": "CRITICAL",
        "status": "ACTIVE",
        "created": "2026-09-03T12:00:00Z",
        "updated": "2026-09-03T12:00:00Z",
        "notes": "Test notes from automated test suite",
    }
    # 1. Save case
    post_res = client.post("/api/cases", json=test_case)
    assert post_res.status_code == 200
    assert post_res.json()["status"] == "saved"

    # 2. Retrieve cases
    get_res = client.get("/api/cases")
    assert get_res.status_code == 200
    cases = get_res.json()
    assert any(c.get("caseId") == "CF-TEST-999" for c in cases)

    # 3. Clean up / delete case
    del_res = client.delete("/api/cases/CF-TEST-999")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "deleted"


def test_suspicious_discovery(client):
    """Verify /api/discovery/suspicious returns prioritized targets without prior TXID knowledge."""
    response = client.get("/api/discovery/suspicious?timestep=1&limit=5")
    assert response.status_code == 200
    data = response.json()
    assert "candidates" in data
    assert len(data["candidates"]) > 0
    first = data["candidates"][0]
    assert "tx_id" in first
    assert "risk_score" in first
    assert "discovery_category" in first


def test_graph_trace_endpoint(client):
    """Verify /api/graph/trace produces directional multi-hop paths."""
    response = client.get("/api/graph/trace?target_tx=16742787&depth=1&direction=both")
    assert response.status_code == 200
    data = response.json()
    assert data["target_tx"] == "16742787"
    assert data["total_nodes"] > 0
    assert "nodes" in data
    assert "links" in data


def test_ml_metrics_endpoint(client):
    """Verify /api/ml/metrics returns certified model parameters and feature importances."""
    response = client.get("/api/ml/metrics")
    assert response.status_code == 200
    data = response.json()
    assert "HistGradientBoosting" in data["model_name"] or "RandomForest" in data["model_name"]
    assert data["roc_auc"] >= 0.90
    assert data["features_count"] >= 165
    assert len(data["feature_importance_top10"]) > 0


def test_case_sar_report_generation(client):
    """Verify /api/cases/{case_id}/sar compiles a compliant SAR report package."""
    # First save a case
    client.post("/api/cases", json={
        "caseId": "CF-SAR-TEST-1",
        "txId": "16742787",
        "title": "SAR Test Case",
        "priority": "CRITICAL",
        "status": "ACTIVE",
    })
    # Generate SAR report
    response = client.get("/api/cases/CF-SAR-TEST-1/sar")
    assert response.status_code == 200
    report = response.json()
    assert "report_id" in report
    assert report["primary_subject_tx"] == "16742787"
    assert "fiu_compliance_block" in report
    # Cleanup
    client.delete("/api/cases/CF-SAR-TEST-1")


