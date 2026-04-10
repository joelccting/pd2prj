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
      if (name.includes("全家") || name.includes("7-Eleven") || name.includes("萊爾富") || name.includes("蝦皮") || name.includes("早餐")) return "dining";
      
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
    const activePolylines = [];

    function createEditableEdge(nodeA, nodeB, isNew = false) {
      const lineColor = isNew ? "#ff0044" : "gray";
      const polyline = L.polyline(
        [[nodeA.lat, nodeA.lng], [nodeB.lat, nodeB.lng]], 
        { color: lineColor, weight: 5, opacity: 0.7 } 
      ).addTo(map);

      // 🌟 神奇魔法：偷偷把起點和終點的資料綁在這條線上！
      polyline._nodeA = nodeA;
      polyline._nodeB = nodeB;
      
      // 把這條線收編進我們的記憶體陣列裡
      activePolylines.push(polyline);

      polyline.on('mouseover', function () {
        this.setStyle({ color: '#ff9900', weight: 8 });
      });
      polyline.on('mouseout', function () {
        this.setStyle({ color: lineColor, weight: 5 });
      });

      polyline.on('contextmenu', function (e) {
        L.DomEvent.stopPropagation(e); 
        if (confirm(`確定要剪斷 [${nodeA.id}] 和 [${nodeB.id}] 之間的連線嗎？`)) {
          map.removeLayer(polyline);
          
          // 🧹 從記憶體陣列中把這條線剔除
          const index = activePolylines.indexOf(polyline);
          if (index > -1) activePolylines.splice(index, 1);

          data.edges = data.edges.filter(edge => 
            !(edge.from === nodeA.id && edge.to === nodeB.id) &&
            !(edge.from === nodeB.id && edge.to === nodeA.id)
          );
          if (typeof graph.removeEdge === 'function') {
            graph.removeEdge(nodeA.id, nodeB.id);
            graph.removeEdge(nodeB.id, nodeA.id);
          }
        }
      });

      return polyline;
    }

    // ---------------------------
    // 畫出初始的所有路線，並賦予超能力
    // ---------------------------
    const drawnEdges = new Set(); // 用來記錄畫過的線，避免雙向線條重複畫兩次疊在一起
    
    data.edges.forEach((edge) => {
      const fromNode = graph.nodes.get(edge.from);
      const toNode = graph.nodes.get(edge.to);
      
      // 🛡️ 護城河：過濾幽靈座標
      if (!fromNode || !toNode) return;
      const lat1 = Number(fromNode.lat); const lng1 = Number(fromNode.lng);
      const lat2 = Number(toNode.lat); const lng2 = Number(toNode.lng);
      if (isNaN(lat1) || isNaN(lng1) || isNaN(lat2) || isNaN(lng2) || Math.abs(lat1) > 90) return;

      // 產生唯一的路線 ID (不管 A到B 還是 B到A 都算同一條)
      const edgeKey = edge.from < edge.to ? `${edge.from}-${edge.to}` : `${edge.to}-${edge.from}`;
      
      // 如果這條線還沒畫過，就畫出來並賦予超能力
      if (!drawnEdges.has(edgeKey)) {
        createEditableEdge(fromNode, toNode, false);
        drawnEdges.add(edgeKey);
      }
    });

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
    // ==========================================
    // 🛠️ Dev 3 專用：顯示所有 Node 的 ID (開發完記得刪掉)
    // ==========================================
    data.nodes.forEach((node) => {
      if (!node.lat || !node.lng) return;
      // 在每個點上畫一個藍色的小圓圈
      L.circleMarker([node.lat, node.lng], {
        radius: 4,        // 圓圈大小
        color: 'blue',    // 外框顏色
        fillColor: '#30f',// 填滿顏色
        fillOpacity: 0.5  // 透明度
      })
      // 綁定一個點擊會彈出的視窗，裡面顯示 ID
      .bindPopup(`<b>尋找這棟樓！</b><br>ID: ${node.id}`)
      .addTo(map);
    });
    // ==========================================
    // 🛠️ 上帝模式 PRO：視覺化路網編輯器 (拖拉/刪除/新增點/新增線)
    // ==========================================
    
    const customIcon = L.divIcon({
      className: 'custom-div-icon',
      html: "<div style='background-color:#0055ff; width:12px; height:12px; border-radius:50%; border:2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);'></div>",
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    });

    // 距離計算公式 (用來自動算出新增連線的距離)
    function getDistance(lat1, lon1, lat2, lon2) {
      const R = 6371000;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
    }

    let selectedNodeForEdge = null; // 用來記錄你選了哪個點準備連線

    // 封裝函數：賦予每一個點超能力 (拖拉、刪除、連線)
    function createEditableMarker(node) {
      const marker = L.marker([node.lat, node.lng], {
        icon: customIcon,
        draggable: true,
        title: `ID: ${node.id}\n(左鍵點擊連線 / 右鍵點擊刪除)`
      }).addTo(map);

      // 📌 1. 拖拉中 (drag)：實時橡皮筋效果
      marker.on('drag', function (e) {
        const newPos = e.target.getLatLng();
        node.lat = newPos.lat;
        node.lng = newPos.lng;

        // 掃描所有畫在地圖上的線，如果起點或終點是我這顆節點，馬上把線拉過去！
        activePolylines.forEach(polyline => {
          if (polyline._nodeA.id === node.id || polyline._nodeB.id === node.id) {
            polyline.setLatLngs([
              [polyline._nodeA.lat, polyline._nodeA.lng],
              [polyline._nodeB.lat, polyline._nodeB.lng]
            ]);
          }
        });
      });

      // 📌 2. 拖拉結束 (dragend)：重新計算所有牽連道路的物理距離！
      marker.on('dragend', function (e) {
        // 更新資料庫裡的邊的距離 (不然線拉長了，Dijkstra 演算法還是會以為很短)
        data.edges.forEach(edge => {
          if (edge.from === node.id || edge.to === node.id) {
            // 找出線的另一端是誰
            const otherNodeId = edge.from === node.id ? edge.to : edge.from;
            const otherNode = data.nodes.find(n => n.id === otherNodeId);
            
            if (otherNode) {
              // 呼叫我們之前寫好的球面測距公式
              const newDist = getDistance(node.lat, node.lng, otherNode.lat, otherNode.lng);
              edge.distance = newDist;
            }
          }
        });
        console.log(`📏 節點 ${node.id} 已定位，相連的道路距離已重新校正！`);
      });

      // ✂️ 右鍵刪除點與線
      marker.on('contextmenu', function () {
        if (confirm(`確定要刪除節點 ${node.id} 嗎？`)) {
          map.removeLayer(marker);
          data.nodes = data.nodes.filter(n => n.id !== node.id);
          data.edges = data.edges.filter(e => e.from !== node.id && e.to !== node.id);
          graph.removeNode(node.id);
        }
      });

      // 🔗 左鍵點擊：建立連線 (Edge)
      marker.on('click', function (e) {
        L.DomEvent.stopPropagation(e); // 防止點擊事件穿透到地圖上變成「新增節點」
        
        if (!selectedNodeForEdge) {
          // 狀況 1：這是我點的「第一下」，記住這個起點
          selectedNodeForEdge = node;
          alert(`📍 已選取起點 (ID: ${node.id})\n👉 現在請點擊另一個節點來建立連線！`);
        } else {
          // 狀況 2：這是我點的「第二下」，準備把兩點連起來
          if (selectedNodeForEdge.id === node.id) {
            selectedNodeForEdge = null; // 點擊同一個點等於取消選取
            return;
          }
          
          const nodeA = selectedNodeForEdge;
          const nodeB = node;
          const dist = getDistance(nodeA.lat, nodeA.lng, nodeB.lat, nodeB.lng);

          // 新增雙向 Edge 進資料庫
          data.edges.push(
            { from: nodeA.id, to: nodeB.id, distance: dist, accessible: true },
            { from: nodeB.id, to: nodeA.id, distance: dist, accessible: true }
          );
          graph.addEdge({ from: nodeA.id, to: nodeB.id, distance: dist, accessible: true });
          graph.addEdge({ from: nodeB.id, to: nodeA.id, distance: dist, accessible: true });
          // 畫一條粗粗的紅線在畫面上，讓你知道連線成功了
          createEditableEdge(nodeA, nodeB, true);
          console.log(`✅ 連線成功！${nodeA.id} <--> ${nodeB.id}`);
          
          selectedNodeForEdge = null; // 連線完畢，清空狀態
        }
      });
    }

    // 1. 先把原本 JSON 裡的點都畫出來並賦予超能力
    data.nodes.forEach(node => createEditableMarker(node));

    // 2. ✨ 新增節點功能：點擊地圖空白處
    map.on('click', function(e) {
      if (selectedNodeForEdge) {
        selectedNodeForEdge = null; // 如果點到地圖，取消連線狀態
        return;
      }
      
      // 產生一個隨機不重複的 ID (用當前毫秒時間戳)
      const currentMaxId = data.nodes.reduce((max, node) => Math.max(max, Number(node.id)), 0);
      const newNodeId = currentMaxId + 1;
      const newNode = {
        id: newNodeId,
        name: "", // 如果是路徑節點不用名字，需要的話你可以自己手動加
        lat: e.latlng.lat,
        lng: e.latlng.lng,
        accessible: true,
        type: "path_node"
      };

      // 存進記憶體，並馬上畫到畫面上
      data.nodes.push(newNode);
      graph.addNode(newNode);
      createEditableMarker(newNode);
      console.log(`✨ 在座標 (${newNode.lat.toFixed(6)}, ${newNode.lng.toFixed(6)}) 建立新節點！`);
    });

    // (你之前寫好的 exportBtn 匯出按鈕不用改，繼續留著)
    // 💾 功能 3：點擊按鈕，打包下載成新的 campus_nodes_edges.json
    document.getElementById('exportBtn').addEventListener('click', () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "campus_nodes_edges.json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      alert("✅ 下載完成！\n請把載下來的新檔案覆蓋原本的 JSON，然後重整網頁！");
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
// ==========================================
// 🛠️ 開發者外掛：輸入雙 ID 自動計算距離與生成 Edge
// 用法：在 F12 Console 輸入 calcDistance(ID1, ID2)
// ==========================================
window.calcd = function(id1, id2) {
  // 1. 確保能找到這兩個點 (相容數字和字串格式的 ID)
  const node1 = graph.nodes.get(Number(id1)) || graph.nodes.get(String(id1));
  const node2 = graph.nodes.get(Number(id2)) || graph.nodes.get(String(id2));

  if (!node1) {
    console.error(`❌ 找不到起點 ID: ${id1}，請檢查 campus_nodes_edges.json 裡有沒有這個點！`);
    return;
  }
  if (!node2) {
    console.error(`❌ 找不到終點 ID: ${id2}，請檢查 campus_nodes_edges.json 裡有沒有這個點！`);
    return;
  }

  // 2. 轉換成 Leaflet 的座標物件
  const latlng1 = L.latLng(node1.lat, node1.lng);
  const latlng2 = L.latLng(node2.lat, node2.lng);

  // 3. 呼叫 Leaflet 內建的高精度球面測距公式
  const distance = latlng1.distanceTo(latlng2);

  // 4. 印出華麗的結果與懶人 JSON
  console.log(`%c📏 節點 [${id1}] 到 [${id2}] 的真實物理距離:`, "color: #00aaff; font-weight: bold; font-size: 14px;");
  console.log(`%c${distance.toFixed(2)} 公尺`, "color: #ffaa00; font-weight: bold; font-size: 18px;");
  
  console.log("%c🔗 請直接複製以下 Edge JSON 代碼:", "color: #00ff00; font-weight: bold;");
  console.log(`
    { 
      "from": ${id1},
      "to": ${id2}, 
      "distance": ${distance.toFixed(8)}, 
      "accessible": true 
     },`);

  // 5. (加碼特效) 在地圖上畫一條金色的虛線，讓你看確認有沒有連錯大樓
  L.polyline([latlng1, latlng2], { color: "gold", weight: 4, dashArray: "5, 10" }).addTo(map);
  
  // 自動把視角移到這條線上
  map.fitBounds(L.polyline([latlng1, latlng2]).getBounds(), { padding: [50, 50] });
};