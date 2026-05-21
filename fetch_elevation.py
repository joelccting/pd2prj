import json
import requests
import math
import time

DATA_FILE = "campus_nodes_edges.json"

def fetch_elevations_in_batches(nodes, batch_size=100):
    """分批向 API 請求高程資料"""
    print(f"🌍 準備向 Open-Elevation API 請求 {len(nodes)} 個節點的高程資料...")
    node_dict = {node['id']: node for node in nodes}
    node_list = list(nodes)
    
    for i in range(0, len(node_list), batch_size):
        batch = node_list[i : i + batch_size]
        locations = [{"latitude": n['lat'], "longitude": n['lng']} for n in batch]
        
        print(f"⏳ 正在抓取第 {i+1} 到 {min(i+batch_size, len(node_list))} 筆資料...")
        try:
            response = requests.post("https://api.open-elevation.com/api/v1/lookup", json={"locations": locations})
            response.raise_for_status()
            results = response.json().get('results', [])
            
            for idx, res in enumerate(results):
                node_id = batch[idx]['id']
                node_dict[node_id]['elevation'] = res.get('elevation', 0.0)
                
        except Exception as e:
            print(f"❌ 抓取失敗: {e}")
            
        time.sleep(1) # 禮貌性延遲
    print("✅ 高程資料抓取完畢！")

def haversine_distance(lat1, lon1, lat2, lon2):
    """利用經緯度計算地球表面兩點的真實距離 (單位: 公尺)"""
    R = 6371000  # 地球半徑(公尺)
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return R * (2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))

def recalculate_distance_and_slopes(data):
    """根據經緯度重算精準距離，並搭配高程算出精準坡度 (Slope)"""
    print("📐 正在重新計算所有路段的「真實距離」與「坡度(Slope)」...")
    node_dict = {node['id']: node for node in data.get('nodes', [])}
    
    for edge in data.get('edges', []):
        u_id = edge['from']
        v_id = edge['to']
        
        if u_id in node_dict and v_id in node_dict:
            node_u = node_dict[u_id]
            node_v = node_dict[v_id]
            
            # 🌟 1. 重算精準距離 (Distance)
            real_distance = haversine_distance(node_u['lat'], node_u['lng'], node_v['lat'], node_v['lng'])
            edge['distance'] = round(real_distance, 2)
            
            # 🌟 2. 取得高程並計算高度差
            elev_u = node_u.get('elevation', 0.0)
            elev_v = node_v.get('elevation', 0.0)
            height_diff = elev_v - elev_u 
            
            # 🌟 3. 計算坡度 (Slope = 高度差 / 距離)
            if real_distance > 0:
                slope = height_diff / real_distance
                edge['slope'] = round(slope, 4)
            else:
                edge['slope'] = 0.0

if __name__ == "__main__":
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    if 'nodes' in data:
        fetch_elevations_in_batches(data['nodes'])
        
    if 'edges' in data:
        # 🌟 呼叫升級版的重算函數
        recalculate_distance_and_slopes(data)

    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        
    print(f"🎉 處理完成！已將最新 Elevation、精準 Distance 與 Slope 寫回 {DATA_FILE}")