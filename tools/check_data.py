"""
campus_nodes_edges.json 資料完整性檢查腳本
"""

import json
from collections import defaultdict

FILE_PATH = "C:\code\.vscode\workspace\pd2prj\campus_nodes_edges.json"

# ── 欄位定義 ──────────────────────────────────────────────────────────────────
NODE_REQUIRED_FIELDS = {"id", "lat", "lng", "accessible", "type", "elevation"}
NODE_OPTIONAL_FIELDS = {"name", "category"}
NODE_ALL_FIELDS      = NODE_REQUIRED_FIELDS | NODE_OPTIONAL_FIELDS

EDGE_REQUIRED_FIELDS = {"id", "from", "to", "distance", "slope",
                        "walk", "bike", "ebike", "motorcycle", "car", "tree_shade"}
EDGE_OPTIONAL_FIELDS = {"accessible"}
EDGE_ALL_FIELDS      = EDGE_REQUIRED_FIELDS | EDGE_OPTIONAL_FIELDS

VALID_NODE_TYPES     = {"poi", "intersection", "entrance", "building", "other"}
VALID_TRANSPORT_VALS = {0, 1}

# ── 工具函式 ──────────────────────────────────────────────────────────────────
issues = []

def warn(category, msg):
    issues.append((category, msg))

def section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)

# ── 讀檔 ──────────────────────────────────────────────────────────────────────
with open(FILE_PATH, encoding="utf-8") as f:
    data = json.load(f)

nodes = data.get("nodes", [])
edges = data.get("edges", [])

section("1. 基本統計")
print(f"  nodes 數量 : {len(nodes)}")
print(f"  edges 數量 : {len(edges)}")

# ── 檢查 Nodes ────────────────────────────────────────────────────────────────
section("2. Nodes 欄位完整性")

node_ids = set()
node_id_dupes = []
nodes_missing = defaultdict(list)   # field -> [node_id]
nodes_unknown  = defaultdict(list)  # field -> [node_id]
nodes_null     = defaultdict(list)
nodes_bad_type = []
nodes_bad_coord = []
nodes_bad_elev  = []
nodes_bad_accessible = []

for i, n in enumerate(nodes):
    nid = n.get("id", f"<index {i}>")

    # 重複 id
    if nid in node_ids:
        node_id_dupes.append(nid)
    node_ids.add(nid)

    # 必填欄位缺漏
    for f in NODE_REQUIRED_FIELDS:
        if f not in n:
            nodes_missing[f].append(nid)
        elif n[f] is None:
            nodes_null[f].append(nid)

    # 未知欄位
    for f in n:
        if f not in NODE_ALL_FIELDS:
            nodes_unknown[f].append(nid)

    # 座標合理性（台灣範圍）
    lat = n.get("lat")
    lng = n.get("lng")
    if lat is not None and not (21.0 <= lat <= 26.5):
        nodes_bad_coord.append((nid, "lat", lat))
    if lng is not None and not (119.0 <= lng <= 122.5):
        nodes_bad_coord.append((nid, "lng", lng))

    # elevation 須為數字
    elev = n.get("elevation")
    if elev is not None and not isinstance(elev, (int, float)):
        nodes_bad_elev.append((nid, elev))

    # accessible 須為 bool
    acc = n.get("accessible")
    if acc is not None and not isinstance(acc, bool):
        nodes_bad_accessible.append((nid, acc))

    # type 合法值
    t = n.get("type")
    if t is not None and t not in VALID_NODE_TYPES:
        nodes_bad_type.append((nid, t))

# 輸出 nodes 結果
def report(label, items, limit=10):
    if items:
        sample = list(items)[:limit]
        more   = len(items) - limit if len(items) > limit else 0
        suffix = f"  … 共 {len(items)} 筆" if more else f"  共 {len(items)} 筆"
        print(f"  ⚠  {label}: {sample}{suffix}")
        return len(items)
    else:
        print(f"  ✓  {label}")
        return 0

total_node_issues = 0
total_node_issues += report("重複 id", node_id_dupes)
for f in sorted(NODE_REQUIRED_FIELDS):
    total_node_issues += report(f"缺少必填欄位 '{f}'", nodes_missing[f])
for f in sorted(NODE_REQUIRED_FIELDS):
    total_node_issues += report(f"欄位 '{f}' 為 null", nodes_null[f])
total_node_issues += report("座標超出台灣範圍", nodes_bad_coord)
total_node_issues += report("elevation 型別錯誤", nodes_bad_elev)
total_node_issues += report("accessible 型別錯誤", nodes_bad_accessible)
total_node_issues += report("type 值不合法", nodes_bad_type)
if nodes_unknown:
    for f, ids in sorted(nodes_unknown.items()):
        total_node_issues += report(f"未知欄位 '{f}'", ids)

# ── 檢查 Edges ────────────────────────────────────────────────────────────────
section("3. Edges 欄位完整性")

