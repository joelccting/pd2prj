核心檔案關聯圖
    [資料庫] campus_nodes_edges.json 
        ⬇️ (Fetch 讀取)
    [前端核心] app.js ──(依賴)──> graph.js (建構圖論資料結構)
        │                 └──> algorithms.js (執行路徑演算)
        ⬇️ (渲染呈現)
    [UI 介面] index.html + Leaflet.js (地圖引擎)
檔案功能詳解
    1. 前端程式碼 (Frontend Logic)
        index.html：系統的骨架。負責載入 Leaflet 地圖套件的 CSS/JS，建立 UI 介面（下拉選單、導航按鈕、編輯器存檔按鈕），並依序引入我們的邏輯腳本。
        js/graph.js：圖論資料結構的核心。定義了 Graph 類別，負責在記憶體中維護所有的節點 (Nodes) 與相鄰串列 (Adjacency List)，並提供新增/刪除節點與連線的方法。
        js/algorithms.js：演算法大腦。包含了 BFS (廣度優先搜尋)、DFS (深度優先搜尋) 以及考慮權重與無障礙設施的 Dijkstra 最短路徑演算法。
        js/app.js：專案的總控制器 (Controller)。負責：
        初始化 Leaflet 地圖與設定校園邊界。
        讀取 JSON 資料並實例化 Graph。
        處理 UI 互動（下拉選單自動過濾與中文排序）。
        啟動「視覺化路網編輯器 (God Mode)」。

    2. 資料來源 (Data Sources)
        campus_nodes_edges.json：系統運作所需的唯一資料庫。包含了所有建築物/路口的座標 (Nodes) 以及道路的連接關係與物理距離 (Edges)。

    1. 如何運行網站？
        本專案為純靜態網頁，無需複雜的後端環境。
        建議使用 VS Code 的 Live Server 擴充功能打開 index.html，即可在本地端 (localhost) 預覽並運行地圖。
    
    2. 🪄 上帝模式：視覺化路網編輯器 (Visual Graph Editor)
        我們在 app.js 中內建了強大的視覺化編輯工具，讓你不用改扣也能修路！
        啟動方式：開啟網頁即自動載入藍色控制節點。
        拖拉節點 (Drag & Drop)：按住藍色節點拖拉，相連的道路會如橡皮筋般實時跟隨，放開後系統會自動重新計算相鄰道路的物理距離。
        新增節點 (Add Node)：在地圖空白處點擊「滑鼠左鍵」，即可原地生成新節點。
        建立連線 (Add Edge)：左鍵點擊「節點 A」，再點擊「節點 B」，即可瞬間建立雙向連通的紅色新道路。
        剪斷路線 (Delete Edge)：將滑鼠移至任一路線上（線條會變色加粗），點擊「滑鼠右鍵」即可刪除該連線。
        刪除節點 (Delete Node)：對藍色節點點擊「滑鼠右鍵」，可將其與相連的所有路線一併拔除。
        💾 存檔匯出：編輯完成後，點擊右上角的「儲存並下載」按鈕，將生成的 campus_nodes_edges.json 覆蓋專案目錄下的舊檔案，重新整理網頁即可永久生效。