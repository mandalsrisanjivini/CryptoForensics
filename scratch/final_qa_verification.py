import urllib.request
import json

def run_qa():
    base_url = "http://127.0.0.1:8000"
    frontend_url = "http://localhost:5173"
    
    print("=== FINAL QA VERIFICATION ===")
    
    # 1. Health
    with urllib.request.urlopen(f"{base_url}/api/health", timeout=5) as res:
        health = json.loads(res.read().decode())
        print(f"1. Health Check: OK ({health.get('status')}, {health.get('total_nodes')} nodes, ml_model_loaded={health.get('ml_model_loaded')})")
        assert health.get('ml_model_loaded') is True

    # 2. Test Real Transactions
    tx_tests = [
        ("16742787", "Illicit", 90),
        ("13239490", "Licit", 25),
        ("94336414", "Licit", 25),
    ]
    for tx_id, expected_class, risk_thresh in tx_tests:
        # POST
        payload = json.dumps({"transaction_id": tx_id}).encode('utf-8')
        req = urllib.request.Request(f"{base_url}/api/ml/predict", data=payload, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=5) as res:
            pred = json.loads(res.read().decode())
            print(f"2. Predict #{tx_id}: Class={pred.get('predicted_class')}, ML Risk={pred.get('ml_risk_score')}/100, Final Risk={pred.get('final_risk_score')}/100, Features={pred.get('feature_count')}")
            assert pred.get('transaction_id') == tx_id
            assert pred.get('predicted_class') == expected_class
            assert pred.get('feature_count') == 172

        # GET
        with urllib.request.urlopen(f"{base_url}/api/ml/predict?tx_id={tx_id}", timeout=5) as res:
            pred_get = json.loads(res.read().decode())
            assert pred_get.get('transaction_id') == tx_id

    # 3. Graph Endpoints (verify Period 1 & 25 edges)
    for p in [1, 25]:
        with urllib.request.urlopen(f"{base_url}/api/graph/{p}?max_nodes=600", timeout=5) as res:
            g = json.loads(res.read().decode())
            print(f"3. Graph Period {p}: {len(g.get('nodes', []))} nodes, {len(g.get('edges', []))} real edges")
            assert len(g.get('nodes', [])) > 0
            assert len(g.get('edges', [])) > 0

    # 4. Timeline
    with urllib.request.urlopen(f"{base_url}/api/analytics/timeline", timeout=5) as res:
        tl = json.loads(res.read().decode())
        print(f"4. Timeline: {len(tl.get('periods', []))} periods loaded")
        assert len(tl.get('periods', [])) == 49

    # 5. Discovery
    with urllib.request.urlopen(f"{base_url}/api/discovery/suspicious?category=CRITICAL&limit=10", timeout=5) as res:
        disc = json.loads(res.read().decode())
        print(f"5. Discovery: {len(disc.get('candidates', []))} critical candidates returned")
        assert len(disc.get('candidates', [])) > 0

    # 6. Frontend Dev Server Check
    with urllib.request.urlopen(frontend_url, timeout=5) as res:
        html = res.read().decode('utf-8')
        print(f"6. Frontend Dev Server: Status 200, HTML Length: {len(html)}")
        assert "CryptoForensics" in html
        assert "Threat Radar" in html
        assert "Offline ML Model Specifications" in html

    print("\nALL QA CHECKS PASSED PERFECTLY!")

if __name__ == "__main__":
    run_qa()
