import { initEditorMode } from './editor.js';

const corner1 = L.latLng(23.550, 120.460);
const corner2 = L.latLng(23.570, 120.485);
const campusBounds = L.latLngBounds(corner1, corner2);

const map = L.map('map', {
  center: [23.560, 120.470],
  zoom: 16,
  maxBounds: campusBounds,
  maxBoundsViscosity: 0.5,
  minZoom: 16,
  maxZoom: 22
});

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; OpenStreetMap',
  maxNativeZoom: 18,
  maxZoom: 22,
  tileSize: 512,
  zoomOffset: -1
}).addTo(map);

let currentFullPath = [];
let nodesByName = {};
let locationMarkers = [];
let globalData = null;
const activePolylines = [];
const treeShadeLayer = L.layerGroup().addTo(map);
const buildingShadowLayer = L.layerGroup().addTo(map);

// 使變數全局可訪問（用於調試）
window.nodesByName = nodesByName;
window.locationMarkers = locationMarkers;

fetch('http://localhost:8000/api/graph')
  .then((response) => {
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
  })
  .then((data) => {
    console.log('✅ Graph data loaded:', data);
    console.log('📊 Data structure:', {
      hasNodes: !!data.nodes,
      nodesCount: data.nodes?.length || 0,
      hasEdges: !!data.edges,
      edgesCount: data.edges?.length || 0,
      firstNode: data.nodes?.[0]
    });
    
    if (!data.nodes || data.nodes.length === 0) {
      console.error('❌ ERROR: API 返回空的 nodes 數組！');
      console.error('可能原因：');
      console.error('1. campus_nodes_edges_updated.json 不存在');
      console.error('2. campus_nodes_edges.json 不存在');
      console.error('3. Python 伺服器未正確啟動');
      alert('❌ 錯誤：無法加載校園數據！\n\n請檢查:\n1. Python 伺服器是否運行\n2. JSON 數據文件是否存在');
      return;
    }
    
    globalData = data;
    window.globalData = data; // 全局可訪問
    
    data.nodes.forEach(node => graph.addNode(node));
    data.edges.forEach(edge => graph.addEdge(edge));

    // 嘗試多種可能的名稱屬性
    data.nodes.forEach((node) => {
      let nodeName = node.name || node.building_name || node.location || node.title;
      
      if (nodeName && typeof nodeName === 'string' && nodeName.trim() !== "") {
        const name = nodeName.trim();
        if (!nodesByName[name]) nodesByName[name] = [];
        nodesByName[name].push(node);
      }
    });

    console.log('🏢 Nodes with names found:', Object.keys(nodesByName).length);
    console.log('🏢 Sample locations:', Object.keys(nodesByName).slice(0, 5));

    for (const name in nodesByName) {
      const nodes = nodesByName[name];
      const avgLat = nodes.reduce((sum, node) => sum + (node.lat || 0), 0) / nodes.length;
      const avgLng = nodes.reduce((sum, node) => sum + (node.lng || 0), 0) / nodes.length;
      
      // 只在有效座標時添加
      if (!isNaN(avgLat) && !isNaN(avgLng)) {
        locationMarkers.push({ name: name, lat: avgLat, lng: avgLng });
      }
    }

    console.log('📍 Location markers created:', locationMarkers.length);
    
    // 更新全局引用
    window.nodesByName = nodesByName;
    window.locationMarkers = locationMarkers;

    locationMarkers.forEach((location) => {
      L.marker([location.lat, location.lng]).bindPopup(location.name).addTo(map);
    });

    populateDropdown(document.getElementById("start"));
    populateDropdown(document.querySelector(".waypoint-select"));
    
    const langSelectElement = document.getElementById("language-selector");
    if (langSelectElement) {
      console.log('🌐 Language selector value:', langSelectElement.value);
      if (window.updateDropdownLanguage) {
        window.updateDropdownLanguage(langSelectElement.value);
      }
    }

    initEditorMode(map, data, graph);
  })
  .catch((error) => {
    console.error('❌ Failed to load graph data:', error);
    alert('⚠️ 無法連接到後端API！\n請確保已啟動 Python 伺服器\n\nhttp://localhost:8000/api/graph');
  });

