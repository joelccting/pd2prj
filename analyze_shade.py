import cv2
import numpy as np
import json
import os

# ==========================================
# 1. 環境變數與 Bounding Box 設定
# ==========================================
# 請確保檔名正確，若你前面存為 ccu_orthophoto.png，可在此替換
IMAGE_PATH = "ccu_orthophoto.png" 
JSON_INPUT_PATH = "campus_nodes_edges.json"
JSON_OUTPUT_PATH = "campus_nodes_edges_updated.json"

MIN_LON, MIN_LAT = 120.460, 23.550
MAX_LON, MAX_LAT = 120.485, 23.570

# ==========================================
# 2. 核心分析函數
# ==========================================

def get_tree_mask(image_path):
    """
    讀取空照圖，使用 HSV 色彩空間提取深綠色樹冠，並排除明亮的草皮。
    回傳: 二值化樹冠遮罩 (255為樹木, 0為背景)
    """
    # 讀取圖片
    img = cv2.imread(image_path)
    if img is None:
        raise FileNotFoundError(f"找不到圖片檔案：{image_path}")

    # 將圖片從 BGR 轉換為 HSV 色彩空間
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    
    # ==========================================
    # 設定「樹木」的 HSV 範圍 (需要根據空照圖微調)
    # H (色相): 綠色大約落在 35~85 之間
    # S (飽和度): 排除太灰白的無植被區域，設為 40~255
    # V (亮度): 這是區分樹與草的關鍵！草地通常 > 120，樹冠通常較暗。
    # ==========================================
