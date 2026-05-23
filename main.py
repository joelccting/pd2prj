from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import subprocess
import os
import json
from datetime import datetime
from typing import List, Dict
import pytz
from contextlib import asynccontextmanager
from shadow_calculator import ShadowCalculator 
import secrets
import hashlib

# --- 🌟 新增：地理空間與太陽計算套件 (負責前端多邊形渲染) ---
import math
from pysolar.solar import get_altitude, get_azimuth
import geopandas as gpd
from shapely.affinity import translate
import pandas as pd

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🧹 伺服器啟動中：正在自動清洗高程圖資...")
    try:
        subprocess.run(["python", "clean_elevation.py"], check=True)
    except Exception as e:
        print(f"❌ 圖資清洗發生錯誤: {e}")
        
    yield # 交還控制權，讓 FastAPI 正式啟動
    
app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 檔案路徑設定 ---
DATA_FILE = "campus_nodes_edges.json" # 🌟 唯一真相來源，永遠只認這個檔案
BUILDINGS_FILE = "ccu_buildings.geojson"
TXT_FILE = "graph.txt"
NODES_FILE = "nodes.txt"

BUILDINGS_FILE = "ccu_buildings.geojson"
TXT_FILE = "graph.txt"
NODES_FILE = "nodes.txt"

# 🌟 新增：經過預處理、補上高度的幾何檔案 (給新版陰影 API 使用)
READY_BUILDINGS_FILE = "ccu_buildings_ready.geojson" 
READY_TREES_FILE = "ccu_trees_ready.geojson"
LAT, LNG = 23.560, 120.470 # 中正大學中心點

print(f"📂 使用數據文件: {DATA_FILE}")

# 全域變數存放陰影計算機與幾何圖資
shadow_calc = None
all_objects_gdf = None

# --- 🔐 密碼保護全局變數 ---
EXPORT_PASSWORD = "A@S((CII#CoDeee))@2026"
verified_tokens = set()  # 存儲已驗證的token

def generate_verification_token():
    """生成隨機驗證token"""
    return secrets.token_hex(32)

def verify_export_token(token: str) -> bool:
    """驗證export token是否有效"""
    return token in verified_tokens

# --- 🌟 新增：啟動時預先載入幾何圖資 ---
print("⏳ 準備載入幾何圖資供即時陰影多邊形使用...")
gdfs = []
if os.path.exists(READY_BUILDINGS_FILE):
    gdfs.append(gpd.read_file(READY_BUILDINGS_FILE))
    print(f"✅ 成功載入: {READY_BUILDINGS_FILE}")
if os.path.exists(READY_TREES_FILE):
    gdfs.append(gpd.read_file(READY_TREES_FILE))
    print(f"✅ 成功載入: {READY_TREES_FILE}")

if gdfs:
    all_objects_gdf = pd.concat(gdfs, ignore_index=True)
    print("✅ 所有幾何圖資合併完成，前端多邊形引擎就緒！")
else:
    print("⚠️ 找不到 _ready.geojson 圖資，請確保執行過資料清洗腳本。")


class RouteRequest(BaseModel):
    starts: List[int]
    ends: List[int]
    mode: str = "distance" 
    vehicle: str = "walk" 

def generate_graph_txt(current_time=None):
    """
    將 JSON 資料轉換為 C++ 需要的 txt 格式，並動態加入建築物陰影權重。
    """
    if not os.path.exists(DATA_FILE):
        print(f"找不到 JSON 圖資檔案：{DATA_FILE}")
        return

    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # 動態計算建築物陰影 (給 C++ 用)
    shaded_edge_ids = []
    if shadow_calc:
        calc_time = current_time or datetime.now(pytz.timezone('Asia/Taipei'))
        print(f"正在計算 {calc_time.strftime('%Y-%m-%d %H:%M')} 的路段陰影權重...")
        shaded_edge_ids = shadow_calc.calculate_shaded_edges(calc_time)

    with open(TXT_FILE, 'w', encoding='utf-8') as f:
        for edge in data['edges']:
            u = edge['from']
            v = edge['to']
            dist = edge.get('distance', 1.0)
            slope = edge.get('slope', 0.0)
            tree_shade = edge.get('tree_shade', 0)
            
            forward_id = f"{u}-{v}"
            backward_id = f"{v}-{u}"
            
            is_shaded = False
            if forward_id in shaded_edge_ids or backward_id in shaded_edge_ids:
                is_shaded = True
                
            building_shade = 1 if is_shaded else 0

            # 寫入格式給 C++
            f.write(f"{u} {v} 4 distance {dist} slope {slope} tree_shade {tree_shade} building_shade {building_shade}\n")
            
            if not edge.get('is_oneway', False):
                f.write(f"{v} {u} 4 distance {dist} slope {slope} tree_shade {tree_shade} building_shade {building_shade}\n")
                
    print("✅ C++ 專用圖資 (graph.txt) 生成完成！")


