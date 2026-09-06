import urllib.request
import json

def test_url(url, desc):
    req = urllib.request.urlopen(url)
    content = req.read().decode('utf-8', errors='ignore')
    print(f"PASS: [{req.status}] {desc}")
    return content

# 1. Frontend server
html = test_url('http://localhost:5173/', 'Frontend Home HTML')
assert 'DISCOVER SUSPICIOUS ACTIVITY' in html, 'Missing DISCOVER SUSPICIOUS ACTIVITY in Home HTML'

# 2. Backend health
test_url('http://127.0.0.1:8000/api/health', 'Backend Health')

# 3. Discovery queue with filters
c_all = json.loads(test_url('http://127.0.0.1:8000/api/discovery/suspicious?category=ALL&limit=8', 'Discovery ALL'))
print(f"  Found {len(c_all['candidates'])} candidates in ALL")
assert len(c_all['candidates']) >= 6

c_crit = json.loads(test_url('http://127.0.0.1:8000/api/discovery/suspicious?category=CRITICAL&limit=8', 'Discovery CRITICAL'))
is_all_crit = all(c['risk_level'] == 'CRITICAL' for c in c_crit['candidates'])
print(f"  Found {len(c_crit['candidates'])} candidates in CRITICAL (all critical: {is_all_crit})")
assert is_all_crit

c_low = json.loads(test_url('http://127.0.0.1:8000/api/discovery/suspicious?category=LOW&limit=8', 'Discovery LOW (Licit)'))
is_all_low = all(c['risk_level'] == 'LOW' for c in c_low['candidates'])
print(f"  Found {len(c_low['candidates'])} candidates in LOW (all low: {is_all_low})")
assert is_all_low

# 4. Target #16742787 (Illicit)
tx1 = json.loads(test_url('http://127.0.0.1:8000/api/transaction/16742787', 'Tx #16742787 (Illicit)'))
print(f"  Tx 16742787 Label: {tx1['label']} (Ground Truth Illicit), Timestep: {tx1['timestep']}")
assert tx1['label'] == '1'

# 5. Target #13239490 (Licit)
tx2 = json.loads(test_url('http://127.0.0.1:8000/api/transaction/13239490', 'Tx #13239490 (Licit)'))
print(f"  Tx 13239490 Label: {tx2['label']} (Ground Truth Licit), Timestep: {tx2['timestep']}")
assert tx2['label'] == '2'

# 6. Time periods 1, 25, 43
g1 = json.loads(test_url('http://127.0.0.1:8000/api/graph/1?max_nodes=100', 'Graph Period 1'))
g25 = json.loads(test_url('http://127.0.0.1:8000/api/graph/25?max_nodes=100', 'Graph Period 25'))
g43 = json.loads(test_url('http://127.0.0.1:8000/api/graph/43?max_nodes=100', 'Graph Period 43'))
print(f"  Graph 1 nodes: {len(g1['nodes'])}, Graph 25 nodes: {len(g25['nodes'])}, Graph 43 nodes: {len(g43['nodes'])}")

print("\n>>> ALL SYSTEM REQUIREMENTS DIRECTLY VERIFIED! <<<")