# ==========================================
    # 遮罩 1：抓取深綠色、茂密的樹林（後山、密集樹叢）
    # (填入你剛才調出來覺得對密集樹林效果最好的數字)
    # ==========================================
    lower_dark_green = np.array([35, 40, 20])
    upper_dark_green = np.array([85, 255,75])
    mask1 = cv2.inRange(hsv, lower_dark_green, upper_dark_green)

    # ==========================================
    # 遮罩 2：專門抓行道樹 (如鳳凰大道) 
    # 允許稍微偏黃綠 (H降低)、飽和度較低 (S放寬)，但嚴格限制亮度 (V) 以避開草地
    # ==========================================
    lower_light_green = np.array([20, 30, 40])   
    upper_light_green = np.array([90, 150, 85]) # 亮度 V 壓在 100 以下是避開草皮的關鍵
    mask2 = cv2.inRange(hsv, lower_light_green, upper_light_green)

    # 將兩個遮罩合併 (只要符合其中一個就算數)
    tree_mask = cv2.bitwise_or(mask1, mask2)
    
    # ==========================================
    # 形態學運算 (Morphological Operations) 微調
    # ==========================================
    kernel = np.ones((3,3), np.uint8)
    
    # 【關鍵修改】把 MORPH_OPEN 拿掉或註解掉！
    # 行道樹很細，做 OPEN 運算會把它們吃掉。

    # 保留 CLOSE 運算，用來填補樹冠中間的破洞
    tree_mask = cv2.morphologyEx(tree_mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    
    # 匯出 Tree Mask 供除錯與視覺化檢查
    cv2.imwrite("debug_tree_mask.png", tree_mask)
    print("✅ 已成功提取深綠色樹冠遮罩，並儲存除錯用圖片 debug_tree_mask.png")
    
    return tree_mask

def coord_to_pixel(lat, lng, img_width, img_height):
    """
    將經緯度轉換為圖片的 (X, Y) 像素座標。
    包含 Y 軸反轉處理與邊界防呆。
    """
    # 檢查是否超出 Bounding Box
    if not (MIN_LON <= lng <= MAX_LON and MIN_LAT <= lat <= MAX_LAT):
        return None, None
        
    # X 軸：經度由西向東遞增 (正向)
    x = int((lng - MIN_LON) / (MAX_LON - MIN_LON) * img_width)
    
    # Y 軸：圖片 Y 值往下遞增，但緯度往下遞減 (反向)
    y = int((MAX_LAT - lat) / (MAX_LAT - MIN_LAT) * img_height)
    
    # 確保座標不超出陣列邊界 (Index Out of Bounds 防護)
    x = max(0, min(x, img_width - 1))
    y = max(0, min(y, img_height - 1))
    
    return x, y

def get_bresenham_line(x1, y1, x2, y2):
    """
    使用 Bresenham 演算法，直接計算出線段經過的像素座標。
    (比繪製空白 Mask 後尋找非零像素快上非常多)
    """
    pixels = []
    dx = abs(x2 - x1)
    dy = abs(y2 - y1)
    x, y = x1, y1
    sx = -1 if x1 > x2 else 1
    sy = -1 if y1 > y2 else 1

    if dx > dy:
        err = dx / 2.0
        while x != x2:
            pixels.append((x, y))
            err -= dy
            if err < 0:
                y += sy
                err += dx
            x += sx
        pixels.append((x, y))
    else:
        err = dy / 2.0
        while y != y2:
            pixels.append((x, y))
            err -= dx
            if err < 0:
                x += sx
                err += dy
            y += sy
        pixels.append((x, y))
        
    return pixels

# ==========================================
# 3. 主程式執行區
# ==========================================
def main():
    print("啟動空間與植被分析腳本...")
    
    # 1. 生成 Tree Mask
    tree_mask = get_tree_mask(IMAGE_PATH)
    img_height, img_width = tree_mask.shape

    # 2. 讀取路網 JSON
    if not os.path.exists(JSON_INPUT_PATH):
        raise FileNotFoundError(f"找不到 JSON 檔案：{JSON_INPUT_PATH}")
        
    with open(JSON_INPUT_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # 建立 Node 字典以利快速查詢經緯度
    node_dict = {node['id']: node for node in data['nodes']}
    
    valid_edges_count = 0
    shaded_edges_count = 0

    print("開始計算每條 Edge 的樹蔭覆蓋率...")
    
    # 3. 處理每一條 Edge
    for edge in data['edges']:
        from_node_id = edge.get('from')
        to_node_id = edge.get('to')
        
        # 取得起終點
        node_a = node_dict.get(from_node_id)
        node_b = node_dict.get(to_node_id)
        
        if not node_a or not node_b:
            continue
            
        # 將經緯度轉為像素座標
        x1, y1 = coord_to_pixel(node_a['lat'], node_a['lng'], img_width, img_height)
        x2, y2 = coord_to_pixel(node_b['lat'], node_b['lng'], img_width, img_height)
        
        # 防呆：如果有任何一個點超出地圖範圍，就不計算這條路徑的樹蔭
        if x1 is None or x2 is None:
            edge['tree_shade'] = 0
            continue
            
        valid_edges_count += 1
        
        # 取得線段經過的像素清單
        line_pixels = get_bresenham_line(x1, y1, x2, y2)
        
        if len(line_pixels) == 0:
            edge['tree_shade'] = 0
            continue
            
        # 計算落在 Tree Mask (值為 255) 上的像素數量
        tree_pixel_count = 0
        for px, py in line_pixels:
            if tree_mask[py, px] == 255:  # 注意 numpy array 的索引是 [y, x]
                tree_pixel_count += 1
                
        # 計算覆蓋率
        coverage_ratio = tree_pixel_count / len(line_pixels)
        
        # 判斷是否大於 50%
        if coverage_ratio > 0.5:
            edge['tree_shade'] = 1
            shaded_edges_count += 1
        else:
            edge['tree_shade'] = 0

    # 4. 輸出更新後的 JSON
    with open(JSON_OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        
    print("=" * 40)
    print("🎉 處理完成！")
    print(f"- 總計分析有效路段數: {valid_edges_count}")
    print(f"- 符合樹蔭遮蔽標準 (>=50%) 路段數: {shaded_edges_count}")
    print(f"- 更新後的檔案已儲存為: {JSON_OUTPUT_PATH}")
    print("=" * 40)

if __name__ == "__main__":
    main()