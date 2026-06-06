import requests
import json
import os

# ==========================================
# 1. 環境變數設定
# ==========================================
# 使用你之前設定的校園 Bounding Box
MIN_LON, MIN_LAT = 120.460, 23.550
MAX_LON, MAX_LAT = 120.485, 23.570
OUTPUT_FILE = "ccu_buildings.geojson"

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

def get_building_height(tags):
    """
    根據 OSM 的標籤自動推算建築物高度 (公尺)
    優先級: height -> building:levels -> 預設值
    """
    # 1. 如果有明確標示高度，直接使用
    if 'height' in tags:
        try:
            return float(tags['height'].replace('m', '').strip())
        except ValueError:
            pass
            
    # 2. 如果沒有高度，但有樓層數，每層樓以 3.5 公尺計算
    if 'building:levels' in tags:
        try:
            levels = float(tags['building:levels'])
            return levels * 3.5
        except ValueError:
            pass
            
    # 3. 如果什麼都沒有，預設給 3 層樓的高度 (10.5 公尺)
    return 10.5

def fetch_osm_buildings():
    """
    使用 Overpass QL 查詢範圍內的建築物，並直接取得幾何座標 (geom)
    """
    print("🚀 正在向 Overpass API 請求大樓資料...")
    
    query = f"""
    [out:json][timeout:25];
    (
      way["building"]({MIN_LAT},{MIN_LON},{MAX_LAT},{MAX_LON});
    );
    out body geom;
    """
    
    # 【關鍵修改】加上 Headers 標示身份，避免被伺服器當成惡意爬蟲踢掉
    headers = {
        'User-Agent': 'CCU-Campus-Map-Script/1.0 (dreamgggq@gmail.com)',
        'Accept': '*/*'
    }
    
    # 將 headers 放進請求中
    response = requests.post(OVERPASS_URL, data={'data': query}, headers=headers)
    
    if response.status_code != 200:
        # 加上 response.text，如果再報錯，我們才能看到伺服器具體在抱怨什麼
        raise Exception(f"API 請求失敗: HTTP {response.status_code} - {response.text}")
        
    return response.json()
def convert_to_geojson(osm_data):
    """
    將 OSM 的 JSON 格式轉換為標準的 GeoJSON 格式
    """
    print("🔄 正在轉換為 GeoJSON 格式並計算高度...")
    
    features = []
    
    for element in osm_data.get('elements', []):
        if element['type'] == 'way' and 'geometry' in element:
            # 取得該建築物的標籤 (包含名稱、樓層等)
            tags = element.get('tags', {})
            
            # 計算大樓高度
            height = get_building_height(tags)
            
            # 轉換座標格式：OSM 給 [{'lat': 23.5, 'lon': 120.4}, ...]
            # GeoJSON 需要 [[120.4, 23.5], ...] (注意 GeoJSON 是 [經度, 緯度])
            coordinates = []
            for node in element['geometry']:
                coordinates.append([node['lon'], node['lat']])
                
            # 確保多邊形是閉合的 (起點與終點必須相同)
            if coordinates[0] != coordinates[-1]:
                coordinates.append(coordinates[0])
                
            # 建立 GeoJSON Feature
            feature = {
                "type": "Feature",
                "properties": {
                    "id": element['id'],
                    "name": tags.get('name', '未命名建築'),
                    "building": tags.get('building', 'yes'),
                    "height": height,
                    "levels": tags.get('building:levels', '未知')
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [coordinates] # Polygon 外圍加一層 list
                }
            }
            features.append(feature)
            
    # 組合成完整的 GeoJSON 結構
    geojson = {
        "type": "FeatureCollection",
        "features": features
    }
    
    return geojson

def main():
    try:
        # 1. 下載資料
        osm_data = fetch_osm_buildings()
        
        # 2. 轉換資料
        geojson_data = convert_to_geojson(osm_data)
        
        # 3. 存檔
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(geojson_data, f, ensure_ascii=False, indent=2)
            
        print("=" * 40)
        print("🎉 處理完成！")
        print(f"- 成功抓取了 {len(geojson_data['features'])} 棟大樓的多邊形")
        print(f"- 檔案已儲存為: {OUTPUT_FILE}")
        print("=" * 40)
        
    except Exception as e:
        print(f"❌ 發生錯誤: {e}")

if __name__ == "__main__":
    main()