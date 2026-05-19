import cv2
import numpy as np

def nothing(x):
    pass

# 讀取圖片並縮小，以免你的螢幕塞不下
img = cv2.imread('ccu_orthophoto.png')
img = cv2.resize(img, (800, 800))
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

# 建立控制視窗
cv2.namedWindow('Trackbars')
cv2.resizeWindow('Trackbars', 400, 300)

# 建立 HSV 六個拉桿
# 預設值先放我們剛才建議的放寬版本
cv2.createTrackbar('H_Min', 'Trackbars', 25, 179, nothing)
cv2.createTrackbar('S_Min', 'Trackbars', 15, 255, nothing)
cv2.createTrackbar('V_Min', 'Trackbars', 20, 255, nothing)
cv2.createTrackbar('H_Max', 'Trackbars', 95, 179, nothing)
cv2.createTrackbar('S_Max', 'Trackbars', 255, 255, nothing)
cv2.createTrackbar('V_Max', 'Trackbars', 130, 255, nothing)

print("請拖拉滑桿來尋找最佳範圍。")
print("按下 'q' 鍵退出程式，並會在終端機印出你最後選定的數值。")

while True:
    # 讀取當前拉桿的數值
    h_min = cv2.getTrackbarPos('H_Min', 'Trackbars')
    s_min = cv2.getTrackbarPos('S_Min', 'Trackbars')
    v_min = cv2.getTrackbarPos('V_Min', 'Trackbars')
    h_max = cv2.getTrackbarPos('H_Max', 'Trackbars')
    s_max = cv2.getTrackbarPos('S_Max', 'Trackbars')
    v_max = cv2.getTrackbarPos('V_Max', 'Trackbars')
    
    lower = np.array([h_min, s_min, v_min])
    upper = np.array([h_max, s_max, v_max])
    
    # 產生遮罩
    mask = cv2.inRange(hsv, lower, upper)
    
    # 將遮罩套用回原圖，方便對照（只有在範圍內的會保留彩色）
    result = cv2.bitwise_and(img, img, mask=mask)
    
    cv2.imshow('Mask (Black/White)', mask)
    cv2.imshow('Result (Color)', result)
    
    if cv2.waitKey(1) & 0xFF == ord('q'):
        print(f"\n你的最佳設定為：")
        print(f"lower_green = np.array([{h_min}, {s_min}, {v_min}])")
        print(f"upper_green = np.array([{h_max}, {s_max}, {v_max}])")
        break

cv2.destroyAllWindows()