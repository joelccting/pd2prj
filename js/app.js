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
        const categoryCounts = nodes.reduce((counts, node) => {
          const category = node.category || getCategory(name);
          counts[category] = (counts[category] || 0) + 1;
          return counts;
        }, {});
        const category = Object.entries(categoryCounts)
          .sort((a, b) => b[1] - a[1])[0]?.[0] || getCategory(name);

        locationMarkers.push({ name: name, lat: avgLat, lng: avgLng, category });
      }
    }

    console.log('📍 Location markers created:', locationMarkers.length);
    
    // 更新全局引用
    window.nodesByName = nodesByName;
    window.locationMarkers = locationMarkers;

    locationMarkers.forEach((location) => {
      const categoryInfo = window.buildingCategories[location.category] || window.buildingCategories.school;
      L.marker([location.lat, location.lng], {
        icon: createLocationMarkerIcon(location.category)
      }).bindPopup(`
        <div style="font-size: 12px;">
          <b>${location.name}</b><br/>
          分類: ${categoryInfo.zh} ${categoryInfo.en}
        </div>
      `).addTo(map);
    });

    populateDropdown(document.getElementById("start"));
    populateDropdown(document.querySelector(".waypoint-select"));
    
    // 設置搜尋功能
    setupSearchAndDropdown('start-search', 'start');
    setupSearchAndDropdown('waypoint-0-search', 'waypoint-0');
    
    // 分類顏色顯示在有 name 的 node 指標上，不再自動繪製建築範圍面圖層。
    
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
  renderCategoryOptions(selectElement);
}

