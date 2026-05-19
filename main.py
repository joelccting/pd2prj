from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import subprocess
import os
import json
from datetime import datetime
from typing import List, Dict
import pytz

# 引入陰影計算模組
from shadow_calculator import ShadowCalculator 

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 檔案路徑設定
# 優先使用經過 analyze_shade.py 處理過的版本，否則使用原始版本
if os.path.exists("campus_nodes_edges_updated.json"):
    DATA_FILE = "campus_nodes_edges_updated.json"
else:
    DATA_FILE = "campus_nodes_edges.json"

BUILDINGS_FILE = "ccu_buildings.geojson"
TXT_FILE = "graph.txt"
NODES_FILE = "nodes.txt"

print(f"📂 使用數據文件: {DATA_FILE}")

# 全域變數存放陰影計算機
shadow_calc = None

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

    # 動態計算建築物陰影
    shaded_edge_ids = []
    if shadow_calc:
        calc_time = current_time or datetime.now(pytz.timezone('Asia/Taipei'))
        print(f"正在計算 {calc_time.strftime('%Y-%m-%d %H:%M')} 的建築陰影...")
        shaded_edge_ids = shadow_calc.calculate_shaded_edges(calc_time)

    with open(TXT_FILE, 'w', encoding='utf-8') as f:
        for edge in data['edges']:
            u = edge['from']
            v = edge['to']
            dist = edge.get('distance', 1.0)
            slope = edge.get('slope', 0.0)
            tree_shade = edge.get('tree_shade', 0)
            
            # 🌟 終極修復：直接組合 u 和 v 來檢查是否在陰影名單中
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
    
    # 🌟 新增：自動修復 JSON，為沒有 id 的 edge 補上 id
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

    # 原本的初始化邏輯
    if os.path.exists(DATA_FILE) and os.path.exists(BUILDINGS_FILE):
        print("🔄 正在初始化建築物陰影計算機 (建立 R-tree)...")
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

@app.get("/api/current-shadows")
async def get_current_shadows():
    """回傳目前在建築物陰影下的所有邊 (Edge IDs)"""
    if not shadow_calc:
        return {"status": "error", "message": "陰影計算機未成功初始化，請檢查 geojson 檔案", "shaded_edges": []}
    
    try:
        # 取得台北標準時間並計算當前陰影邊
        calc_time = datetime.now(pytz.timezone('Asia/Taipei'))
        shaded_edge_ids = shadow_calc.calculate_shaded_edges(calc_time)
        return {"status": "success", "shaded_edges": shaded_edge_ids}
    except Exception as e:
        return {"status": "error", "message": str(e), "shaded_edges": []}
    
@app.post("/api/graph")
async def save_graph(data: Dict):
    try:
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        generate_graph_txt() # 存檔後自動重新生成 TXT 圖資
        return {"status": "success", "message": "圖資已儲存並更新編譯權重"}
    except Exception as e:
        return {"status": "error", "message": str(e)}