"""
fix_asymmetric_edges.py
=======================
修正 campus_nodes_edges.json 中因 God Mode 編輯器 Bug 導致的無向邊不一致問題。

【問題根源】
editor.js 的 createEditableEdge() 對每條無向邊 (A↔B) 只渲染一條 polyline，
並透過 Array.find() 綁定 data.edges 陣列中「第一個找到」的有向邊 (edgeData)。

當使用者在 God Mode 修改路權時，只有 edgeData 那條邊被更新，
另一個方向的反向邊保持原始值，造成無向邊兩個方向屬性不一致。

【editor.js 的兩種修改路徑】

路徑1：「套用 Edge 路權」按鈕 (btnApplyBatch)
  → 明確設定 walk/bike/ebike/motorcycle/car（0 或 1）
  → 同時 delete edge.accessible / pedestrian_only / motor_vehicle_allowed
  → 識別標記：修改後的邊「沒有 accessible 欄位」

路徑2：「新增/修改 Edge 屬性」(openAttributeEditor / promptAndApplyAttribute)
  → 可修改任意屬性（如 tree_shade=1）
  → 不刪除 accessible
  → 識別標記：有非預設值的屬性（transport=0 或 tree_shade=1）

【識別「被修改的邊」的規則（按優先順序）】

規則1（accessible 欄位差異）：
  路徑1修改後會 delete accessible，因此：
  - 無 accessible 且對面有 accessible → 無 accessible 的那條是被修改的

規則2（transport 屬性值差異）：
  transport 屬性預設值為 1，被修改為禁止時設為 0：
  - 有 transport=0 且對面沒有 → 有 0 的那條是被修改的

規則3（tree_shade 屬性值差異）：
  tree_shade 預設值為 0，被標記為有樹蔭時設為 1：
  - tree_shade=1 且對面為 0 → tree_shade=1 的那條是被修改的

【需要同步的屬性】
  walk, bike, ebike, motorcycle, car（路權：預設1，被禁=0）
  tree_shade（陰影：預設0，有樹蔭=1）

  不同步：distance, slope（方向性不同）、from/to/id（邊識別資訊）、accessible（識別用途）

【重複邊處理】
  同一方向可能因「建立→修改→再建立」而出現重複邊（相同 from/to）。
  edge_map 記錄每個 (from,to) 的所有邊（非僅最後一條），同步時全部覆蓋。

【驗證結果（對原始資料）】
  564 個非對稱 undirected pairs 全部可由規則精確識別（unknown=0）
  同步後所有無向邊完全對稱
"""

import json
import sys
import shutil
from collections import defaultdict
from datetime import datetime

DATA_FILE = 'campus_nodes_edges.json'
TRANSPORT_KEYS = ['walk', 'bike', 'ebike', 'motorcycle', 'car']
SYNC_KEYS = ['walk', 'bike', 'ebike', 'motorcycle', 'car', 'tree_shade']

# 各屬性的預設值（未修改時的值）
DEFAULTS = {
    'walk': 1, 'bike': 1, 'ebike': 1, 'motorcycle': 1, 'car': 1,
    'tree_shade': 0,
}


def reproduce_editor_bound(edges):
    """
    精確重現 editor.js 的渲染邏輯，找出每個 undirected pair 中
    editor 實際綁定的是哪一條有向邊（index）。

    editor.js 邏輯（data.edges.forEach 按陣列順序）：
      const edgeKey = from < to ? `${from}-${to}` : `${to}-${from}`
      if (!drawnEdges.has(edgeKey)) {
        createEditableEdge(fromNode, toNode)  // nodeA=from, nodeB=to
        drawnEdges.add(edgeKey)
      }
    createEditableEdge 內：
      edgeData = data.edges.find(e =>
        (e.from === nodeA.id && e.to === nodeB.id) ||
        (e.from === nodeB.id && e.to === nodeA.id)
      )
    → 因為 nodeA/nodeB 來自第一個被迭代到的那條邊，find 的結果也是它
    """
    drawn_edges = set()
    bound_map = {}  # (min_id, max_id) -> 被 editor 綁定的邊的 index
    for i, edge in enumerate(edges):
        u, v = edge['from'], edge['to']
        key = (min(u, v), max(u, v))
        if key not in drawn_edges:
            bound_map[key] = i
            drawn_edges.add(key)
    return bound_map


