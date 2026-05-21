import json
import math
from datetime import datetime
import pytz
from typing import List

# 空間計算相關
import pyproj
from shapely.geometry import shape, Point, LineString, Polygon
from shapely.ops import transform, unary_union
from shapely.affinity import affine_transform
from shapely.strtree import STRtree

# 太陽角度計算
from pysolar import solar


class ShadowCalculator:
    def __init__(self, buildings_path: str, network_path: str):
        """
        初始化模組：讀取檔案、進行座標投影 (EPSG:4326 -> EPSG:3826)、並建立 R-tree 空間索引。
        此過程耗時較長，應於 FastAPI 啟動時 (Lifespan/Startup) 執行一次即可。
        """
        # 定義投影轉換器：從 WGS84(經緯度) 轉到 TWD97(台灣二度分帶，單位為公尺)
        self.proj_to_3826 = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:3826", always_xy=True)
        
        # 1. 載入並轉換建築物資料
        self.buildings = []
        with open(buildings_path, 'r', encoding='utf-8') as f:
            b_data = json.load(f)
            
        for feat in b_data.get('features', []):
            geom = shape(feat['geometry'])
            # 轉換為 EPSG:3826
            geom_3826 = transform(self.proj_to_3826.transform, geom)
            
            # 取得高度，若無則給預設值 (例如 10.0 公尺)
            height = feat['properties'].get('height', 10.0)
            if not isinstance(height, (int, float)):
                try:
                    height = float(height)
                except ValueError:
                    height = 10.0
                    
            self.buildings.append({
                'geometry': geom_3826,
                'height': height
            })

        # 2. 載入並轉換路網資料
        with open(network_path, 'r', encoding='utf-8') as f:
            n_data = json.load(f)
            
        # 建立 Node 字典以供 Edge 參照
        nodes_dict = {}
        for node in n_data.get('nodes', []):
            pt = Point(node['lng'], node['lat'])
            nodes_dict[node['id']] = transform(self.proj_to_3826.transform, pt)
            
        self.edges_geom = []
        self.edges_id = []
        for edge in n_data.get('edges', []):
            u, v = edge['from'], edge['to']
            if u in nodes_dict and v in nodes_dict:
                line = LineString([nodes_dict[u], nodes_dict[v]])
                self.edges_geom.append(line)
                self.edges_id.append(f"{u}-{v}")

        # 3. 建立路網的 STRtree 空間索引 (以 EPSG:3826 為基準)
        # Shapely 2.0+ 支援直接傳入 geometry 列表建立 STRtree
        self.tree = STRtree(self.edges_geom)


    def calculate_shaded_edges(self, dt: datetime) -> List[str]:
        """
        傳入時間，回傳被陰影覆蓋率大於 50% 的 Edge ID 列表
        """
        # 1. 時間防呆與時區處理 (強制轉換為 Asia/Taipei)
        taipei_tz = pytz.timezone('Asia/Taipei')
        if dt.tzinfo is None:
            dt = taipei_tz.localize(dt)
        else:
            dt = dt.astimezone(taipei_tz)

        # 嘉義中正大學大約座標 (作為太陽角度計算基準)
        lat, lon = 23.560, 120.470

        # 計算太陽高度角與方位角
        altitude = solar.get_altitude(lat, lon, dt)
        
        # 判斷是否為夜晚
        if altitude <= 0:
            return []
            
        azimuth = solar.get_azimuth(lat, lon, dt)

        # 2. 計算陰影偏移參數
        # 太陽方位角是光源方向。陰影的方向剛好與之相反 (+180度)
        # 假設 azimuth 是從正北(0)順時針計算的角度，轉成弳度
        shadow_angle_deg = (azimuth + 180) % 360
        shadow_angle_rad = math.radians(shadow_angle_deg)
        tan_alt = math.tan(math.radians(altitude))

        shadow_polygons = []
        for b in self.buildings:
            poly = b['geometry']
            # 陰影長度公式
            L = b['height'] / tan_alt
            
            # 將極座標 (L, angle) 轉為直角座標 (dx, dy)
            # 在地理坐標中：Y軸為北(cos)，X軸為東(sin)
            dx = L * math.sin(shadow_angle_rad)
            dy = L * math.cos(shadow_angle_rad)
            
            # 3. 生成陰影多邊形
            # 使用 affine_transform 平移 Polygon: [a, b, c, d, xoff, yoff] (此處為單位矩陣平移)
            translated_poly = affine_transform(poly, [1, 0, 0, 1, dx, dy])
            
            # 原 Polygon 與平移後 Polygon 取聯集後做 Convex Hull (凸包)
            shadow_poly = poly.union(translated_poly).convex_hull
            shadow_polygons.append(shadow_poly)

        # 全局陰影合併 (優化效能，減少交集判斷次數)
        global_shadow = unary_union(shadow_polygons)

        # 4. 空間索引與遮蔽率判斷
        # 使用 STRtree 找出 bounding box 有交集的候選 Edges (回傳的是 edges_geom 的索引值)
        candidate_indices = self.tree.query(global_shadow)
        
        shaded_edge_ids = []
        for idx in candidate_indices:
            edge = self.edges_geom[idx]
            edge_id = self.edges_id[idx]
            
            # 精確計算交集長度
            intersection = edge.intersection(global_shadow)
            
            # 判斷有效遮蔽 (覆蓋率 > 0.5)
            # 避免 edge 長度極短時產生除以零錯誤，做個微小防呆
            if edge.length > 0:
                coverage_ratio = intersection.length / edge.length
                if coverage_ratio > 0.5:
                    shaded_edge_ids.append(edge_id)

        return shaded_edge_ids