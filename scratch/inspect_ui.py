import re

def inspect():
    html = open('frontend/index.html', encoding='utf-8').read()
    
    # 1. Check headings
    headings = re.findall(r'<(h[1-6])[^>]*>(.*?)</\1>', html, re.DOTALL)
    print("=== HEADINGS IN INDEX.HTML ===")
    for tag, content in headings:
        clean = re.sub(r'<[^>]+>', '', content).strip()
        is_all_caps = clean.isupper() and len(clean) > 4
        print(f"{tag}: {'[ALL CAPS] ' if is_all_caps else ''}{clean}")

    # 2. Check mono class on non-technical elements
    print("\n=== MONO CHECK ===")
    mono_tags = re.findall(r'<([a-zA-Z0-9]+)[^>]*class="([^"]*mono[^"]*)"[^>]*>(.*?)</\1>', html, re.DOTALL)
    for tag, cls, content in mono_tags[:40]:
        clean = re.sub(r'<[^>]+>', '', content).strip()
        if len(clean) > 0:
            print(f"<{tag} class='{cls}'>: {clean[:40]}")

if __name__ == "__main__":
    inspect()
