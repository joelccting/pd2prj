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

// 🌟 將變數提昇到外層，讓下方尋路邏輯讀得到
let nodesByName = {};
let locationMarkers = [];
let globalData = null;
const activePolylines = [];

fetch('http://localhost:8000/api/graph')
  .then((response) => response.json())
  .then((data) => {
    globalData = data;
    data.nodes.forEach(node => graph.addNode(node));
    data.edges.forEach(edge => graph.addEdge(edge));

    data.nodes.forEach((node) => {
      if (node.name && node.name.trim() !== "") {
        const name = node.name.trim();
        if (!nodesByName[name]) nodesByName[name] = [];
        nodesByName[name].push(node);
      }
    });

    for (const name in nodesByName) {
      const nodes = nodesByName[name];
      const avgLat = nodes.reduce((sum, node) => sum + node.lat, 0) / nodes.length;
      const avgLng = nodes.reduce((sum, node) => sum + node.lng, 0) / nodes.length;
      locationMarkers.push({ name: name, lat: avgLat, lng: avgLng });
    }

    locationMarkers.forEach((location) => {
      L.marker([location.lat, location.lng]).bindPopup(location.name).addTo(map);
    });

    // 初始化第一個起點與終點選單
    populateDropdown(document.getElementById("start"));
    populateDropdown(document.querySelector(".waypoint-select"));
    
    // 初始化語言
    const langSelectElement = document.getElementById("language-selector");
    if (langSelectElement) {
      window.updateDropdownLanguage(langSelectElement.value);
    }

    initEditorMode(map, data, graph);
  });

