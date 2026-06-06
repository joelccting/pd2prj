import json
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Read the graph file used by the backend.
with open('campus_nodes_edges.json', encoding='utf-8') as f:
    data = json.load(f)

print(f"✅ 總節點數: {len(data.get('nodes', []))}")

# Show first node
first_node = data['nodes'][0]
print(f"✅ 第一個節點: {first_node.get('name')} - 分類: {first_node.get('category')}")

# Count categories
categories = {}
for node in data.get('nodes', []):
    cat = node.get('category', 'unknown')
    categories[cat] = categories.get(cat, 0) + 1

print("\n✅ 分類統計:")
for cat, count in sorted(categories.items()):
    print(f"  {cat}: {count} 個節點")
