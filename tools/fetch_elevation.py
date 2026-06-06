import json
import requests
import math
import time
from collections import defaultdict

DATA_FILE = "campus_nodes_edges.json"

def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def fetch_elevations_mapzen(nodes):
    """【方案一 & 方案二】Mapzen 開放資料集 + Cubic 三次內插法"""
    print(f"🌍 準備向 OpenTopoData 請求 {len(nodes)} 個節點的高程資料...")
    node_dict = {node['id']: node for node in nodes}
    node_list = list(nodes)
    
    # 每次請求 100 個點（免費 API 上限）
    batch_size = 100
    for i in range(0, len(node_list), batch_size):
        batch = node_list[i : i + batch_size]
        # 格式化為 API 需要的: lat,lng|lat,lng...
        loc_str = "|".join([f"{n['lat']},{n['lng']}" for n in batch])
        
        print(f"⏳ 正在抓取第 {i+1} 到 {min(i+batch_size, len(node_list))} 筆資料...")
        try:
            # 💡 核心技巧：加上 interpolation=cubic，讓伺服器端幫我們完成雙線性/三次內插！
            url = f"https://api.opentopodata.org/v1/mapzen?locations={loc_str}&interpolation=cubic"
            response = requests.get(url)
            response.raise_for_status()
            
            results = response.json().get('results', [])
            for idx, res in enumerate(results):
                node_id = batch[idx]['id']
                node_dict[node_id]['elevation'] = res.get('elevation', 0.0) or 0.0
                
        except Exception as e:
            print(f"❌ 抓取失敗: {e}")
            
        time.sleep(1.5) # 遵守 API Rate Limit，避免被 Ban
        
    return node_dict

def process_graph():
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    nodes = data.get('nodes', [])
    edges = data.get('edges', [])
    
    # 建立「相鄰節點關係表」（為方案三做準備）
    adj_list = defaultdict(list)
    for e in edges:
        adj_list[e['from']].append(e['to'])
        adj_list[e['to']].append(e['from'])

    # 執行高程抓取
    node_dict = fetch_elevations_mapzen(nodes)
    print("🔄 正在重新計算所有路段的精準坡度...")

    for edge in edges:
        # 保護機制：如果是你在編輯器(God Mode)手動確認過的路段，絕對不覆寫！
        if edge.get('is_manual') == 1:
            continue

        u_id = edge.get('from')
        v_id = edge.get('to')
        
        if u_id in node_dict and v_id in node_dict:
            node_u = node_dict[u_id]
            node_v = node_dict[v_id]
            
            # 重新計算精準距離
            real_dist = haversine_distance(node_u['lat'], node_u['lng'], node_v['lat'], node_v['lng'])
            edge['distance'] = round(real_dist, 2)
            
            # ----------------------------------------------------
            # 【方案四】語意強配坡度 (Semantic Override)
            # 無需網路請求，直接看屬性判斷人造設施！
            # ----------------------------------------------------
            edge_name = edge.get('name', '')
            edge_type = edge.get('type', '')
            
            if '階梯' in edge_name or 'steps' in edge_type.lower():
                edge['slope'] = 0.15 # 階梯大約 15% 坡度
                edge['is_manual'] = 1 # 標記為系統強配，後續不再變動
                continue
            elif '坡道' in edge_name or 'ramp' in edge_type.lower():
                edge['slope'] = 0.08 # 法定無障礙坡道約 8%
                edge['is_manual'] = 1
                continue
            
            # ----------------------------------------------------
            # 計算基礎坡度
            # ----------------------------------------------------
            elev_u = node_u.get('elevation', 0.0)
            elev_v = node_v.get('elevation', 0.0)
            height_diff = elev_v - elev_u
            
            base_slope = (height_diff / real_dist) if real_dist > 0 else 0.0
            
            # ----------------------------------------------------
            # 【方案三】線段延伸趨勢法 (Trend Sampling)
            # 如果距離小於 15m 且坡度幾近於 0，程式會自動看它前後連接的路段，
            # 算出「大環境地形」的斜率，然後賦予給這條短邊！
            # ----------------------------------------------------
            if real_dist < 15 and abs(base_slope) < 0.01:
                u_neighbors = [node_dict[n] for n in adj_list[u_id] if n != v_id and n in node_dict]
                v_neighbors = [node_dict[n] for n in adj_list[v_id] if n != u_id and n in node_dict]
                
                if u_neighbors and v_neighbors:
                    # 計算周圍巨觀地形高度平均值
                    macro_u = sum(n['elevation'] for n in u_neighbors) / len(u_neighbors)
                    macro_v = sum(n['elevation'] for n in v_neighbors) / len(v_neighbors)
                    macro_diff = macro_v - macro_u
                    
                    # 假設巨觀兩端點距離約為 60m 跨度
                    trend_slope = macro_diff / 60.0
                    edge['slope'] = round(trend_slope, 4)
                else:
                    edge['slope'] = round(base_slope, 4)
            else:
                edge['slope'] = round(base_slope, 4)

    # 寫回 JSON
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        
    print("✅ 完美整合 4 大方案，圖資與坡度更新完成！")

if __name__ == "__main__":
    process_graph()