def build_edge_map(edges):
    """
    建立 (from, to) -> [index, ...] 的索引。
    記錄所有邊（含重複），確保同步時不會漏掉重複邊。
    """
    edge_map = defaultdict(list)
    for i, e in enumerate(edges):
        edge_map[(e['from'], e['to'])].append(i)
    return edge_map


def identify_modified_edge(bound_edge, rev_edges_sample):
    """
    根據 editor.js 的修改邏輯，識別非對稱 pair 中哪條邊是被修改的。
    rev_edges_sample: 反方向中的代表邊（用於識別，通常取第一條）

    返回:
        'bound'    ← editor 綁定的那條（bound_edge）是被修改的
        'rev'      ← 反向邊是被修改的（理論上不出現）
        'unknown'  ← 無法識別
    """
    rev_edge = rev_edges_sample

    bound_has_acc = 'accessible' in bound_edge
    rev_has_acc = 'accessible' in rev_edge

    # ── 規則1：accessible 欄位是最強的識別標記 ──────────────────────────────
    # btnApplyBatch 修改後會 delete accessible，反向邊沒被改所以還有 accessible
    if not bound_has_acc and rev_has_acc:
        return 'bound'
    if bound_has_acc and not rev_has_acc:
        # 理論上不應發生（editor 只能修改 bound 邊）
        return 'rev'

    # ── 規則2：transport 非預設值（0）識別 ────────────────────────────────
    # transport 預設為 1，被明確設為 0 才是被修改的
    bound_has_zero = any(bound_edge.get(k, DEFAULTS[k]) == 0 for k in TRANSPORT_KEYS)
    rev_has_zero = any(rev_edge.get(k, DEFAULTS[k]) == 0 for k in TRANSPORT_KEYS)

    if bound_has_zero and not rev_has_zero:
        return 'bound'
    if rev_has_zero and not bound_has_zero:
        return 'rev'

    # ── 規則3：tree_shade 非預設值（1）識別 ───────────────────────────────
    # tree_shade 預設為 0，被標記為有樹蔭時設為 1
    bound_shade = bound_edge.get('tree_shade', DEFAULTS['tree_shade'])
    rev_shade = rev_edge.get('tree_shade', DEFAULTS['tree_shade'])

    if bound_shade > rev_shade:
        return 'bound'
    if rev_shade > bound_shade:
        return 'rev'

    return 'unknown'