// ==========================================
// 🌟 獨立封裝：產生下拉選單選項
// ==========================================
function populateDropdown(selectElement) {
  if (!selectElement) return;
  selectElement.innerHTML = ""; // 清空

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

// 覆寫全局翻譯大樓的函數 (讓所有 waypoint-select 都能被翻譯)
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

// ==========================================
// 🌟 巡航導航邏輯
// ==========================================
const waypointContainer = document.getElementById('waypoint-container');
const addBtn = document.getElementById('add-waypoint');

addBtn.addEventListener('click', () => {
  const newItem = waypointContainer.firstElementChild.cloneNode(true);
  const newSelect = newItem.querySelector('.waypoint-select');
  populateDropdown(newSelect); // 重新填入選項
  
  // 套用當前語言
  const currentLang = document.getElementById("language-selector").value;
  window.updateDropdownLanguage(currentLang);

  newItem.querySelector('.btn-remove-waypoint').style.display = "block";
  newItem.querySelector('.btn-remove-waypoint').onclick = function() { this.parentElement.remove(); };
  waypointContainer.appendChild(newItem);
});

async function fetchSegment(startsNames, endsNames, mode = "distance", vehicle = "walk") {
  const startIds = [];
  startsNames.forEach(name => startIds.push(...nodesByName[name].map(n => n.id)));
  const endIds = [];
  endsNames.forEach(name => endIds.push(...nodesByName[name].map(n => n.id)));

  const response = await fetch(`http://localhost:8000/api/route/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ starts: startIds, ends: endIds, mode: mode, vehicle: vehicle }) // 🌟 傳出 vehicle
  });
  const result = await response.json();
  return result.path || [];
}

function getLinearDist(name1, name2) {
    const n1 = locationMarkers.find(m => m.name === name1);
    const n2 = locationMarkers.find(m => m.name === name2);
    return Math.sqrt(Math.pow(n1.lat - n2.lat, 2) + Math.pow(n1.lng - n2.lng, 2));
}

  document.getElementById("findRoute").addEventListener("click", async () => {
  const cruiseMode = document.getElementById("cruise-mode").value;
  const routeWeight = document.getElementById("route-weight").value; 
  const startName = document.getElementById("start").value;
  const selectedTransport = document.getElementById("transport-mode").value; // 🌟 取得當前交通工具
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
        // 🌟 將 routeWeight 傳給 fetchSegment
        const segment = await fetchSegment([startName], [destinations[0]], routeWeight, selectedTransport);
        fullPath = fullPath.length === 0 ? segment : fullPath.concat(segment.slice(1));
        currentLoc = nextDest;
        visitOrder.push(nextDest);
      }
    }

    if (fullPath.length > 0) {
      drawPath(fullPath, visitOrder); 
      totalDist = calculatePathDistance(fullPath); // 依然保留，給 UI 顯示總距離用
      
      const selectedTransport = document.getElementById("transport-mode").value;
      
      // 🌟 新增：分開計算主要交通時間與步行(牽車)時間
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

          // 🌟 判斷這一段是否需要牽車 (該交通工具屬性為0，或是原本就選步行)
          const isWalkRequired = (edge && edge[selectedTransport] === 0) || selectedTransport === "walk";
          
          let speed = 1.2; 
          if (isWalkRequired) {
              // 牽車/步行速度
              speed = 1.2 / (1 + edgeSlope * 10);
              if (speed <= 0.5 || !isFinite(speed)) speed = 1.2; 
              totalWalkSeconds += (edgeDist / speed);
          } else {
              // 騎乘/駕駛速度
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

      // 🌟 將分開計算的時間傳給 UI 介面
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


// 🌟 接收精準的總秒數與使用者選擇的交通工具
// 🌟 更新：接收主交通時間與牽車時間，並動態產生 UI
function displayTravelTimes(mainSeconds, walkSeconds, selectedMode) {
  const bar = document.getElementById("top-info-bar");
  const container = document.getElementById("time-results");
  if (!container || !bar) return;
  
  bar.style.display = "block"; // 確保時間條顯示出來

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

  // 1. 顯示主要交通工具的時間 (如果有真的騎乘到)
  if (selectedMode !== "walk" && mainSeconds > 0) {
    html += `
      <div class="time-card highlight-card">
        <span class="icon">${currentData.icon}</span>
        <span class="label">${currentData.label}</span>
        <span class="time-text">${formatTime(mainSeconds)}</span>
      </div>
    `;
  }

  // 2. 顯示步行或牽車的時間
  if (walkSeconds > 0 || selectedMode === "walk") {
    const walkLabel = (selectedMode !== "walk") ? "牽車路段" : "步行";
    // 如果是牽車狀態，套用橘色警示視覺效果以作區分
    const style = selectedMode !== "walk" ? "background: #fff3e0; border: 1px solid #ff9800; color: #e65100;" : "";
    html += `
      <div class="time-card highlight-card" style="${style}">
        <span class="icon">🚶</span>
        <span class="label">${walkLabel}</span>
        <span class="time-text">${formatTime(walkSeconds)}</span>
      </div>
    `;
  }

  // 3. 如果是混合路段 (有騎車也有牽車)，額外顯示一個總時間
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

let currentPathLayerGroup = null; // 改用 LayerGroup 來打包線條、箭頭和標記

function drawPath(nodeIds, visitOrder = []) {
  if (currentPathLayerGroup) map.removeLayer(currentPathLayerGroup);
  currentPathLayerGroup = L.layerGroup().addTo(map);

  const selectedTransport = document.getElementById("transport-mode").value; // 🌟 取得交通工具
  let currentSegmentLatLngs = [];
  let currentIsWalk = false;

  // 🌟 分段繪製邏輯：遇到牽車路段切換為橘色虛線
  for (let i = 0; i < nodeIds.length - 1; i++) {
    const u = nodeIds[i], v = nodeIds[i+1];
    const nodeU = graph.nodes.get(u), nodeV = graph.nodes.get(v);
    const edge = globalData.edges.find(e => (e.from===u&&e.to===v)||(e.from===v&&e.to===u));
    
    // 判斷此小段是否需要牽車
    const isWalkRequired = edge && edge[selectedTransport] === 0;

    if (i === 0) {
        currentIsWalk = isWalkRequired;
        currentSegmentLatLngs.push([nodeU.lat, nodeU.lng]);
    } else if (currentIsWalk !== isWalkRequired) {
        // 狀態改變，把累積的點畫出來
        currentSegmentLatLngs.push([nodeU.lat, nodeU.lng]);
        L.polyline(currentSegmentLatLngs, {
            color: currentIsWalk ? "#ff9900" : "#0066ff", // 牽車橘色，一般藍色
            weight: 6,
            opacity: 0.8,
            dashArray: currentIsWalk ? "10, 10" : null // 牽車套用虛線
        }).addTo(currentPathLayerGroup);
        // 重置為下一段的起點
        currentSegmentLatLngs = [[nodeU.lat, nodeU.lng]];
        currentIsWalk = isWalkRequired;
    }
    currentSegmentLatLngs.push([nodeV.lat, nodeV.lng]);
  }

  // 畫出最後剩餘的線段
  if (currentSegmentLatLngs.length > 1) {
      L.polyline(currentSegmentLatLngs, {
          color: currentIsWalk ? "#ff9900" : "#0066ff", 
          weight: 6, opacity: 0.8,
          dashArray: currentIsWalk ? "10, 10" : null
      }).addTo(currentPathLayerGroup);
  }

  // 為了讓箭頭連續，我們再畫一條透明的底線來附著箭頭
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

  // 5. 在目的地畫上「數字順序標記」 (1, 2, 3...)
  visitOrder.forEach((name, index) => {
    const loc = locationMarkers.find(m => m.name === name);
    if (loc) {
      const isStart = index === 0;
      const isEnd = index === visitOrder.length - 1;
      
      // 起點綠色、終點紅色、中間停靠站橘色
      let bgColor = isStart ? '#4CAF50' : (isEnd ? '#F44336' : '#FF9800');
      
      const icon = L.divIcon({
        className: 'sequence-marker',
        html: `<div style="background:${bgColor}; color:white; width:26px; height:26px; border-radius:50%; text-align:center; line-height:26px; font-weight:bold; border:2px solid white; box-shadow:0 0 6px rgba(0,0,0,0.5); font-size:14px; position:relative; top:-13px; left:-13px;">${index + 1}</div>`,
        iconSize: [0, 0] // 將基準點設在中心
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