window.updateDropdownLanguage = function(currentLang) {
  document.querySelectorAll("select.modern-select").forEach(selectElement => {
    if (!selectElement.matches("#start, .waypoint-select")) return;

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
      if (option.dataset.categoryOption === "true" && window.buildingCategories[option.value]) {
        const categoryInfo = window.buildingCategories[option.value];
        option.text = currentLang === "en" ? categoryInfo.en : categoryInfo.zh;
        return;
      }
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
  const newSearch = newItem.querySelector('.waypoint-search');
  
  // 1. 為新的搜尋框和select生成唯一ID
  const uniqueId = 'waypoint-' + Date.now();
  newSearch.id = uniqueId + '-search';
  newSelect.id = uniqueId;
  newSearch.value = '';
  newSelect.innerHTML = '';
  newSelect.style.display = 'none';
  
  // 2. 設定刪除按鈕功能
  newItem.querySelector('.btn-remove-waypoint').style.display = "block";
  newItem.querySelector('.btn-remove-waypoint').onclick = function() { this.parentElement.remove(); };
  
  // 🌟 關鍵修復：先將新元素加入到畫面 (DOM) 中！
  waypointContainer.appendChild(newItem);
  
  // 3. 確保元素已經在畫面上後，再來綁定下拉選單與搜尋事件
  populateDropdown(newSelect); 
  setupSearchAndDropdown(uniqueId + '-search', uniqueId);
  
  // 4. 更新語言
  const currentLang = document.getElementById("language-selector").value;
  window.updateDropdownLanguage(currentLang);
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

function resolveLocationValue(searchInput, selectElement) {
  const typedValue = searchInput?.value?.trim() || '';
  if (typedValue && nodesByName[typedValue]) return typedValue;
  if (selectElement?.value && nodesByName[selectElement.value]) return selectElement.value;
  return typedValue;
}

document.getElementById("findRoute").addEventListener("click", async () => {
  const cruiseMode = document.getElementById("cruise-mode").value;
  const routeWeight = document.getElementById("route-weight").value; // 包含 shade 模式
  
  // 從搜尋框或select獲取起點名稱
  const startSearchInput = document.getElementById("start-search");
  const startSelect = document.getElementById("start");
  const startName = resolveLocationValue(startSearchInput, startSelect);
  
  const selectedTransport = document.getElementById("transport-mode").value; 
  const waypointItems = document.querySelectorAll(".waypoint-item");
  let destinations = [];
  
  // 收集所有目的地
  waypointItems.forEach(item => {
    const searchInput = item.querySelector('.waypoint-search');
    const select = item.querySelector('.waypoint-select');
    const value = resolveLocationValue(searchInput, select);
    if (value) {
      destinations.push(value);
    }
  });

  if (!nodesByName[startName]) return alert("請選擇有效的起點");
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
        const segment = await fetchSegment([currentLoc], [nextDest], routeWeight, selectedTransport);
        if (segment && segment.length > 0) {
            fullPath = fullPath.length === 0 ? segment : fullPath.concat(segment.slice(1));
            currentLoc = nextDest;
            visitOrder.push(nextDest);
        } else {
            console.warn(`無法找到前往 ${nextDest} 的路徑，已跳過該節點。`);
        }
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
  
  shadowToggle.parentElement.style.display = isShadeMode ? "flex" : "none";
  
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

// ===== 面板折疊功能 =====
document.getElementById('toggle-panel').addEventListener('click', function() {
  const panel = document.getElementById('nav-panel');
  const isCollapsed = panel.classList.toggle('collapsed');
  this.textContent = isCollapsed ? '➡️' : '⬅️';
  this.setAttribute('aria-expanded', String(!isCollapsed));
});

// ===== 建築顏色配置 =====
const buildingCategoryColors = {
  "school": "#2196F3",   // 藍色
  "dining": "#FF9800",   // 橘色
  "housing": "#000000"   // 黑色
};

// 建築分類資訊（用於後端標記）
window.buildingCategories = {
  "school": { zh: "學校區", en: "School", color: "#2196F3" },
  "dining": { zh: "餐飲區", en: "Dining", color: "#FF9800" },
  "housing": { zh: "住宿區", en: "Accommodation", color: "#000000" }
};

const categoryOrder = ["school", "dining", "housing"];

function createLocationMarkerIcon(category) {
  const color = buildingCategoryColors[category] || buildingCategoryColors.school;
  const borderColor = category === "housing" ? "#ffffff" : "#1f2937";

  return L.divIcon({
    className: "category-location-marker",
    html: `
      <span class="category-map-pin" style="--marker-color:${color}; --marker-border:${borderColor};"></span>
    `,
    iconSize: [34, 42],
    iconAnchor: [17, 40],
    popupAnchor: [0, -38]
  });
}

function getCategoryLabel(category) {
  const categoryInfo = window.buildingCategories[category];
  if (!categoryInfo) return category;
  const currentLang = document.getElementById("language-selector")?.value || "zh";
  return currentLang === "en" ? categoryInfo.en : categoryInfo.zh;
}

function renderCategoryOptions(selectElement) {
  selectElement.innerHTML = "";
  categoryOrder.forEach(category => {
    const option = document.createElement("option");
    option.value = category;
    option.text = getCategoryLabel(category);
    option.dataset.categoryOption = "true";
    selectElement.appendChild(option);
  });
  selectElement.size = categoryOrder.length;
  selectElement.selectedIndex = -1;
  selectElement.dataset.mode = "categories";
}

function getLocationsByCategory(category) {
  return locationMarkers
    .filter(location => (location.category || getCategory(location.name)) === category)
    .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
}

function renderLocationOptions(selectElement, locations) {
  selectElement.innerHTML = "";

  if (locations.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.text = "沒有符合的建築";
    option.disabled = true;
    option.selected = true;
    selectElement.appendChild(option);
  } else {
    const promptOption = document.createElement("option");
    promptOption.value = "";
    promptOption.text = "請選擇建築";
    promptOption.disabled = true;
    promptOption.selected = true;
    selectElement.appendChild(promptOption);

    locations.forEach(location => {
      const option = document.createElement("option");
      option.value = location.name;
      option.text = location.name;
      selectElement.appendChild(option);
    });
  }

  selectElement.size = Math.min(Math.max(locations.length + 1, 1), 8);
  selectElement.dataset.mode = "locations";
}

// ===== 建築繪製功能 =====
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

const buildingLayer = L.layerGroup();

async function loadAndRenderBuildings() {
  try {
    const response = await fetch('ccu_buildings_ready.geojson');
    if (!response.ok) throw new Error('Failed to load buildings GeoJSON');
    
    const buildingsData = await response.json();
    
    L.geoJSON(buildingsData, {
      style: function(feature) {
        const name = feature.properties.name || "";
        const category = getCategory(name);
        const color = buildingCategoryColors[category] || buildingCategoryColors.school;
        
        return {
          color: color,
          weight: 2,
          opacity: 0.7,
          fillColor: color,
          fillOpacity: 0.3
        };
      },
      onEachFeature: function(feature, layer) {
        const name = feature.properties.name || "未命名建築";
        const category = getCategory(name);
        const categoryInfo = window.buildingCategories[category];
        
        const popupContent = `
          <div style="font-size: 12px;">
            <b>${name}</b><br/>
            分類: ${categoryInfo.zh} ${categoryInfo.en}<br/>
            高度: ${feature.properties.height || '未知'} m<br/>
            樓層: ${feature.properties.levels || '未知'}
          </div>
        `;
        
        layer.bindPopup(popupContent);
      }
    }).addTo(buildingLayer);
    
    buildingLayer.addTo(map);
    console.log('✅ 建築圖層已加載');
  } catch (error) {
    console.warn('⚠️ 無法加載建築圖層:', error);
  }
}

// 搜尋和選單功能
function setupSearchAndDropdown(searchInputId, selectId) {
  const searchInput = document.getElementById(searchInputId) || document.querySelector(`input[id="${searchInputId}"]`);
  const selectElement = document.getElementById(selectId) || document.querySelector(`select[id="${selectId}"]`);
  
  if (!searchInput || !selectElement) return;

  const showCategories = () => {
    renderCategoryOptions(selectElement);
    selectElement.style.display = 'block';
  };

  const showSearchResults = () => {
    const searchTerm = searchInput.value.trim().toLowerCase();
    if (!searchTerm) {
      showCategories();
      return;
    }

    const filtered = locationMarkers.filter(location =>
      location.name.toLowerCase().includes(searchTerm)
    );
    renderLocationOptions(selectElement, filtered);
    selectElement.style.display = 'block';
  };

  searchInput.setAttribute('autocomplete', 'off');
  searchInput.addEventListener('focus', showSearchResults);
  searchInput.addEventListener('click', showSearchResults);
  searchInput.addEventListener('input', showSearchResults);

  selectElement.addEventListener('change', function(e) {
    if (!e.target.value) return;
    
    if (selectElement.dataset.mode === 'categories' && window.buildingCategories[e.target.value]) {
      const category = e.target.value;
      renderLocationOptions(selectElement, getLocationsByCategory(category));
      selectElement.style.display = 'block';
      return;
    }

    if (nodesByName[e.target.value]) {
      searchInput.value = e.target.value;
      selectElement.style.display = 'none';
    }
  });
}