def fix_asymmetric_edges(filepath=DATA_FILE):
    print(f"📂 讀取圖資：{filepath}")
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    edges = data['edges']
    print(f"📊 總邊數：{len(edges)}")

    # 備份原始檔案
    backup_path = filepath.replace(
        '.json',
        f'_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
    )
    shutil.copy(filepath, backup_path)
    print(f"💾 已備份原始檔案至：{backup_path}")

    # 建立索引（記錄所有邊，包含重複）
    edge_map = build_edge_map(edges)

    # 重現 editor 的綁定邏輯
    bound_map = reproduce_editor_bound(edges)

    # ── 開始修正 ────────────────────────────────────────────────────────────
    stats = {
        'symmetric': 0,
        'one_way': 0,
        'fixed_rule1': 0,
        'fixed_rule2': 0,
        'fixed_rule3': 0,
        'unknown': 0,
    }
    attrs_synced = 0

    for (min_u, max_u), bound_i in bound_map.items():
        bound_edge = edges[bound_i]
        u, v = bound_edge['from'], bound_edge['to']

        # 取得所有反向邊的 index
        rev_indices = edge_map.get((v, u), [])
        if not rev_indices:
            stats['one_way'] += 1
            continue

        # 用第一條反向邊作為識別的代表
        rev_sample = edges[rev_indices[0]]

        # 檢查是否有需要同步的屬性不一致（與代表邊比較即可）
        is_asym = any(
            bound_edge.get(k, DEFAULTS[k]) != rev_sample.get(k, DEFAULTS[k])
            for k in SYNC_KEYS
        )
        if not is_asym:
            # 還需確認重複邊之間也對稱（例如同方向有兩條，一條已修正一條未修正）
            all_rev_symmetric = all(
                all(
                    bound_edge.get(k, DEFAULTS[k]) == edges[ri].get(k, DEFAULTS[k])
                    for k in SYNC_KEYS
                )
                for ri in rev_indices
            )
            if all_rev_symmetric:
                stats['symmetric'] += 1
                continue

        # 識別哪條邊是被修改的
        which = identify_modified_edge(bound_edge, rev_sample)

        if which == 'unknown':
            stats['unknown'] += 1
            print(f"  ⚠️  無法識別修改方向，略過 pair ({u}, {v})")
            print(f"       bound: {bound_edge}")
            print(f"       rev:   {rev_sample}")
            continue

        # 決定 source（被修改的）和 targets（要被同步的所有反向邊）
        if which == 'bound':
            source_edge = bound_edge
            # 所有反向邊都要同步（處理重複邊）
            target_indices = rev_indices
            # 同時也要把「同方向的重複邊」同步（如果 bound 方向也有重複）
            # bound 方向的其他重複邊（除了 bound_i 以外）
            bound_dir_indices = [i for i in edge_map.get((u, v), []) if i != bound_i]
            target_indices = rev_indices + bound_dir_indices
        else:  # which == 'rev'
            # 反向邊是被修改的：以第一條反向邊為 source，同步到 bound 和其他反向邊
            source_edge = rev_sample
            other_rev = [i for i in rev_indices if i != rev_indices[0]]
            target_indices = [bound_i] + other_rev

        # 同步 sync_keys 屬性值
        for ri in target_indices:
            target_edge = edges[ri]
            for key in SYNC_KEYS:
                src_val = source_edge.get(key, DEFAULTS[key])
                tgt_val = target_edge.get(key, DEFAULTS[key])
                if src_val != tgt_val:
                    target_edge[key] = src_val
                    attrs_synced += 1

        # 記錄使用的規則
        bound_has_acc = 'accessible' in bound_edge
        rev_has_acc = 'accessible' in rev_sample
        if bound_has_acc != rev_has_acc:
            stats['fixed_rule1'] += 1
        elif any(bound_edge.get(k, DEFAULTS[k]) == 0 for k in TRANSPORT_KEYS) != \
             any(rev_sample.get(k, DEFAULTS[k]) == 0 for k in TRANSPORT_KEYS):
            stats['fixed_rule2'] += 1
        else:
            stats['fixed_rule3'] += 1

    # ── 驗證 ─────────────────────────────────────────────────────────────────
    remaining = 0
    remaining_details = []
    seen_pairs = set()
    for i, e in enumerate(edges):
        u, v = e['from'], e['to']
        pair = (min(u, v), max(u, v))
        for ri in edge_map.get((v, u), []):
            rev_e = edges[ri]
            for k in SYNC_KEYS:
                if e.get(k, DEFAULTS[k]) != rev_e.get(k, DEFAULTS[k]):
                    remaining += 1
                    detail_key = (pair, k)
                    if detail_key not in seen_pairs:
                        remaining_details.append((u, v, k, e.get(k, DEFAULTS[k]), rev_e.get(k, DEFAULTS[k])))
                        seen_pairs.add(detail_key)

    # ── 輸出結果 ─────────────────────────────────────────────────────────────
    print()
    print("=" * 57)
    print("  修正結果")
    print("=" * 57)
    print(f"  本來對稱（不需修正）      : {stats['symmetric']:>5} pairs")
    print(f"  單向邊（無反向邊）        : {stats['one_way']:>5} pairs")
    print(f"  用規則1修正（accessible） : {stats['fixed_rule1']:>5} pairs")
    print(f"  用規則2修正（transport=0）: {stats['fixed_rule2']:>5} pairs")
    print(f"  用規則3修正（tree_shade） : {stats['fixed_rule3']:>5} pairs")
    print(f"  無法識別（未動）          : {stats['unknown']:>5} pairs")
    print(f"  同步的屬性值總計          : {attrs_synced:>5} 個")
    print()

    if remaining == 0:
        print("  ✅ 驗證通過：所有無向邊已完全對稱")
    else:
        print(f"  ⚠️  仍有 {remaining} 個屬性不一致，請人工檢查：")
        for u, v, k, fv, rv in remaining_details[:10]:
            print(f"     {u}→{v}  {k}: {fv} vs {rv}")

    # ── 統計牽車路段 ──────────────────────────────────────────────────────────
    walk_pairs = set()
    for e in edges:
        u, v = e['from'], e['to']
        if e.get('walk', 1) == 1 and e.get('bike', 1) == 0:
            walk_pairs.add((min(u, v), max(u, v)))
    print(f"  🚶 需牽車路段（walk=1, bike=0）: {len(walk_pairs)} 條無向邊")
    print("=" * 57)

    # 寫回修正後的 JSON
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"\n💾 修正後的圖資已寫回：{filepath}")


if __name__ == '__main__':
    filepath = sys.argv[1] if len(sys.argv) > 1 else DATA_FILE
    fix_asymmetric_edges(filepath)
