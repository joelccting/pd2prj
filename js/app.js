import { initEditorMode } from './editor.js';
// 1. 定義校園的左下角 (SouthWest) 和右上角 (NorthEast) 邊界
// (以下座標是大約值，你需要替換成你們學校真實的最南邊與最北邊)
const corner1 = L.latLng(23.550, 120.460); // 左下角 (西南方)
const corner2 = L.latLng(23.570, 120.485); // 右上角 (東北方)

// 2. 將這兩個點組合成一個「邊界物件」
const campusBounds = L.latLngBounds(corner1, corner2);

// 3. 初始化地圖，並把限制條件塞進去
const map = L.map('map', {
  center: [23.560, 120.470], // 地圖一開始的中心點 (學校正中央)
  zoom: 16,                  // 預設縮放大小
  
  // 👇 鎖定地圖範圍的關鍵設定 👇
  maxBounds: campusBounds,   // 限制拖曳範圍在這個框框內
  maxBoundsViscosity: 0.5,   // 邊界的「黏滯性」
  minZoom: 16,               // 限制縮放下限：避免使用者縮太小看到整個縣市
  maxZoom: 22                // 限制縮放上限：避免使用者放太大導致地圖模糊
});
  // Add OpenStreetMap tile layer
  L.tileLayer(
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png", 
    {
      attribution:
        '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',

      maxNativeZoom: 18,
      maxZoom: 22,
      tileSize: 512,
      zoomOffset: -1
      
    }
  ).addTo(map);
