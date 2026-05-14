from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import subprocess
import sys
import os
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 定義資料庫檔案路徑
DATA_FILE = "campus_nodes_edges.json"
TXT_FILE = "graph.txt"
NODES_FILE = "nodes.txt"

class RouteRequest(BaseModel):
    starts: list[int]
    ends: list[int]
    mode: str = "distance" 

# ==========================================
# 🌟 解決 GitHub Pull 問題：伺服器啟動時自動產生 txt 檔案！
# ==========================================
@app.on_event("startup")
async def startup_event():
    # 如果有 JSON 數據庫，但缺少 C++ 需要的 txt 檔案，就自動轉換生成
    if os.path.exists(DATA_FILE):
        if not os.path.exists(TXT_FILE) or not os.path.exists(NODES_FILE):
            print("🔄 檢測到缺少 TXT 圖資，正在從 JSON 自動生成...")
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
            update_txt_files(data)

# 🛠️ 將 JSON 轉為 C++ 需要的 txt 檔案的核心邏輯 (已修正原本的 ... 錯誤)
def update_txt_files(data):
    # 1. 產生 graph.txt (自動掃描所有權重屬性)
    with open(TXT_FILE, 'w', encoding='utf-8') as f:
        for edge in data.get('edges', []):
            u = edge.get('from', edge.get('source'))
            v = edge.get('to', edge.get('target'))
            if u is None or v is None: continue
            
            attributes = []
            for key, val in edge.items():
                if key not in ['from', 'to', 'source', 'target', 'id', 'name']:
                    if isinstance(val, bool): val = 1 if val else 0
                    if isinstance(val, (int, float)):
                        attributes.append(f"{key}={val}")
            
            attr_str = " ".join(attributes)
            f.write(f"{u} {v} {attr_str}\n")
            
    # 2. 產生 nodes.txt (給 C++ 算轉彎角度用)
    with open(NODES_FILE, "w", encoding="utf-8") as f:
        for node in data.get("nodes", []):
            f.write(f"{node['id']} {node['lat']} {node['lng']}\n")


# ==========================================
# 🚀 批次尋路 API
# ==========================================
@app.post("/api/route/batch")
async def get_route_batch(req: RouteRequest):
    exe_name = "dijkstra.exe" if sys.platform == "win32" else "./dijkstra"
    starts_str = ",".join(map(str, req.starts))
    ends_str = ",".join(map(str, req.ends))

    try:
        result = subprocess.run(
            [exe_name, starts_str, ends_str, req.mode],
            capture_output=True, text=True, check=True
        )
        
        output = result.stdout.strip()
        if output == "NONE":
            return {"status": "success", "path": []}
            
        path_list = [int(node) for node in output.split()]
        return {"status": "success", "path": path_list}
        
    except subprocess.CalledProcessError as e:
        return {"status": "error", "message": "C++ 引擎執行失敗", "details": e.stderr.strip()}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# ==========================================
# 數據庫 API (讀取與儲存)
# ==========================================
@app.get("/api/graph")
async def get_graph():
    if not os.path.exists(DATA_FILE):
        return {"nodes": [], "edges": []}
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)
    
@app.post("/api/graph")
async def save_graph(data: dict):
    try:
        # 1. 儲存原本的 JSON 供下次網頁重整時讀取 (非常重要)
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        # 2. 同步更新 txt 檔案給 C++ 引擎
        update_txt_files(data)

        return {"status": "success", "message": "圖資與節點座標已成功儲存"}
    
    except Exception as e:
        return {"status": "error", "message": str(e)}