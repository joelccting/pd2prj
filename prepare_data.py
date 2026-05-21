import geopandas as gpd
import cv2
import numpy as np
from shapely.geometry import Polygon
import json

def fix_building_heights(input_geojson, output_geojson, default_height=12.0):
    print("🏢 處理建築物高度中...")
    gdf = gpd.read_file(input_geojson)
    
    def calculate_height(row):
        # 1. 如果有明確高度
        if 'height' in row and row['height']:
            try: return float(row['height'])
            except: pass
        # 2. 如果有樓層數，每層算 3 公尺
        if 'building:levels' in row and row['building:levels']:
            try: return float(row['building:levels']) * 3.0
            except: pass
        # 3. 預設高度
        return default_height

    gdf['height'] = gdf.apply(calculate_height, axis=1)
    gdf.to_file(output_geojson, driver='GeoJSON')
    print(f"✅ 建築物資料已儲存至 {output_geojson}")

def convert_tree_mask_to_geojson(image_path, output_geojson):
    print("🌳 處理樹木遮罩圖片中...")
    # 讀取你的樹木遮罩 (確保是黑白或綠白遮罩)
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    
    # 二值化 (假設樹木部分為白色 255)
    _, thresh = cv2.threshold(img, 127, 255, cv2.THRESH_BINARY)
    
    # 找出輪廓
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # 定義你的 app.js 中的校園邊界 (用來將像素座標轉為經緯度)
    lat_min, lat_max = 23.550, 23.570
    lng_min, lng_max = 120.460, 120.485
    h, w = img.shape

    polygons = []
    for contour in contours:
        # 忽略太小的雜訊點
        if cv2.contourArea(contour) < 50:
            continue
            
        poly_coords = []
        for point in contour:
            px, py = point[0]
            # 將圖片像素 (px, py) 轉換為經緯度 (lng, lat)
            # 圖片左上角是 (0,0)，對應 (lat_max, lng_min)
            lng = lng_min + (px / w) * (lng_max - lng_min)
            lat = lat_max - (py / h) * (lat_max - lat_min) 
            poly_coords.append((lng, lat))
            
        if len(poly_coords) >= 3:
            polygons.append(Polygon(poly_coords))
            
    # 建立樹木的 GeoDataFrame，預設樹冠高度為 6 公尺
    tree_gdf = gpd.GeoDataFrame(geometry=polygons, crs="EPSG:4326")
    tree_gdf['height'] = 6.0 
    tree_gdf['type'] = 'tree'
    
    tree_gdf.to_file(output_geojson, driver='GeoJSON')
    print(f"✅ 樹木多邊形已儲存至 {output_geojson}")

if __name__ == "__main__":
    # 執行清洗
    fix_building_heights("ccu_buildings.geojson", "ccu_buildings_ready.geojson")
    
    # 如果你的圖片叫做 debug_tree_mask.png，且背景是黑的，樹是白的，可以直接跑這個
    convert_tree_mask_to_geojson("debug_tree_mask.png", "ccu_trees_ready.geojson")