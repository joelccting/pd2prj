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

async function fetchSegment(startsNames, endsNames, mode = "distance") {
  const startIds = [];
  startsNames.forEach(name => startIds.push(...nodesByName[name].map(n => n.id)));
  const endIds = [];
  endsNames.forEach(name => endIds.push(...nodesByName[name].map(n => n.id)));

  const response = await fetch(`http://localhost:8000/api/route/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ starts: startIds, ends: endIds, mode: mode })
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
  const routeWeight = document.getElementById("route-weight").value; // 🌟 新增：取得路線偏好 (lazy 或 distance)
  const startName = document.getElementById("start").value;
  const waypointSelects = document.querySelectorAll(".waypoint-select");
  let destinations = Array.from(waypointSelects).map(s => s.value).filter(v => v !== "");

  if (destinations.length === 0) return alert("請選擇至少一個目的地");

  let fullPath = [];
  let totalDist = 0;

  try {
    let visitOrder = [startName];

    if (cruiseMode === "single") {
      // 🌟 將 routeWeight 傳給 fetchSegment
      fullPath = await fetchSegment([startName], [destinations[0]], routeWeight);
      visitOrder.push(destinations[0]);
    } 
    else if (cruiseMode === "ordered") {
      let currentLoc = startName;
      for (let dest of destinations) {
        // 🌟 將 routeWeight 傳給 fetchSegment
        const segment = await fetchSegment([currentLoc], [dest], routeWeight);
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
        const segment = await fetchSegment([currentLoc], [nextDest], routeWeight);
        fullPath = fullPath.length === 0 ? segment : fullPath.concat(segment.slice(1));
        currentLoc = nextDest;
        visitOrder.push(nextDest);
      }
    }

    if (fullPath.length > 0) {
      drawPath(fullPath, visitOrder); // 🌟 將拜訪順序傳給畫圖函數
      totalDist = calculatePathDistance(fullPath);
      
      let avgSlope = 0;
      if (globalData) {
        let totalSlope = 0;
        let edgeCount = 0;
        for (let i = 0; i < fullPath.length - 1; i++) {
          const u = fullPath[i], v = fullPath[i+1];
          const edge = globalData.edges.find(e => (e.from===u&&e.to===v)||(e.from===v&&e.to===u));
          if (edge && edge.slope) { totalSlope += edge.slope; edgeCount++; }
        }
        avgSlope = edgeCount > 0 ? totalSlope / edgeCount : 0;
      }
      displayTravelTimes(totalDist, avgSlope);
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

// ==========================================
// 🌟 終極版畫線函數：支援方向箭頭與順序標記
// ==========================================
let currentPathLayerGroup = null; // 改用 LayerGroup 來打包線條、箭頭和標記

function drawPath(nodeIds, visitOrder = []) {
  // 1. 清除舊的圖層
  if (currentPathLayerGroup) {
    map.removeLayer(currentPathLayerGroup);
  }
  currentPathLayerGroup = L.layerGroup().addTo(map);

  // 2. 準備座標點
  const latlngs = nodeIds.map((nodeId) => {
    const node = graph.nodes.get(nodeId);
    return [node.lat, node.lng];
  });

  // 3. 畫出半透明的底線 (改成藍色，視覺上比較清爽)
  const polyline = L.polyline(latlngs, { 
    color: "#0066ff", 
    weight: 6, 
    opacity: 0.6 
  }).addTo(currentPathLayerGroup);

  // 4. 畫出方向箭頭 (每 80px 畫一個實心小箭頭)
  try {
    L.polylineDecorator(polyline, {
      patterns: [
        {
          offset: 20,    // 縮短起始距離，確保短路徑也能出現箭頭
          repeat: 70,    // 稍微增加箭頭密度
          symbol: L.Symbol.arrowHead({
            pixelSize: 14, 
            polygon: true, 
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

  // 6. 視角縮放
  map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
}

function displayTravelTimes(totalDistance, averageSlope) {
  const bar = document.getElementById("top-info-bar");
  const container = document.getElementById("time-results");
  if (!container || !bar) return;
  bar.style.display = "block";

  const walkSpeed = 1.2 / (1 + averageSlope * 10);
  let bikeSpeed = 4.2 / (1 + averageSlope * 5);
  if (averageSlope > 0.08) bikeSpeed = 1.2; 
  const eBikeSpeed = 5.5; const carSpeed = 8.3; const motoSpeed = 8.3;

  const formatTime = (totalSeconds) => {
    if (!isFinite(totalSeconds) || totalSeconds <= 0) return `0 ${window.t("time_sec")}`;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.round(totalSeconds % 60);
    return minutes === 0 ? `${seconds} ${window.t("time_sec")}` : `${minutes} ${window.t("time_min")} ${seconds} ${window.t("time_sec")}`;
  };

  const times = [
    { icon: "🚶", label: window.t("time_walk"), sec: totalDistance / walkSpeed },
    { icon: "🚲", label: window.t("time_bike"), sec: totalDistance / bikeSpeed },
    { icon: "⚡", label: window.t("time_ebike"), sec: totalDistance / eBikeSpeed },
    { icon: "🚗", label: window.t("time_car"), sec: totalDistance / carSpeed },
    { icon: "🛵", label: window.t("time_motorcycle"), sec: totalDistance / motoSpeed }
  ];

  let html = "";
  times.forEach(item => {
    html += `<div class="time-card"><span class="icon">${item.icon}</span><span class="label">${item.label}</span><span class="time-text">${formatTime(item.sec)}</span></div>`;
  });
  container.innerHTML = html;
}