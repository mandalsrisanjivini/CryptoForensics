import httpx
import re

client = httpx.Client(follow_redirects=True, timeout=10.0)
base = "https://frontend-delta-wine-77.vercel.app"
routes = ["/", "/investigate", "/network", "/timeline", "/cases", "/reports", "/data"]

print("=== VERCEL DIRECT ROUTE TESTING ===")
all_passed = True
for r in routes:
    resp = client.get(base + r)
    status_str = "PASS" if resp.status_code == 200 else "FAIL"
    if resp.status_code != 200:
        all_passed = False
    print(f"Route {r:15} -> HTTP {resp.status_code} [{status_str}] ({len(resp.content)} bytes)")

print("\n=== VERCEL ASSET RESOLUTION TESTING ===")
html = client.get(base).text
matches = re.findall(r'/assets/[a-zA-Z0-9_\-\.]+', html)
for m in set(matches):
    asset_resp = client.get(base + m)
    status_str = "PASS" if asset_resp.status_code == 200 else "FAIL"
    print(f"Asset {m:35} -> HTTP {asset_resp.status_code} [{status_str}] (Content-Type: {asset_resp.headers.get('content-type')})")

print(f"\nAll Direct Routes Verified: {all_passed}")