function populateDropdown(selectElement) {
  if (!selectElement) return;
  selectElement.innerHTML = ""; 

  const optGroups = {
    "school": { zh: "🏫 學校建築", en: "🏫 School Buildings", el: document.createElement("optgroup") },
    "housing": { zh: "🛏️ 住宿區", en: "🛏️ Accommodation", el: document.createElement("optgroup") },
    "dining": { zh: "🍔 飲食與生活", en: "🍔 Dining & Life", el: document.createElement("optgroup") }
  };

  Object.keys(optGroups).forEach(key => {
    optGroups[key].el.dataset.i18nCat = key;
  });

  function getCategory(name) {
    const overrides = { "嘉農小館": "dining", "康乃爾學院": "housing", "苗園":"housing" };
    if (overrides[name]) return overrides[name];
    if (name.includes("全家") || name.includes("7-ELEVEN") || name.includes("萊爾富") || name.includes("蝦皮") || name.includes("早餐")) return "dining";
    const housingNames = ["伯爵", "陶潛", "現代首席", "京采", "墨香苑", "陶居", "木菊苑", "書香門第", "常春藤", "鼎泰", "柏克萊", "彬彬", "夏都", "深白舍", "橙舍", "節能宿舍"];
    if (name.includes("宿舍") || name.includes("學苑") || name.includes("會館") || name.includes("凱格鹿") || housingNames.some(h => name.includes(h))) return "housing";
    const schoolNames = ["禮堂", "實習工廠", "苗圃", "動物實驗室", "變電所", "納米運動", "三興國小"];
    if (name.includes("大樓") || name.includes("學院") || name.includes("教室") || name.includes("系") || name.includes("館") || name.includes("活動中心") || name.includes("環安中心") || schoolNames.some(s => name.includes(s))) return "school";
    return "dining"; 
  }

  locationMarkers.forEach((location) => {
    const cat = getCategory(location.name);
    const option = document.createElement("option");
    option.value = location.name; 
    option.text = location.name;
    optGroups[cat].el.appendChild(option);
  });

  Object.keys(optGroups).forEach(key => selectElement.appendChild(optGroups[key].el));
}

window.updateDropdownLanguage = function(currentLang) {
  document.querySelectorAll(".modern-select").forEach(selectElement => {
    if (selectElement.id === "language-selector" || selectElement.id === "cruise-mode") return;

    selectElement.querySelectorAll("optgroup").forEach(group => {
      const catKey = group.dataset.i18nCat;
      const catTranslations = {
        "school": { zh: "🏫 學校建築", en: "🏫 School Buildings" },
        "housing": { zh: "🛏️ 住宿區", en: "🛏️ Accommodation" },
        "dining": { zh: "🍔 飲食與生活", en: "🍔 Dining & Life" }
      };
      if (catTranslations[catKey] && catTranslations[catKey][currentLang]) {
        group.label = catTranslations[catKey][currentLang];
      }
    });

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
  });
};

const waypointContainer = document.getElementById('waypoint-container');
const addBtn = document.getElementById('add-waypoint');

addBtn.addEventListener('click', () => {
  const newItem = waypointContainer.firstElementChild.cloneNode(true);
  const newSelect = newItem.querySelector('.waypoint-select');
  populateDropdown(newSelect); 
  
  const currentLang = document.getElementById("language-selector").value;
  window.updateDropdownLanguage(currentLang);

  newItem.querySelector('.btn-remove-waypoint').style.display = "block";
  newItem.querySelector('.btn-remove-waypoint').onclick = function() { this.parentElement.remove(); };
  waypointContainer.appendChild(newItem);
});

