import requests
import cv2
import numpy as np
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# 1. 定義中正大學的 Bounding Box (保留你剛剛自訂的範圍)
MIN_LON, MIN_LAT = 120.460, 23.550
MAX_LON, MAX_LAT = 120.485, 23.570

# 2. 調降解析度到伺服器比較能接受的範圍 (1024x1024)
IMG_WIDTH = 1024
IMG_HEIGHT = 1024

# 3. 組裝請求網址
wms_url = (
    f"https://wms.nlsc.gov.tw/wms?"
    f"SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&"
    f"LAYERS=PHOTO2&SRS=EPSG:4326&"
    f"BBOX={MIN_LON},{MIN_LAT},{MAX_LON},{MAX_LAT}&"
    f"WIDTH={IMG_WIDTH}&HEIGHT={IMG_HEIGHT}&FORMAT=image/png"
)

# 4. 偽裝成一般瀏覽器，避免被當成爬蟲踢掉
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

print("正在向內政部國土測繪中心請求正射影像，請稍候...")

try:
    # 5. 加入 headers 與 timeout=30 (等伺服器最多 30 秒)
    response = requests.get(wms_url, verify=False, headers=headers, timeout=30)
    
    if response.status_code == 200:
        # 轉換圖片
        image_array = np.asarray(bytearray(response.content), dtype=np.uint8)
        img = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
        
        if img is not None:
            cv2.imwrite("ccu_orthophoto.png", img)
            print("✅ 下載成功！已儲存為 ccu_orthophoto.png")
        else:
            print("❌ 圖片解碼失敗，伺服器可能回傳了錯誤訊息而不是圖片。")
            print("伺服器回傳內容:", response.text[:200]) 
    else:
        print(f"❌ 下載失敗，HTTP 狀態碼: {response.status_code}")

except Exception as e:
    print(f"❌ 發生錯誤: {e}")