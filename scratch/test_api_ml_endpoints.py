import urllib.request
import json
import time

def test_endpoints():
    base_url = "http://127.0.0.1:8000"
    
    # 1. Test /api/health
    print("\n--- 1. Testing GET /api/health ---")
    req = urllib.request.Request(f"{base_url}/api/health")
    with urllib.request.urlopen(req, timeout=5) as res:
        health_data = json.loads(res.read().decode())
        print(f"Health Status: {res.status} | Response: {health_data}")
        assert health_data.get("status") in ("online", "healthy") and health_data.get("ml_model_loaded") is True

    # 2. Test /api/ml/metrics
    print("\n--- 2. Testing GET /api/ml/metrics ---")
    req = urllib.request.Request(f"{base_url}/api/ml/metrics")
    with urllib.request.urlopen(req, timeout=5) as res:
        metrics_data = json.loads(res.read().decode())
        print(f"Model Name: {metrics_data.get('model_name')}")
        print(f"Features: {metrics_data.get('features_count')} (Raw: {metrics_data.get('raw_features_count')}, Graph: {metrics_data.get('graph_features_count')})")
        print(f"Test ROC-AUC: {metrics_data.get('roc_auc')} | Precision: {metrics_data.get('precision_illicit')} | F1: {metrics_data.get('f1_illicit')}")
        assert metrics_data.get("roc_auc") == 0.9392

    # 3. Test POST /api/ml/predict with required transactions
    test_txs = [
        ("16742787", "known illicit"),
        ("13239490", "known licit"),
        ("94336414", "unknown")
    ]
    
    for tx_id, desc in test_txs:
        print(f"\n--- 3. Testing POST /api/ml/predict for #{tx_id} ({desc}) ---")
        payload = json.dumps({"transaction_id": tx_id}).encode('utf-8')
        req = urllib.request.Request(
            f"{base_url}/api/ml/predict",
            data=payload,
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=5) as res:
            pred = json.loads(res.read().decode())
            print(f"Transaction ID: {pred.get('transaction_id')}")
            print(f"ML Risk Score: {pred.get('ml_risk_score')}/100")
            print(f"Predicted Class: {pred.get('predicted_class')}")
            print(f"Probability: {pred.get('probability')}")
            print(f"Confidence: {pred.get('confidence')}")
            print(f"Model Name: {pred.get('model_name')}")
            print(f"Model Version: {pred.get('model_version')}")
            print(f"Feature Count: {pred.get('feature_count')}")
            print(f"Final Risk Score: {pred.get('final_risk_score')}/100")
            print(f"Top Dominant Features: {[f['feature_name'] for f in (pred.get('dominant_features') or [])[:3]]}")
            assert pred.get("transaction_id") == tx_id
            assert "ml_risk_score" in pred
            assert "predicted_class" in pred
            assert "probability" in pred
            assert "feature_count" in pred

    # 4. Test GET /api/ml/predict?tx_id=16742787
    print("\n--- 4. Testing GET /api/ml/predict?tx_id=16742787 ---")
    req = urllib.request.Request(f"{base_url}/api/ml/predict?tx_id=16742787")
    with urllib.request.urlopen(req, timeout=5) as res:
        pred_get = json.loads(res.read().decode())
        print(f"GET Response Tx: {pred_get.get('transaction_id')} | ML Risk: {pred_get.get('ml_risk_score')} | Class: {pred_get.get('predicted_class')}")
        assert pred_get.get("transaction_id") == "16742787"

    # 5. Test normal investigation flow: GET /api/transaction/16742787
    print("\n--- 5. Testing GET /api/transaction/16742787 ---")
    req = urllib.request.Request(f"{base_url}/api/transaction/16742787")
    with urllib.request.urlopen(req, timeout=5) as res:
        tx_detail = json.loads(res.read().decode())
        ai = tx_detail.get("ai_analysis", {})
        print(f"Tx Detail: #{tx_detail.get('tx_id')} | Final Risk: {ai.get('final_risk_score')} | ML Risk: {ai.get('ml_risk_score')} | Network Risk: {ai.get('network_risk_score')}")
        assert ai.get("final_risk_score") is not None

    print("\nALL API ENDPOINTS VALIDATED SUCCESSFULLY!")

if __name__ == "__main__":
    # Wait a moment for server warmup
    time.sleep(2)
    test_endpoints()