edge_ids = set()
edge_id_dupes = []
edges_missing = defaultdict(list)
edges_null    = defaultdict(list)
edges_unknown = defaultdict(list)
edges_bad_transport = []
edges_bad_distance  = []
edges_dangling_from = []
edges_dangling_to   = []
edges_self_loop     = []
edges_bad_slope     = []

for i, e in enumerate(edges):
    eid = e.get("id", f"<index {i}>")

    # 重複 id
    if eid in edge_ids:
        edge_id_dupes.append(eid)
    edge_ids.add(eid)

    # 必填欄位缺漏 / null
    for f in EDGE_REQUIRED_FIELDS:
        if f not in e:
            edges_missing[f].append(eid)
        elif e[f] is None:
            edges_null[f].append(eid)

    # 未知欄位
    for f in e:
        if f not in EDGE_ALL_FIELDS:
            edges_unknown[f].append(eid)

    # from/to 必須存在於 node_ids
    src = e.get("from")
    dst = e.get("to")
    if src is not None and src not in node_ids:
        edges_dangling_from.append((eid, src))
    if dst is not None and dst not in node_ids:
        edges_dangling_to.append((eid, dst))

    # self-loop
    if src is not None and dst is not None and src == dst:
        edges_self_loop.append(eid)

    # distance 須為正數
    dist = e.get("distance")
    if dist is not None and (not isinstance(dist, (int, float)) or dist <= 0):
        edges_bad_distance.append((eid, dist))

    # slope 須為數字
    slope = e.get("slope")
    if slope is not None and not isinstance(slope, (int, float)):
        edges_bad_slope.append((eid, slope))

    # 交通旗標須為 0 或 1
    for tf in ("walk", "bike", "ebike", "motorcycle", "car"):
        val = e.get(tf)
        if val is not None and val not in VALID_TRANSPORT_VALS:
            edges_bad_transport.append((eid, tf, val))

# 輸出 edges 結果
total_edge_issues = 0
total_edge_issues += report("重複 id", edge_id_dupes)
for f in sorted(EDGE_REQUIRED_FIELDS):
    total_edge_issues += report(f"缺少必填欄位 '{f}'", edges_missing[f])
for f in sorted(EDGE_REQUIRED_FIELDS):
    total_edge_issues += report(f"欄位 '{f}' 為 null", edges_null[f])
total_edge_issues += report("from 節點不存在 (dangling)", edges_dangling_from)
total_edge_issues += report("to 節點不存在 (dangling)",   edges_dangling_to)
total_edge_issues += report("自環 (from == to)",           edges_self_loop)
total_edge_issues += report("distance 值錯誤 (非正數)",    edges_bad_distance)
total_edge_issues += report("slope 型別錯誤",              edges_bad_slope)
total_edge_issues += report("交通旗標值不合法 (非 0/1)",   edges_bad_transport)
if edges_unknown:
    for f, ids in sorted(edges_unknown.items()):
        total_edge_issues += report(f"未知欄位 '{f}'", ids)

# ── 圖連通性快速檢查 ──────────────────────────────────────────────────────────
section("4. 圖連通性（快速檢查）")

adj = defaultdict(set)
for e in edges:
    src, dst = e.get("from"), e.get("to")
    if src and dst:
        adj[src].add(dst)
        adj[dst].add(src)   # 視為無向圖

# BFS 從任一有 edge 的節點出發
connected_nodes = {n["id"] for n in nodes if n["id"] in adj}
all_node_ids_with_edges = set(adj.keys())

# BFS
if all_node_ids_with_edges:
    start = next(iter(all_node_ids_with_edges))
    visited = set()
    queue = [start]
    while queue:
        cur = queue.pop()
        if cur in visited:
            continue
        visited.add(cur)
        queue.extend(adj[cur] - visited)

    unreachable = all_node_ids_with_edges - visited
    isolated    = node_ids - all_node_ids_with_edges

    print(f"  最大連通分量涵蓋節點 : {len(visited)}")
    print(f"  有 edge 但不連通節點 : {len(unreachable)}")
    if unreachable:
        print(f"    範例: {list(unreachable)[:5]}")
    print(f"  孤立節點（無任何 edge）: {len(isolated)}")
    if isolated:
        print(f"    範例: {list(isolated)[:5]}")
else:
    print("  ⚠  沒有任何有效 edge，無法判斷連通性")

# ── 統計摘要 ──────────────────────────────────────────────────────────────────
section("5. 總結")
total_issues = total_node_issues + total_edge_issues
if total_issues == 0:
    print("  ✅ 未發現問題，資料完整！")
else:
    print(f"  ❌ 共發現 {total_issues} 類問題")
    print(f"     - Nodes 問題: {total_node_issues} 類")
    print(f"     - Edges 問題: {total_edge_issues} 類")

print()