async function fetchSegment(startsNames, endsNames, mode = "distance", vehicle = "walk") {
  const startIds = [];
  startsNames.forEach(name => {
    if (nodesByName[name]) {
      startIds.push(...nodesByName[name].map(n => n.id));
    }
  });
  
  const endIds = [];
  endsNames.forEach(name => {
    if (nodesByName[name]) {
      endIds.push(...nodesByName[name].map(n => n.id));
    }
  });

  if (startIds.length === 0 || endIds.length === 0) {
    console.warn('⚠️ 無效的起終點位置');
    return [];
  }

  try {
    const response = await fetch(`http://localhost:8000/api/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        starts: startIds, 
        ends: endIds, 
        mode: mode, 
        vehicle: vehicle 
      }) 
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('📍 Route response:', result);

    // 加上這段來捕捉真實後端錯誤
    if (result.status === "error") {
      console.error("❌ 後端錯誤:", result.message, result.details);
      alert(`路徑計算失敗：${result.message}`);
      return [];
    }

    return result.path || [];
  } catch (error) {
    console.error('❌ Failed to fetch route:', error);
    return [];
  }
}

function getLinearDist(name1, name2) {
    const n1 = locationMarkers.find(m => m.name === name1);
    const n2 = locationMarkers.find(m => m.name === name2);
    return Math.sqrt(Math.pow(n1.lat - n2.lat, 2) + Math.pow(n1.lng - n2.lng, 2));
}

document.getElementById("findRoute").addEventListener("click", async () => {
  const cruiseMode = document.getElementById("cruise-mode").value;
  const routeWeight = document.getElementById("route-weight").value; // 包含 shade 模式
  const startName = document.getElementById("start").value;
  const selectedTransport = document.getElementById("transport-mode").value; 
  const waypointSelects = document.querySelectorAll(".waypoint-select");
  let destinations = Array.from(waypointSelects).map(s => s.value).filter(v => v !== "");

  if (destinations.length === 0) return alert("請選擇至少一個目的地");

  let fullPath = [];
  let totalDist = 0;

  try {
    let visitOrder = [startName];

    if (cruiseMode === "single") {
      fullPath = await fetchSegment([startName], [destinations[0]], routeWeight, selectedTransport); 
      visitOrder.push(destinations[0]);
    } 
    else if (cruiseMode === "ordered") {
      let currentLoc = startName;
      for (let dest of destinations) {
        const segment = await fetchSegment([currentLoc], [dest], routeWeight, selectedTransport); 
        if (segment.length > 0) {
          fullPath = fullPath.length === 0 ? segment : fullPath.concat(segment.slice(1));
          currentLoc = dest;
          visitOrder.push(dest);
        }
      }
    } 
    else if (cruiseMode === "optimized") {
      let currentLoc = startName;
      let remaining = [...destinations];
      
      while (remaining.length > 0) {
        let nearestIdx = 0;
        let minDist = Infinity;
        for(let i=0; i<remaining.length; i++) {
            let d = getLinearDist(currentLoc, remaining[i]); 
            if(d < minDist) { minDist = d; nearestIdx = i; }
        }
        const nextDest = remaining.splice(nearestIdx, 1)[0];
        const segment = await fetchSegment([startName], [nextDest], routeWeight, selectedTransport);
        fullPath = fullPath.length === 0 ? segment : fullPath.concat(segment.slice(1));
        currentLoc = nextDest;
        visitOrder.push(nextDest);
      }
    }

    if (fullPath.length > 0) {
      currentFullPath = fullPath;
      drawPath(fullPath, visitOrder, routeWeight); 
      totalDist = calculatePathDistance(fullPath);
      
      let totalMainSeconds = 0;
      let totalWalkSeconds = 0;

      if (globalData) {
        for (let i = 0; i < fullPath.length - 1; i++) {
          const u = fullPath[i], v = fullPath[i+1];
          const edge = globalData.edges.find(e => (e.from===u&&e.to===v)||(e.from===v&&e.to===u));
          
          let edgeDist = edge ? edge.distance : 0;
          if (!edge) {
             const edges = graph.adjacencyList.get(u) || [];
             const adjEdge = edges.find(e => e.to === v);
             edgeDist = adjEdge ? adjEdge.weight : 0;
          }

          let edgeSlope = (edge && edge.slope) ? parseFloat(edge.slope) : 0;
          edgeSlope = Math.abs(edgeSlope);
          if (edgeSlope > 0.15) edgeSlope = 0; 

          const isWalkRequired = (edge && edge[selectedTransport] === 0) || selectedTransport === "walk";
          
          let speed = 1.2; 
          if (isWalkRequired) {
              speed = 1.2 / (1 + edgeSlope * 10);
              if (speed <= 0.5 || !isFinite(speed)) speed = 1.2; 
              totalWalkSeconds += (edgeDist / speed);
          } else {
              if (selectedTransport === "bike") {
                  speed = edgeSlope > 0.08 ? 1.2 : 4.2 / (1 + edgeSlope * 5);
              } else if (selectedTransport === "ebike") {
                  speed = 5.5;
              } else if (selectedTransport === "car" || selectedTransport === "motorcycle") {
                  speed = 8.3;
              }
              if (speed <= 0.5 || !isFinite(speed)) speed = 1.2; 
              totalMainSeconds += (edgeDist / speed);
          }
        }
      }

      displayTravelTimes(totalMainSeconds, totalWalkSeconds, selectedTransport);
      
    } else {
      alert("無法找到完整巡航路徑！請確認是否有獨立未連通的地點。");
    }
  } catch (error) {
    console.error("巡航導航失敗:", error);
  }
});

function calculatePathDistance(path) {
  let totalDistance = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const fromNodeId = path[i];
    const toNodeId = path[i + 1];
    const edges = graph.adjacencyList.get(fromNodeId) || [];
    const edge = edges.find((e) => e.to === toNodeId);
    if (edge) totalDistance += edge.weight;
  }
  return totalDistance;
}

function displayTravelTimes(mainSeconds, walkSeconds, selectedMode) {
  const bar = document.getElementById("top-info-bar");
  const container = document.getElementById("time-results");
  if (!container || !bar) return;
  
  bar.style.display = "block";

  const modeData = {
    "walk": { icon: "🚶", label: "步行" },
    "bike": { icon: "🚲", label: "腳踏車" },
    "ebike": { icon: "⚡", label: "電動車" },
    "car": { icon: "🚗", label: "汽車" },
    "motorcycle": { icon: "🛵", label: "機車" }
  };

  const formatTime = (seconds) => {
    if (!isFinite(seconds) || seconds <= 0) return `0 秒`;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return m === 0 ? `${s} 秒` : `${m} 分 ${s} 秒`;
  };

  const currentData = modeData[selectedMode] || modeData["walk"];
  let html = "";

  if (selectedMode !== "walk" && mainSeconds > 0) {
    html += `
      <div class="time-card highlight-card">
        <span class="icon">${currentData.icon}</span>
        <span class="label">${currentData.label}</span>
        <span class="time-text">${formatTime(mainSeconds)}</span>
      </div>
    `;
  }

  if (walkSeconds > 0 || selectedMode === "walk") {
    const walkLabel = (selectedMode !== "walk") ? "牽車路段" : "步行";
    const style = selectedMode !== "walk" ? "background: #fff3e0; border: 1px solid #ff9800; color: #e65100;" : "";
    html += `
      <div class="time-card highlight-card" style="${style}">
        <span class="icon">🚶</span>
        <span class="label">${walkLabel}</span>
        <span class="time-text">${formatTime(walkSeconds)}</span>
      </div>
    `;
  }

  if (selectedMode !== "walk" && mainSeconds > 0 && walkSeconds > 0) {
    const total = mainSeconds + walkSeconds;
    html += `
      <div class="time-card highlight-card" style="background: #e3f2fd; border: 1px solid #2196f3; color: #0d47a1;">
        <span class="icon">⏱️</span>
        <span class="label">預估總時間</span>
        <span class="time-text">${formatTime(total)}</span>
      </div>
    `;
  }

  container.innerHTML = html;
}

let currentPathLayerGroup = null;

// 👇 接收 mode 參數，並根據 mode 決定路線基礎顏色
function drawPath(nodeIds, visitOrder = [], mode = "distance") {
  if (currentPathLayerGroup) map.removeLayer(currentPathLayerGroup);
  currentPathLayerGroup = L.layerGroup().addTo(map);

  const selectedTransport = document.getElementById("transport-mode").value; 
  let currentSegmentLatLngs = [];
  let currentIsWalk = false;

  // 判斷是否為避暑模式：是的話用深綠色，並且線條加粗
  let baseColor = (mode === "shade") ? "#2E7D32" : "#0066ff";
  let baseWeight = (mode === "shade") ? 8 : 6;

  for (let i = 0; i < nodeIds.length - 1; i++) {
    const u = nodeIds[i], v = nodeIds[i+1];
    const nodeU = graph.nodes.get(u), nodeV = graph.nodes.get(v);
    const edge = globalData.edges.find(e => (e.from===u&&e.to===v)||(e.from===v&&e.to===u));
    
    const isWalkRequired = edge && edge[selectedTransport] === 0;

    if (i === 0) {
        currentIsWalk = isWalkRequired;
        currentSegmentLatLngs.push([nodeU.lat, nodeU.lng]);
    } else if (currentIsWalk !== isWalkRequired) {
        currentSegmentLatLngs.push([nodeU.lat, nodeU.lng]);
        L.polyline(currentSegmentLatLngs, {
            color: currentIsWalk ? "#ff9900" : baseColor, // 牽車維持橘色警告
            weight: baseWeight,
            opacity: 0.8,
            dashArray: currentIsWalk ? "10, 10" : null 
        }).addTo(currentPathLayerGroup);
        
        currentSegmentLatLngs = [[nodeU.lat, nodeU.lng]];
        currentIsWalk = isWalkRequired;
    }
    currentSegmentLatLngs.push([nodeV.lat, nodeV.lng]);
  }

  if (currentSegmentLatLngs.length > 1) {
      L.polyline(currentSegmentLatLngs, {
          color: currentIsWalk ? "#ff9900" : baseColor, 
          weight: baseWeight, opacity: 0.8,
          dashArray: currentIsWalk ? "10, 10" : null
      }).addTo(currentPathLayerGroup);
  }

  const fullLatlngs = nodeIds.map(id => [graph.nodes.get(id).lat, graph.nodes.get(id).lng]);
  const invisibleLine = L.polyline(fullLatlngs, { color: 'transparent' }).addTo(currentPathLayerGroup);

  try {
    L.polylineDecorator(invisibleLine, {
      patterns: [
        {
          offset: 20, repeat: 70,
          symbol: L.Symbol.arrowHead({
            pixelSize: 14, polygon: true, 
            pathOptions: { stroke: true, color: '#ffffff', fillColor: '#ff0044', fillOpacity: 1, weight: 2 }
          })
        }
      ]
    }).addTo(currentPathLayerGroup);
  } catch (error) {
    console.error("🚨 箭頭套件發生錯誤或未載入：", error);
  }

  visitOrder.forEach((name, index) => {
    const loc = locationMarkers.find(m => m.name === name);
    if (loc) {
      const isStart = index === 0;
      const isEnd = index === visitOrder.length - 1;
      let bgColor = isStart ? '#4CAF50' : (isEnd ? '#F44336' : '#FF9800');
      
      const icon = L.divIcon({
        className: 'sequence-marker',
        html: `<div style="background:${bgColor}; color:white; width:26px; height:26px; border-radius:50%; text-align:center; line-height:26px; font-weight:bold; border:2px solid white; box-shadow:0 0 6px rgba(0,0,0,0.5); font-size:14px; position:relative; top:-13px; left:-13px;">${index + 1}</div>`,
        iconSize: [0, 0] 
      });
      
      L.marker([loc.lat, loc.lng], { icon: icon, zIndexOffset: 1000 })
       .bindPopup(`<b>${index + 1}. ${name}</b>`)
       .addTo(currentPathLayerGroup);
    }
  });

  if (invisibleLine) {
      map.fitBounds(invisibleLine.getBounds(), { padding: [50, 50] });
  }
}
//  新增：在地圖上繪製特定環境路段的輔助函數
function drawEdgesOnLayer(edgesToDraw, layerGroup, color, weight, opacity, dashArray = null) {
  layerGroup.clearLayers(); // 先清空舊有的繪製線條
  
  edgesToDraw.forEach(edge => {
    // 從載入的全局節點資料中找出起終點座標
    const nodeU = globalData.nodes.find(n => n.id === edge.from);
    const nodeV = globalData.nodes.find(n => n.id === edge.to);
    
    if (nodeU && nodeV) {
      L.polyline([[nodeU.lat, nodeU.lng], [nodeV.lat, nodeV.lng]], {
        color: color,
        weight: weight,
        opacity: opacity,
        dashArray: dashArray,
        lineCap: 'round'
      }).addTo(layerGroup);
    }
  });
}

// 建立一個專屬的圖層群組來放所有的真實陰影與樹蔭
const realtimeShadowLayer = L.layerGroup().addTo(map);

document.getElementById('toggle-realtime-shadow').addEventListener('change', async function(e) {
  realtimeShadowLayer.clearLayers(); // 每次切換前先清空

  if (e.target.checked) {
    // 防呆：如果還沒有產生路徑
    if (!currentFullPath || currentFullPath.length === 0) {
      alert("請先開始巡航導航，再開啟陰影顯示！");
      e.target.checked = false;
      return;
    }

    try {
      // 1. 篩選出「當前導航路徑」上的所有 Edges
      const pathEdges = [];
      for (let i = 0; i < currentFullPath.length - 1; i++) {
        const u = currentFullPath[i], v = currentFullPath[i+1];
        const edge = globalData.edges.find(e => (e.from===u&&e.to===v) || (e.from===v&&e.to===u));
        if (edge) pathEdges.push(edge);
      }

      // 2. 處理樹蔭 (僅針對當前路徑)
      const treeShadedEdges = pathEdges.filter(edge => edge.tree_shade > 0.5);
      
      // 繪製路徑上的樹蔭 (疊加深色透明線條)
      if (treeShadedEdges.length > 0) {
        drawEdgesOnLayer(treeShadedEdges, realtimeShadowLayer, '#1a1a1a', 8, 0.6);
      }

      // 3. 處理建築物即時陰影 (配合 shadow_calculator.py)
      // 由於不需要畫出全圖 Polygon 蓋住畫面，若你的後端有將 building_shade 寫入 Edge，可以直接像樹蔭一樣濾出：
      const buildingShadedEdges = pathEdges.filter(edge => edge.building_shade > 0.5);
      if (buildingShadedEdges.length > 0) {
        drawEdgesOnLayer(buildingShadedEdges, realtimeShadowLayer, '#1a1a1a', 8, 0.6);
      } 

    } catch (error) {
      console.error("❌ 獲取即時陰影失敗:", error);
      alert("無法套用陰影圖層，請檢查資料或 API。");
      e.target.checked = false;
    }
  }
});
const routeWeightSelect = document.getElementById("route-weight");
const shadowToggle = document.getElementById("toggle-realtime-shadow");

function updateShadowToggleState() {
  const isShadeMode = routeWeightSelect.value === "shade";
  
  shadowToggle.disabled = !isShadeMode;
  shadowToggle.parentElement.style.opacity = isShadeMode ? "1" : "0.5";
  shadowToggle.parentElement.style.cursor = isShadeMode ? "pointer" : "not-allowed";
  
  // 如果切換回非 shade 模式，強制取消勾選並清除陰影圖層
  if (!isShadeMode) {
    shadowToggle.checked = false;
    realtimeShadowLayer.clearLayers();
  }
}

// 監聽下拉選單變化
routeWeightSelect.addEventListener("change", updateShadowToggleState);
// 初始執行一次以設定正確狀態
updateShadowToggleState();