import json

# 1. 讀取目前的圖資
with open('campus_nodes_edges.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

fix_count = 0
review_count = 0

# 2. 巡迴所有路段
for edge in data.get('edges', []):
    # 【防呆】如果是編輯器手動校正，或 fetch 時強配過的路段，絕對不覆寫
    if edge.get('is_manual') == 1:
        edge['needs_review'] = 0
        continue
        
    raw_slope = edge.get('slope', 0)
    try:
        slope_val = float(raw_slope)
    except (ValueError, TypeError):
        slope_val = 0.0

    # 清洗懸崖 (坡度 > 40%)
    if abs(slope_val) > 0.4:
        edge['slope'] = 0.0
        fix_count += 1
    else:
        edge['slope'] = slope_val

    # 🌟【半自動化最後防線】
    # 經過方案 1~4 的強力運算後，如果這條短於 15m 的路段斜率依然不到 0.5%，
    # 代表這可能是一條隱形的關鍵短坡道，直接標記給前端 God Mode 處理！
    if edge.get('distance', 0) < 15 and abs(edge['slope']) <= 0.005:
        edge['needs_review'] = 1
        review_count += 1
    else:
        edge['needs_review'] = 0

# 3. 寫回檔案 (供前端讀取)
with open('campus_nodes_edges.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"✅ 清洗完成！修復了 {fix_count} 條懸崖路段。")
print(f"🎯 已為 God Mode 標記了 {review_count} 條需人工檢查的極短坡道！")