// Fetch data and initialize the graph
fetch("campus_nodes_edges.json")
  .then((response) => response.json())
  .then((data) => {
    // Add nodes to the graph
    data.nodes.forEach((node) => {
      graph.addNode(node);
    });

    // Add edges to the graph
    data.edges.forEach((edge) => {
      graph.addEdge(edge);
    });

    // --------------------
    // Group nodes by name
    // --------------------
    const nodesByName = {};

    data.nodes.forEach((node) => {
      if (node.name && node.name.trim() !== "") {
        const name = node.name.trim();
        if (!nodesByName[name]) {
          nodesByName[name] = [];
        }
        nodesByName[name].push(node);
      }
    });

    // -------------------------------
    // Calculate average coordinates
    // -------------------------------
    const locationMarkers = [];

    for (const name in nodesByName) {
      const nodes = nodesByName[name];
      const avgLat =
        nodes.reduce((sum, node) => sum + node.lat, 0) / nodes.length;
      const avgLng =
        nodes.reduce((sum, node) => sum + node.lng, 0) / nodes.length;

      locationMarkers.push({
        name: name,
        lat: avgLat,
        lng: avgLng,
      });
    }

    // ----------------------------------------
    // Add a single marker per named location
    // ----------------------------------------
    locationMarkers.forEach((location) => {
      L.marker([location.lat, location.lng])
        .bindPopup(location.name)
        .addTo(map);
    });

    
    // ----------------------------------------------------
    // 🗂️ 將地標依照「學校、住宿、飲食」分類並塞入下拉選單
    // ----------------------------------------------------
    const startSelect = document.getElementById("start");
    const endSelect = document.getElementById("end");

    // 1. 智慧分類小幫手：利用關鍵字判斷大樓屬於哪一類
    // 1. 智慧分類小幫手：利用關鍵字判斷大樓屬於哪一類
    function getCategory(name) {
      
      // 🌟 終極解法：強制指定分類的「例外字典」
      // 如果有被分錯的，直接把它加進這裡！
      const overrides = {
        "嘉農小館": "dining",
        "康乃爾學院": "housing",
        "苗園":"housing",
        
      };

      // 第一關：如果在例外名單裡有明確規定，直接放行！
      if (overrides[name]) {
        return overrides[name];
      }

      // 第二關：攔截連鎖店與明確的飲食
      if (name.includes("全家") || name.includes("7-ELEVEN") || name.includes("萊爾富") || name.includes("蝦皮") || name.includes("早餐")) return "dining";
      
      // 第三關：住宿區關鍵字與特定名稱
      const housingNames = ["伯爵", "陶潛", "現代首席", "京采", "墨香苑", "陶居", "木菊苑", "書香門第", "常春藤", "鼎泰", "柏克萊", "彬彬", "夏都", "深白舍", "橙舍", "節能宿舍"];
      if (name.includes("宿舍") || name.includes("學苑") || name.includes("會館") || name.includes("凱格鹿") || housingNames.some(h => name.includes(h))) return "housing";
      
      // 第四關：學校建築關鍵字與特定名稱
      const schoolNames = ["禮堂", "實習工廠", "苗圃", "動物實驗室", "變電所", "納米運動", "三興國小"];
      if (name.includes("大樓") || name.includes("學院") || name.includes("教室") || name.includes("系") || name.includes("館") || name.includes("活動中心") || name.includes("環安中心") || schoolNames.some(s => name.includes(s))) return "school";
      
      // 第五關：其他沒抓到的全部預設歸類為飲食與生活商圈
      return "dining"; 
    }

    // 2. 準備三個分類資料夾 (OptGroup)
    const optGroups = {
      "school": { zh: "🏫 學校建築", en: "🏫 School Buildings", el_start: document.createElement("optgroup"), el_end: document.createElement("optgroup") },
      "housing": { zh: "🛏️ 住宿區", en: "🛏️ Accommodation", el_start: document.createElement("optgroup"), el_end: document.createElement("optgroup") },
      "dining": { zh: "🍔 飲食與生活", en: "🍔 Dining & Life", el_start: document.createElement("optgroup"), el_end: document.createElement("optgroup") }
    };

    // 初始化資料夾標題與翻譯標籤
    Object.keys(optGroups).forEach(key => {
      optGroups[key].el_start.label = optGroups[key].zh;
      optGroups[key].el_start.dataset.i18nCat = key;
      optGroups[key].el_end.label = optGroups[key].zh;
      optGroups[key].el_end.dataset.i18nCat = key;
    });

    // 3. 掃描所有地標，放進對應的資料夾
    locationMarkers.forEach((location) => {
      const cat = getCategory(location.name);
      
      const option1 = document.createElement("option");
      option1.value = location.name; option1.text = location.name;
      
      const option2 = document.createElement("option");
      option2.value = location.name; option2.text = location.name;

      optGroups[cat].el_start.appendChild(option1);
      optGroups[cat].el_end.appendChild(option2);
    });

    // 4. 把裝滿選項的資料夾放進 HTML 下拉選單中
    Object.keys(optGroups).forEach(key => {
      startSelect.appendChild(optGroups[key].el_start);
      endSelect.appendChild(optGroups[key].el_end);
    });

    // ==========================================
    // 🌟 定義語言切換功能 (升級版：連分類標題一起翻譯)
    // ==========================================
    function updateDropdownLanguage(currentLang) {
      function translateOptions(selectElement) {
        // A. 翻譯分類標題 (OptGroup)
        selectElement.querySelectorAll("optgroup").forEach(group => {
          const catKey = group.dataset.i18nCat;
          if (optGroups[catKey] && optGroups[catKey][currentLang]) {
            group.label = optGroups[catKey][currentLang];
          }
        });

        // B. 翻譯大樓選項 (Option)
        Array.from(selectElement.options).forEach(option => {
          if (option.value === "") return; 
          if (typeof buildingTranslations !== 'undefined') {
            const translation = buildingTranslations[option.value];
            if (translation && translation[currentLang]) {
              option.text = translation[currentLang];
            } else {
              option.text = option.value; 
            }
          }
        });
      }

      translateOptions(startSelect);
      translateOptions(endSelect);
    }

    // ==========================================
    // 🌟 綁定語言切換事件與初始載入
    // ==========================================
    const langSelectElement = document.getElementById("language-selector");
    if (langSelectElement) {
      langSelectElement.addEventListener("change", (e) => {
        updateDropdownLanguage(e.target.value);
      });
      // 網頁開啟時先手動翻譯一次
      updateDropdownLanguage(langSelectElement.value);
    }
    // ---------------------------
    // 🎨 準備一個記憶體陣列，用來記住所有畫在地圖上的線
    // ---------------------------
    const activePolylines = []
    initEditorMode(map, data, graph);
    // -------------------------
    // Event listener for routing
    // -------------------------
    document.getElementById("findRoute").addEventListener("click", () => {
      const startName = document.getElementById("start").value;
      const endName = document.getElementById("end").value;
      const algorithm = document.getElementById("algorithm").value;
      const accessibility = document.getElementById("accessibility").checked;

      const startNodeIds = nodesByName[startName].map((node) => node.id);
      const endNodeIds = nodesByName[endName].map((node) => node.id);

      let shortestPath = null;
      let shortestDistance = Infinity;

      if (startName === endName) {
        alert(
          "Start and end locations cannot be the same. Please select different locations."
        );
        return;
      }
      // For each combination of start and end nodes
      for (const startId of startNodeIds) {
        for (const endId of endNodeIds) {
          let path = [];
          switch (algorithm) {
            case "bfs":
              path = bfs(graph, startId, endId);
              break;
            case "dfs":
              path = dfs(graph, startId, endId);
              break;
            case "dijkstra":
              path = dijkstra(graph, startId, endId, accessibility);
              break;
          }

          if (path.length > 0) {
            // Calculate total distance of the path
            const totalDistance = calculatePathDistance(path);

            if (totalDistance < shortestDistance) {
              shortestDistance = totalDistance;
              shortestPath = path;
            }
          }
        }
      }

      if (shortestPath) {
        drawPath(shortestPath);
      } else {
        alert("No path found between the selected locations.");
      }
    });


  });

function calculatePathDistance(path) {
  let totalDistance = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const fromNodeId = path[i];
    const toNodeId = path[i + 1];

    const edges = graph.adjacencyList.get(fromNodeId) || [];

    const edge = edges.find((e) => e.to === toNodeId);
    if (edge) {
      totalDistance += edge.weight;
    } else {
      // Edge not found (this should not happen if the graph is consistent)
      totalDistance += Infinity;
    }
  }

  return totalDistance;
}

let currentPathLayer;

function drawPath(nodeIds) {
  // Remove existing path
  if (currentPathLayer) {
    map.removeLayer(currentPathLayer);
  }

  const latlngs = nodeIds.map((nodeId) => {
    const node = graph.nodes.get(nodeId);
    return [node.lat, node.lng];
  });

  currentPathLayer = L.polyline(latlngs, { color: "red" }).addTo(map);

  // Zoom the map to the path
  map.fitBounds(currentPathLayer.getBounds());
}