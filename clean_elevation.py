import json

# 1. 讀取目前的圖資
with open('campus_nodes_edges.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

fix_count = 0

# 2. 巡迴所有路段，加入型態防呆
for edge in data['edges']:
    raw_slope = edge.get('slope', 0)
    
    try:
        # 強制將字串轉換為浮點數，確保數學比較不會出錯
        slope_val = float(raw_slope)
    except (ValueError, TypeError):
        slope_val = 0.0 # 如果裡面是不明亂碼，直接歸零

    # 如果坡度超過 15% (0.15) 或是負超過 -15%
    if abs(slope_val) > 0.4:
        edge['slope'] = 0.0
        fix_count += 1
    else:
        # 將正常的數值存回去 (確保它變成數字，不再是字串)
        edge['slope'] = slope_val

# 3. 🌟 直接覆蓋原檔案 (這樣前端才讀得到！)
with open('campus_nodes_edges.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"✅ 清洗完成！共修復了 {fix_count} 條異常的懸崖路段。")