@app.on_event("startup")
async def startup_event():
    global shadow_calc
    
    # 自動修復 JSON，為沒有 id 的 edge 補上 id
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        needs_save = False
        for idx, edge in enumerate(data.get('edges', [])):
            if 'id' not in edge:
                edge['id'] = f"edge_{idx}"  # 自動命名為 edge_0, edge_1...
                needs_save = True
                
        # 如果有修改，就覆寫存檔
        if needs_save:
            with open(DATA_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print("✅ 已自動為圖資中的所有 Edge 補上 'id' 欄位並存檔！")

    # 初始化原本的陰影計算機 (供導航避暑使用)
    if os.path.exists(DATA_FILE) and os.path.exists(BUILDINGS_FILE):
        print("🔄 正在初始化路段陰影計算機 (建立 R-tree)...")
        shadow_calc = ShadowCalculator(BUILDINGS_FILE, DATA_FILE)
        generate_graph_txt()
    else:
        print("⚠️ 缺少必要的 GeoJSON 或更新版的 JSON，請確認檔案路徑。")


@app.post("/api/route")
async def get_route(req: RouteRequest):
    exe_name = "./main" if os.name != 'nt' else "main.exe"
    
    starts_str = ",".join(map(str, req.starts))
    ends_str = ",".join(map(str, req.ends))

    try:
        result = subprocess.run(
            [exe_name, starts_str, ends_str, req.mode, req.vehicle],
            capture_output=True, text=True, check=True
        )
        
        output = result.stdout.strip()
        if output == "NONE" or not output:
            return {"status": "success", "path": []}
            
        path_list = [int(node) for node in output.split()]
        return {"status": "success", "path": path_list}
        
    except subprocess.CalledProcessError as e:
        return {"status": "error", "message": "C++ 引擎執行失敗", "details": e.stderr.strip()}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/api/graph")
async def get_graph():
    if not os.path.exists(DATA_FILE):
        return {"nodes": [], "edges": []}
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


# --- 原本的邊線陰影 API (建議保留以備不時之需，或若前端還有其他功能需要) ---
@app.get("/api/current-shadows")
async def get_current_shadows():
    """回傳目前在建築物陰影下的所有邊 (Edge IDs)"""
    if not shadow_calc:
        return {"status": "error", "message": "陰影計算機未成功初始化，請檢查 geojson 檔案", "shaded_edges": []}
    
    try:
        calc_time = datetime.now(pytz.timezone('Asia/Taipei'))
        shaded_edge_ids = shadow_calc.calculate_shaded_edges(calc_time)
        return {"status": "success", "shaded_edges": shaded_edge_ids}
    except Exception as e:
        return {"status": "error", "message": str(e), "shaded_edges": []}


# --- 🌟 全新 API：回傳真實的多邊形 GeoJSON，供前端渲染色塊 ---
@app.get("/api/current-shadow-polygons")
async def get_current_shadow_polygons():
    if all_objects_gdf is None or all_objects_gdf.empty:
        return {"status": "success", "shadow_geojson": {"type": "FeatureCollection", "features": []}}

    try:
        # 1. 取得台灣時間與當下太陽位置
        calc_time = datetime.now(pytz.timezone('Asia/Taipei'))
        altitude = get_altitude(LAT, LNG, calc_time)
        azimuth = get_azimuth(LAT, LNG, calc_time)
        
        # 如果太陽已下山，回傳空資料
        if altitude <= 0:
            return {"status": "success", "shadow_geojson": {"type": "FeatureCollection", "features": []}}
            
        # 🛡️ 安全機制 1：防止日落時的無窮大陰影，限制最低太陽高度角為 5 度
        safe_altitude = max(altitude, 5.0)
            
        shadow_polygons = []
        
        # 確保資料有初始的 WGS84 (EPSG:4326) 座標系
        if all_objects_gdf.crs is None:
            all_objects_gdf.set_crs(epsg=4326, inplace=True)
            
        # 🌐 專業 GIS 處理：將經緯度轉換為台灣 TWD97 (EPSG:3826) 座標系
        # 在 EPSG:3826 中，X 和 Y 的單位是「真實的公尺」，平移絕對不會變形
        gdf_twd97 = all_objects_gdf.to_crs(epsg=3826)
        
        for idx, row in gdf_twd97.iterrows():
            # 🛡️ 安全機制 2：清理高度髒資料
            try:
                height = float(row.get('height', 12))
                if pd.isna(height) or height <= 0: 
                    height = 12
                # 中正大學幾乎沒有超過 50 公尺的大樓，強制蓋上天花板防暴走
                height = min(height, 50) 
            except:
                height = 12
                
            # 計算陰影長度 (公尺)
            shadow_length = height / math.tan(math.radians(safe_altitude))
            
            # 🛡️ 安全機制 3：強制限制最大陰影長度 (200公尺)
            shadow_length = min(shadow_length, 200)
            
            # 陰影方向 (太陽方位的反方向)
            shadow_dir_rad = math.radians(azimuth + 180)
            
            # 在公尺座標系下的 X(東) Y(北) 平移量
            dx_meters = shadow_length * math.sin(shadow_dir_rad)
            dy_meters = shadow_length * math.cos(shadow_dir_rad)
            
            # 取得建築物原本的位置
            building_poly = row.geometry
            
            # (修正後的寫法)
            # 1. 取得純屋頂的陰影位置 (模擬陽光直射下來的形狀)
            roof_shadow_poly = translate(building_poly, xoff=dx_meters, yoff=dy_meters)

            # 2. 為了讓陰影連著建築物邊緣，我們將原位置與偏移位置聯集 (不要用凸包!)
            raw_shadow = building_poly.union(roof_shadow_poly)

            # 3. 關鍵步驟：把建築物本體的位置「挖空」，只留下落在地上的陰影！
            # 這樣黑色的部分就不會蓋住建築物本身了
            actual_shadow = raw_shadow.difference(building_poly)

            # 過濾掉因為計算產生的一些無效幾何碎片
            if not actual_shadow.is_empty:
                shadow_polygons.append(actual_shadow)
            
        # 將運算完的陰影包裝成 DataFrame
        shadow_gdf_twd97 = gpd.GeoDataFrame(geometry=shadow_polygons, crs="EPSG:3826")
        
        # 🌐 轉回 WGS84 (EPSG:4326) 交給前端 Leaflet 渲染
        shadow_gdf_wgs84 = shadow_gdf_twd97.to_crs(epsg=4326)
        
        return {
            "status": "success",
            "shadow_geojson": json.loads(shadow_gdf_wgs84.to_json())
        }
    except Exception as e:
        print(f"❌ 陰影計算發生錯誤: {e}")
        return {"status": "error", "message": str(e), "shadow_geojson": None}

# --- 🔐 密碼驗證端點 ---
@app.post("/api/verify-password")
async def verify_password(request: Request):
    """驗證密碼並返回驗證token"""
    try:
        body = await request.json()
        password = body.get("password", "")
        
        if password == EXPORT_PASSWORD:
            token = generate_verification_token()
            verified_tokens.add(token)
            print(f"✅ 密碼驗證成功，已發放token: {token[:8]}...")
            return {
                "status": "success",
                "token": token,
                "message": "密碼驗證成功"
            }
        else:
            print("❌ 密碼驗證失敗")
            return {
                "status": "error",
                "message": "密碼錯誤"
            }
    except Exception as e:
        print(f"❌ 密碼驗證API錯誤: {e}")
        return {
            "status": "error",
            "message": str(e)
        }

@app.post("/api/graph")
async def save_graph(request: Request):
    """儲存圖資數據（需要驗證token）"""
    try:
        # 檢查驗證token
        token = request.headers.get("X-Export-Token", "")
        
        if not verify_export_token(token):
            print("❌ 未授權的儲存請求：無效token")
            raise HTTPException(status_code=403, detail="未授權：需要有效的密碼驗證token")
        
        # 取得請求體
        data = await request.json()
        
        print(f"✅ 使用有效token進行儲存")
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        generate_graph_txt() # 存檔後自動重新生成 TXT 圖資
        return {"status": "success", "message": "圖資已儲存並更新編譯權重"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ 儲存API錯誤: {e}")
        return {"status": "error", "message": str(e)}

@app.get("/api/tree-polygons")
async def get_tree_polygons():
    """回傳從空拍圖萃取出來的真實樹木多邊形"""
    if not os.path.exists(READY_TREES_FILE):
        return {"status": "error", "message": "找不到樹木圖資", "tree_geojson": None}
        
    try:
        # 直接讀取我們預處理好的樹木 GeoJSON
        trees_gdf = gpd.read_file(READY_TREES_FILE)
        
        # 確保格式是 WGS84 才能在 Leaflet 正確顯示
        if trees_gdf.crs and trees_gdf.crs.to_string() != "EPSG:4326":
            trees_gdf = trees_gdf.to_crs(epsg=4326)
            
        return {
            "status": "success",
            "tree_geojson": json.loads(trees_gdf.to_json())
        }
    except Exception as e:
        return {"status": "error", "message": str(e), "tree_geojson": None}