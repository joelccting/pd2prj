from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
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

# 🛠️ 核心功能：將 JSON 數據庫轉換為 C++ 引擎看得懂的 graph.txt (包含權重)
# 🛠️ 終極動態轉換：自動抓取邊的所有數字與布林屬性
def update_graph_txt(data):
    with open(TXT_FILE, 'w', encoding='utf-8') as f:
        for edge in data.get('edges', []):
            u = edge.get('from', edge.get('source'))
            v = edge.get('to', edge.get('target'))
            
            if u is None or v is None:
                continue
                
            attributes = []
            # 動態掃描這條邊裡面「所有的」屬性
            for key, val in edge.items():
                # 排除不必要的文字資訊，只留下可作為權重的資料
                if key not in ['from', 'to', 'source', 'target', 'id', 'name']:
                    if isinstance(val, bool):
                        val = 1 if val else 0  # C++ 看不懂 True/False，轉成 1/0
                    if isinstance(val, (int, float)):
                        attributes.append(f"{key}={val}")
                        
            # 組合成 key=value 的字串，例如: "distance=15.2 accessible=1"
            attr_str = " ".join(attributes)
            f.write(f"{u} {v} {attr_str}\n")
# ==========================================
# 數據庫 API：提供地圖資料給前端 (GET)
# ==========================================
@app.get("/api/graph")
async def get_graph():
    if not os.path.exists(DATA_FILE):
        return {"nodes": [], "edges": []}
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

# ==========================================
# 數據庫 API：接收上帝模式的修改並儲存 (POST)
# ==========================================
@app.post("/api/graph")
async def save_graph(request: Request):
    try:
        data = await request.json()
        
        # 1. 儲存至 JSON 數據庫
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            
        # 2. 自動同步更新 C++ 引擎的 txt
        update_graph_txt(data)
        
        return {"status": "success", "message": "圖形資料庫已更新，並成功同步至 C++ 引擎！"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# ==========================================
# C++ 尋路引擎 API (原本的功能，保持不變)
# ==========================================
@app.get("/route")
async def get_route(start: int, end: int):
    exe_name = "dijkstra.exe" if sys.platform == "win32" else "./dijkstra"
    if not os.path.exists(exe_name):
        return {"status": "error", "message": f"找不到 C++ 執行檔: {exe_name}"}

    try:
        result = subprocess.run(
            [exe_name, str(start), str(end)],
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