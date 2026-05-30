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

map.createPane('shadowPane');
map.getPane('shadowPane').style.zIndex = 450; // 預設向量圖層是 400，設 450 確保永遠在路線上方
map.getPane('shadowPane').style.pointerEvents = 'none'; // 讓滑鼠點擊可以穿透陰影，不影響地圖操作

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; OpenStreetMap',
  maxNativeZoom: 18,
  maxZoom: 22,
  tileSize: 512,
  zoomOffset: -1
}).addTo(map);

let currentFullPath = [];
let nodesByName = {};
let locationMarkers = []; // 存儲 { name, lat, lng, category, markerObject }
let globalData = null;
const activePolylines = [];
// 🎨 地標可見性管理
let allMarkerObjects = []; // 保存所有地標對象
let markersVisibleState = true; // 追蹤地標顯示狀態
// 🔧 修復 M4：模組層級 edgeMap，drawPath 可直接查詢，避免 O(E) 線性掃描
let edgeMap = new Map();
const treeShadeLayer = L.layerGroup().addTo(map);
const buildingShadowLayer = L.layerGroup().addTo(map);

// 使變數全局可訪問（用於調試）
window.nodesByName = nodesByName;
window.locationMarkers = locationMarkers;

// 🔧 修复 C1: 添加超时和重试机制
const API_BASE_URL = 'http://localhost:8000';
const FETCH_TIMEOUT = 5000; // 5秒超时
const MAX_RETRIES = 3;

async function fetchWithTimeout(url, timeout = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

async function fetchWithRetry(url, maxRetries = MAX_RETRIES) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetchWithTimeout(url);
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      return response;
    } catch (error) {
      console.warn(`第 ${i + 1}/${maxRetries} 次尝试失败:`, error.message);
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * (i + 1))); // 指数退避
    }
  }
}

fetchWithRetry(`${API_BASE_URL}/api/graph`)
  .then((response) => response.json())
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
    document.getElementById('stat-graph-size').innerText = `${data.nodes.length} ${window.t('stat_nodes')} / ${data.edges.length} ${window.t('stat_edges')}`;
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
          const category = node.category || "other";
          counts[category] = (counts[category] || 0) + 1;
          return counts;
        }, {});
        const category = Object.entries(categoryCounts)
          .sort((a, b) => b[1] - a[1])[0]?.[0] || "other";

        locationMarkers.push({ name: name, lat: avgLat, lng: avgLng, category });
      }
    }

    console.log('📍 Location markers created:', locationMarkers.length);
    
    // 更新全局引用
    window.nodesByName = nodesByName;
    window.locationMarkers = locationMarkers;

    locationMarkers.forEach((location) => {
      const categoryInfo = window.buildingCategories[location.category] || window.buildingCategories.school;
      const markerObj = L.marker([location.lat, location.lng], {
        icon: createLocationMarkerIcon(location.category)
      }).bindPopup(`
        <div style="font-size: 12px;">
          <b>${location.name}</b><br/>
          分類: ${categoryInfo.zh} ${categoryInfo.en}
        </div>
      `).addTo(map);
      
      // 🎨 保存地標對象引用
      location.markerObject = markerObj;
      allMarkerObjects.push({ name: location.name, marker: markerObj });
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
        "dining": { zh: "🍔 飲食與生活", en: "🍔 Dining & Life" },
        "other":   { zh: "📌 其他",      en: "📌 Other" } 
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
const cruiseModeSelect = document.getElementById('cruise-mode');
const swapRoutePointsBtn = document.getElementById('swap-route-points');

function getFirstWaypointItem() {
  return waypointContainer?.querySelector('.waypoint-item') || null;
}

function copyLocationFieldState(fromInput, fromSelect, toInput, toSelect) {
  if (!toInput || !toSelect) return;
  toInput.value = fromInput?.value || '';
  if (fromSelect?.value) {
    toSelect.value = fromSelect.value;
  } else {
    toSelect.selectedIndex = -1;
  }
  toSelect.style.display = 'none';
}

function swapStartAndFirstDestination() {
  const firstWaypoint = getFirstWaypointItem();
  if (!firstWaypoint) return;

  const startInput = document.getElementById('start-search');
  const startSelect = document.getElementById('start');
  const destInput = firstWaypoint.querySelector('.waypoint-search');
  const destSelect = firstWaypoint.querySelector('.waypoint-select');
  const startState = {
    inputValue: startInput?.value || '',
    selectValue: startSelect?.value || ''
  };

  copyLocationFieldState(destInput, destSelect, startInput, startSelect);
  if (destInput && destSelect) {
    destInput.value = startState.inputValue;
    if (startState.selectValue) {
      destSelect.value = startState.selectValue;
    } else {
      destSelect.selectedIndex = -1;
    }
    destSelect.style.display = 'none';
  }
}

function isOrderedCruiseMode() {
  return cruiseModeSelect?.value === 'ordered';
}

function updateWaypointDragState() {
  const canDrag = isOrderedCruiseMode();
  waypointContainer?.querySelectorAll('.waypoint-item').forEach((item) => {
    const handle = item.querySelector('.end-dot');
    if (!handle) return;
    handle.draggable = canDrag;
    handle.tabIndex = canDrag ? 0 : -1;
    handle.title = canDrag ? 'Drag to reorder destinations' : '';
    handle.classList.toggle('waypoint-drag-handle', canDrag);
    item.classList.toggle('waypoint-draggable', canDrag);
  });
}

function updateRouteModeControls() {
  const isSingleMode = cruiseModeSelect?.value === 'single';
  if (swapRoutePointsBtn) {
    swapRoutePointsBtn.style.display = isSingleMode ? 'flex' : 'none';
  }
  updateWaypointDragState();
}

function getDragAfterWaypoint(container, pointerY) {
  const draggableItems = [...container.querySelectorAll('.waypoint-item:not(.dragging)')];
  return draggableItems.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = pointerY - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset, element: child };
    }
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
}

let draggedWaypointItem = null;

if (swapRoutePointsBtn) {
  swapRoutePointsBtn.addEventListener('click', swapStartAndFirstDestination);
}

if (cruiseModeSelect) {
  cruiseModeSelect.addEventListener('change', updateRouteModeControls);
  updateRouteModeControls();
}

if (waypointContainer) {
  waypointContainer.addEventListener('dragstart', (event) => {
    const handle = event.target instanceof Element ? event.target.closest('.waypoint-drag-handle') : null;
    if (!handle || !isOrderedCruiseMode()) {
      event.preventDefault();
      return;
    }

    draggedWaypointItem = handle.closest('.waypoint-item');
    if (!draggedWaypointItem) return;

    draggedWaypointItem.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', '');
  });

  waypointContainer.addEventListener('dragover', (event) => {
    if (!draggedWaypointItem || !isOrderedCruiseMode()) return;
    event.preventDefault();
    const afterElement = getDragAfterWaypoint(waypointContainer, event.clientY);
    if (afterElement) {
      waypointContainer.insertBefore(draggedWaypointItem, afterElement);
    } else {
      waypointContainer.appendChild(draggedWaypointItem);
    }
  });

  waypointContainer.addEventListener('dragend', () => {
    if (draggedWaypointItem) {
      draggedWaypointItem.classList.remove('dragging');
    }
    draggedWaypointItem = null;
    updateWaypointDragState();
  });
}

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
  newItem.querySelector('.btn-remove-waypoint').onclick = function() {
    this.parentElement.remove();
    updateWaypointDragState();
  };
  
  // 🌟 關鍵修復：先將新元素加入到畫面 (DOM) 中！
  waypointContainer.appendChild(newItem);
  
  // 3. 確保元素已經在畫面上後，再來綁定下拉選單與搜尋事件
  populateDropdown(newSelect); 
  setupSearchAndDropdown(uniqueId + '-search', uniqueId);
  
  // 4. 更新語言
  const currentLang = document.getElementById("language-selector").value;
  window.updateDropdownLanguage(currentLang);
  if (window.applyTranslations) {
    window.applyTranslations(currentLang);
  }

  updateWaypointDragState();
});

// 白名單需與 index.html 的 select value 完全一致
const VALID_MODES = new Set(['shortest', 'least_turns', 'least_climbing', 'shade']);
const VALID_VEHICLES = new Set(['walk', 'bike', 'ebike', 'motorcycle', 'car']);

async function fetchSegment(startsNames, endsNames, mode, vehicle) {
  if (!VALID_MODES.has(mode)) {
    console.warn(`⚠️ 無效的路由模式: ${mode}，改用 'shortest'`);
    mode = 'shortest';
  }
  if (!VALID_VEHICLES.has(vehicle)) {
    console.warn(`⚠️ 無效的交通工具: ${vehicle}，改用 'walk'`);
    vehicle = 'walk';
  }

  const startIds = [];
  startsNames.forEach(name => {
    if (nodesByName[name]) startIds.push(...nodesByName[name].map(n => n.id));
  });
  const endIds = [];
  endsNames.forEach(name => {
    if (nodesByName[name]) endIds.push(...nodesByName[name].map(n => n.id));
  });

  if (startIds.length === 0 || endIds.length === 0) {
    console.warn('⚠️ 無效的起終點位置');
    return [];
  }

  // 直接 POST，不走 GET-then-fallback（那樣每次都浪費 3 次重試）
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const response = await fetch(`${API_BASE_URL}/api/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ starts: startIds, ends: endIds, mode, vehicle }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const result = await response.json();
    console.log('📍 Route response:', result);

    if (result.status === 'error') {
      console.error('❌ 後端錯誤:', result.message);
      alert(`路徑計算失敗：${result.message}`);
      return [];
    }
    return result.path || [];
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('❌ Failed to fetch route:', error);
    return [];
  }
}

// 🔧 修复 C3: 添加null检查
function getLinearDist(name1, name2) {
    const n1 = locationMarkers.find(m => m.name === name1);
    const n2 = locationMarkers.find(m => m.name === name2);
    if (!n1 || !n2) {
      console.error(`❌ 位置未找到: n1=${n1?.name}, n2=${n2?.name}`);
      return Infinity; // 返回无穷大，表示无法路由
    }
    return Math.sqrt(Math.pow(n1.lat - n2.lat, 2) + Math.pow(n1.lng - n2.lng, 2));
}

// 🎨 清除路線時恢復所有地標的可見性
function markerback() {
  clearActivePolylines();
  showAllMarkers();
  // 清除分段圖例
  const legend = document.getElementById('route-leg-legend');
  if (legend) legend.remove();
  console.log('✅ 已恢復所有地標');
}

function resolveLocationValue(searchInput, selectElement) {
  const typedValue = searchInput?.value?.trim() || '';
  
  // 1. 如果輸入的是中文原名，直接回傳
  if (typedValue && nodesByName[typedValue]) return typedValue;
  
  // 2. ✨ 新增反向查詢：如果顯示的是英文，把它轉回中文 key 給系統運算
  if (typedValue && typeof buildingTranslations !== 'undefined') {
    for (const [zhName, translations] of Object.entries(buildingTranslations)) {
      if (translations.en === typedValue) {
        return zhName; 
      }
    }
  }

  // 3. 如果是從下拉選單點擊的，優先使用 select 背後紀錄的中文 value
  if (selectElement?.value && nodesByName[selectElement.value]) {
    // 確保輸入框的字與選單的字匹配，避免使用者選完又亂改字
    const selectedText = selectElement.options[selectElement.selectedIndex]?.text;
    if (typedValue === selectedText || typedValue === "") {
        return selectElement.value;
    }
  }

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
  // 🔧 修復 M3：過濾掉輸入文字不對應任何已知地點的目的地
  destinations = destinations.filter(d => nodesByName[d]);
  if (destinations.length === 0) return alert("請選擇至少一個有效的目的地");

  let fullPath = [];
  let totalDist = 0;

  // 🔧 修復 M4 & M5：預建 edgeMap 索引，將後續每次 O(E) find() 降為 O(1)
  edgeMap = new Map();
  if (globalData) {
    globalData.edges.forEach(e => {
      edgeMap.set(`${e.from}-${e.to}`, e);
    });
  }

  try {
    let visitOrder = [startName];
    // 記錄每段終點在 fullPath 中的索引，供 drawPath 分色使用
    // segmentBoundaries[i] = fullPath 裡第 i 段結尾的 index
    let segmentBoundaries = [];

    if (cruiseMode === "single") {
      fullPath = await fetchSegment([startName], [destinations[0]], routeWeight, selectedTransport); 
      visitOrder.push(destinations[0]);
      if (fullPath.length > 0) segmentBoundaries.push(fullPath.length - 1);
    } 
    else if (cruiseMode === "ordered") {
      let currentLoc = startName;
      for (let dest of destinations) {
        const segment = await fetchSegment([currentLoc], [dest], routeWeight, selectedTransport); 
        if (segment.length > 0) {
          fullPath = fullPath.length === 0 ? segment : fullPath.concat(segment.slice(1));
          currentLoc = dest;
          visitOrder.push(dest);
          segmentBoundaries.push(fullPath.length - 1);
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
            segmentBoundaries.push(fullPath.length - 1);
        } else {
            console.warn(`無法找到前往 ${nextDest} 的路徑，已跳過該節點。`);
        }
      }
    }

    if (fullPath.length > 0) {
      currentFullPath = fullPath;
      // 🎨 隱藏除起點和目的地外的地標
      hideMarkersExcept(visitOrder);
      drawPath(fullPath, visitOrder, routeWeight, segmentBoundaries); 
      totalDist = calculatePathDistance(fullPath);
      
      let totalMainSeconds = 0;
      let totalWalkSeconds = 0;

      if (globalData) {
        for (let i = 0; i < fullPath.length - 1; i++) {
          const u = fullPath[i], v = fullPath[i+1];
          // 🔧 修復 M5：edgeMap O(1) 查詢
          const edgeFwdForTime = edgeMap.get(`${u}-${v}`);
          const edgeRevForTime = edgeMap.get(`${v}-${u}`);
          const edge = edgeFwdForTime || edgeRevForTime;
          
          let edgeDist = edge ? edge.distance : 0;
          if (!edge) {
             const edges = graph.adjacencyList.get(u) || [];
             const adjEdge = edges.find(e => e.to === v);
             edgeDist = adjEdge ? adjEdge.weight : 0;
          }

          let edgeSlope = (edge && edge.slope) ? parseFloat(edge.slope) : 0;
          edgeSlope = Math.abs(edgeSlope);
          if (edgeSlope > 0.15) edgeSlope = 0; 

          // 🔧 修正：任一方向邊禁止該交通工具，即視為需牽車
          const fwdBannedTime = edgeFwdForTime && edgeFwdForTime[selectedTransport] === 0;
          const revBannedTime = edgeRevForTime && edgeRevForTime[selectedTransport] === 0;
          const isWalkRequired = selectedTransport === "walk" || fwdBannedTime || revBannedTime;
          
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
      let totalRouteDistance = 0;
      let totalShadedDistance = 0;

      for (let i = 0; i < fullPath.length - 1; i++) {
        const u = fullPath[i], v = fullPath[i+1];
        const edgeFwd = edgeMap.get(`${u}-${v}`);
        const edgeRev = edgeMap.get(`${v}-${u}`);
        const edge = edgeFwd || edgeRev;
        
        if (edge) {
          totalRouteDistance += edge.distance;
          // 若樹蔭或建築陰影超過閾值，就計入遮蔭長度
          if (edge.tree_shade > 0.5 || edge.building_shade > 0.5) {
            totalShadedDistance += edge.distance;
          }
        }
      }

      // 更新 UI
      document.getElementById('stat-route-dist').innerText = `${totalRouteDistance.toFixed(1)} ${window.t('unit_meters')}`;
      const shadePercentage = totalRouteDistance > 0 ? ((totalShadedDistance / totalRouteDistance) * 100).toFixed(1) : 0;
      document.getElementById('stat-shade-rate').innerText = `${shadePercentage} %`;
      
    } else {
      alert("無法找到完整巡航路徑！請注意校園內機車禁止通行!請確認該交通工具可否通行或是否有獨立未連通的地點。");
    }
  } catch (error) {
    console.error("巡航導航失敗:", error);
    // 🎨 發生錯誤時恢復地標顯示
    if (!markersVisibleState) showAllMarkers();
  }
});

// 🎨 清除路線按鈕事件監聽器
document.getElementById("markerback").addEventListener("click", markerback);

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
    const walkLabel = (selectedMode !== "walk") ? "步行路段" : "步行";
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

// 🔧 修復 C4：drawPath 前清除 activePolylines，防止無限增長
function clearActivePolylines() {
  activePolylines.forEach(p => { if (map.hasLayer(p)) map.removeLayer(p); });
  activePolylines.length = 0;
}

// 🎨 隱藏除起點和目的地外的所有地標
function hideMarkersExcept(visibleLocationNames) {
  allMarkerObjects.forEach(({ name, marker }) => {
    if (visibleLocationNames.includes(name)) {
      marker.addTo(map); // 確保起點和目的地的地標可見
      marker.setOpacity(1);
    } else {
      if (map.hasLayer(marker)) {
        map.removeLayer(marker);
      }
    }
  });
  markersVisibleState = false;
}

// 🎨 恢復所有地標的顯示
function showAllMarkers() {
  allMarkerObjects.forEach(({ marker }) => {
    marker.addTo(map);
    marker.setOpacity(1);
  });
  markersVisibleState = true;
}

// 多目的地時每條腿的配色盤（避暑模式不用此盤，單一目的地也不受影響）
// 刻意選對比明顯、地圖上易辨認的色系
const LEG_COLORS = [
  "#0066ff", // 藍
  "#e65c00", // 橙
  "#7b00d4", // 紫
  "#00897b", // 青綠
  "#c62828", // 深紅
  "#1565c0", // 深藍
  "#f9a825", // 金黃
  "#558b2f", // 草綠
];

// 👇 接收 mode / segmentBoundaries 參數
//    segmentBoundaries: 每段終點在 nodeIds 裡的 index 陣列
//    例如 A→B→C 共 10 個節點，B 在 index 4，C 在 index 9
//    → segmentBoundaries = [4, 9]
function drawPath(nodeIds, visitOrder = [], mode = "shortest", segmentBoundaries = []) {
  clearActivePolylines(); // 🔧 C4：清除舊路線，防止記憶體洩漏
  if (currentPathLayerGroup) map.removeLayer(currentPathLayerGroup);
  currentPathLayerGroup = L.layerGroup().addTo(map);

  const selectedTransport = document.getElementById("transport-mode").value;
  const isMultiLeg = segmentBoundaries.length > 1; // 超過 1 段才啟用分色
  const isShadeMode = (mode === "shade");
  const baseWeight = isShadeMode ? 8 : 6;

  // 🔧 修正：牽車判斷需同時檢查雙向邊，任一方向為0即代表需牽車
  function isWalkRequiredEdge(u, v) {
    const edgeFwd = edgeMap.get(`${u}-${v}`);
    if (edgeFwd) return edgeFwd[selectedTransport] === 0;
    const edgeRev = edgeMap.get(`${v}-${u}`);
    return edgeRev ? edgeRev[selectedTransport] === 0 : false;
  }

  // ── 建立「腿→邊界」查找表 ──────────────────────────────────────
  // legIndexOf(i) 回傳 nodeIds[i] 屬於第幾段（0-based）
  // 邊 (i, i+1) 的段落 = legIndexOf(i)
  const boundaries = segmentBoundaries.length > 0
    ? segmentBoundaries
    : [nodeIds.length - 1]; // 單段：全部視為第 0 段

  function getLegIndex(edgeStartIdx) {
    for (let l = 0; l < boundaries.length; l++) {
      if (edgeStartIdx < boundaries[l]) return l;
    }
    return boundaries.length - 1;
  }

  function getLegColor(legIdx) {
    if (isShadeMode) return "#2E7D32";
    if (!isMultiLeg) return "#0066ff";
    return LEG_COLORS[legIdx % LEG_COLORS.length];
  }

  // ── 逐邊掃描，遇到「牽車↔騎車」切換或「換腿」就收線 ──────────
  let currentLatLngs = [];
  let currentIsWalk = false;
  let currentLegIdx = 0;

  function flushSegment(isWalk, legIdx) {
    if (currentLatLngs.length < 2) return;
    const baseColor = getLegColor(legIdx);
    L.polyline(currentLatLngs, {
      color: isWalk ? "#ffcc00" : baseColor,
      weight: baseWeight,
      opacity: 0.9,
      dashArray: isWalk ? "8, 8" : "15, 15",
      className: 'animated-route'
    }).addTo(currentPathLayerGroup);
  }

  for (let i = 0; i < nodeIds.length - 1; i++) {
    const u = nodeIds[i], v = nodeIds[i + 1];
    const nodeU = graph.nodes.get(u), nodeV = graph.nodes.get(v);
    const isWalkRequired = selectedTransport !== "walk" && isWalkRequiredEdge(u, v);
    const legIdx = getLegIndex(i);

    if (i === 0) {
      currentIsWalk = isWalkRequired;
      currentLegIdx = legIdx;
      currentLatLngs.push([nodeU.lat, nodeU.lng]);
    } else if (currentIsWalk !== isWalkRequired || currentLegIdx !== legIdx) {
      // 切換：先把上一段收尾（接上目前節點讓線段連續）
      currentLatLngs.push([nodeU.lat, nodeU.lng]);
      flushSegment(currentIsWalk, currentLegIdx);
      currentLatLngs = [[nodeU.lat, nodeU.lng]];
      currentIsWalk = isWalkRequired;
      currentLegIdx = legIdx;
    }
    currentLatLngs.push([nodeV.lat, nodeV.lng]);
  }
  flushSegment(currentIsWalk, currentLegIdx);

  // ── 多目的地：繪製分色圖例 ────────────────────────────────────
  if (isMultiLeg && visitOrder.length >= 2) {
    const existingLegend = document.getElementById('route-leg-legend');
    if (existingLegend) existingLegend.remove();

    const legendItems = [];
    for (let l = 0; l < boundaries.length; l++) {
      const from = visitOrder[l]     || `點 ${l + 1}`;
      const to   = visitOrder[l + 1] || `點 ${l + 2}`;
      const color = getLegColor(l);
      legendItems.push(`
        <div style="display:flex; align-items:center; gap:7px; margin-bottom:5px; font-size:12px;">
          <span style="display:inline-block; width:28px; height:5px; border-radius:3px;
                       background:${color}; flex-shrink:0;"></span>
          <span style="color:#222; font-weight:600;">${l + 1}.</span>
          <span style="color:#444; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;"
                title="${from} → ${to}">${from} → ${to}</span>
        </div>
      `);
    }

    const legend = document.createElement('div');
    legend.id = 'route-leg-legend';
    legend.style.cssText = `
      position: fixed;
      top: 90px;
      right: 20px;
      z-index: 3000;
      background: rgba(255,255,255,0.96);
      border-radius: 10px;
      padding: 11px 15px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.22);
      font-family: 'Noto Sans TC', sans-serif;
      max-width: 280px;
      pointer-events: none;
    `;
    legend.innerHTML = `
      <div style="font-size:12px; font-weight:700; color:#1a237e; margin-bottom:8px; letter-spacing:.3px;">
        🗺️ 路線分段
      </div>
      ${legendItems.join('')}
    `;
    document.body.appendChild(legend);
  } else {
    // 非多段時清除舊圖例
    const old = document.getElementById('route-leg-legend');
    if (old) old.remove();
  }

  // ── 箭頭裝飾（每段各自跑一條透明線以保持箭頭連貫）────────────
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
  
  // 🎨 確保陰影圖層始終在最上層（shadowLayers 未宣告，改用實際圖層變數）
  [treeShadeLayer, buildingShadowLayer, realtimeShadowLayer].forEach(layer => {
    if (layer && map.hasLayer(layer)) {
      layer.eachLayer(childLayer => {
        if (childLayer.bringToFront) childLayer.bringToFront();
      });
    }
  });
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
        lineCap: 'round',
        pane: 'shadowPane'
      }).addTo(layerGroup);
    }
  });
  
  // 🎨 添加陰影後確保它在最上層
  if (map.hasLayer(layerGroup)) {
    layerGroup.eachLayer(childLayer => {
      if (childLayer.bringToFront) childLayer.bringToFront();
    });
  }
}


// 建立一個專屬的圖層群組來放所有的真實陰影與樹蔭
const realtimeShadowLayer = L.layerGroup().addTo(map);

document.getElementById('toggle-realtime-shadow').addEventListener('change', async function(e) {
  realtimeShadowLayer.clearLayers(); // 每次切換前先清空

  if (e.target.checked) {
    // 防呆：如果還沒有產生路徑
    if (!currentFullPath || currentFullPath.length === 0) {
      alert(window.t('alert_need_route_for_shadow'));
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
document.getElementById('toggle-stats').addEventListener('click', function() {
  const content = document.getElementById('stats-content');
  const arrow = document.getElementById('stats-arrow');
  if (content.style.display === 'none') {
      content.style.display = 'block';
      arrow.textContent = '▲';
  } else {
      content.style.display = 'none';
      arrow.textContent = '▼';
  }
});
const routeWeightSelect = document.getElementById("route-weight");
const shadowToggle = document.getElementById("toggle-realtime-shadow");

function updateShadowToggleState() {
  const isShadeMode = routeWeightSelect.value === "shade";
  
  // 使用 .closest() 抓取包含標題與核取方塊的整個灰色外框
  const shadowPanel = shadowToggle.closest('.layer-toggles');
  if (shadowPanel) {
    shadowPanel.style.display = isShadeMode ? "block" : "none";
  }
  
  // 如果切換回非 shade 模式，強制取消勾選並清除陰影圖層
  if (!isShadeMode) {
    shadowToggle.checked = false;
    if (typeof realtimeShadowLayer !== 'undefined') {
        realtimeShadowLayer.clearLayers();
    }
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
  "housing": "#000000",  // 黑色
  "other":   "#9E9E9E" 
};

// 建築分類資訊（用於後端標記）
window.buildingCategories = {
  "school": { zh: "學校區", en: "School", color: "#2196F3" },
  "dining": { zh: "餐飲區", en: "Dining", color: "#FF9800" },
  "housing": { zh: "住宿區", en: "Accommodation", color: "#000000" },
  "other": { zh: "其他", en: "Other", color: "#9E9E9E" }
};

const categoryOrder = ["school", "dining", "housing", "other"];

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
    .filter(location => (location.category || "other") === category)
    .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
}

function renderLocationOptions(selectElement, locations) {
  selectElement.innerHTML = "";

  if (locations.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    const currentLang = document.getElementById("language-selector")?.value || "zh";
    option.text = currentLang === "en" ? "No matching buildings" : "沒有符合的建築";
    option.disabled = true;
    option.selected = true;
    selectElement.appendChild(option);
  } else {
    const promptOption = document.createElement("option");
    promptOption.value = "";
    const currentLang = document.getElementById("language-selector")?.value || "zh";
    promptOption.text = currentLang === "en" ? "Select building" : "請選擇建築";
    promptOption.disabled = true;
    promptOption.selected = true;
    selectElement.appendChild(promptOption);

    locations.forEach(location => {
      const option = document.createElement("option");
      option.value = location.name;
      
      // 🌟 應用建築翻譯
      const currentLang = document.getElementById("language-selector")?.value || "zh";
      const translation = buildingTranslations[location.name];
      if (translation && translation[currentLang]) {
        option.text = translation[currentLang];
      } else {
        option.text = location.name;
      }
      
      selectElement.appendChild(option);
    });
  }

  selectElement.size = Math.min(Math.max(locations.length + 1, 1), 8);
  selectElement.dataset.mode = "locations";
}


const buildingLayer = L.layerGroup();

async function loadAndRenderBuildings() {
  try {
    // 🔧 修復 H7：加上 AbortController timeout，避免頁面永久掛起
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const response = await fetch('ccu_buildings_ready.geojson', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error('Failed to load buildings GeoJSON');
    
    const buildingsData = await response.json();
    
    L.geoJSON(buildingsData, {
      style: function(feature) {
        const name = feature.properties.name || "";
        const category = feature.properties.category || "other";
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
        const category = feature.properties.category || "other";
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

// 🔧 修復 O6：用 Map 追蹤每個搜尋框的 AbortController，避免重複綁定監聽器
const searchListenerControllers = new Map();

function setupSearchAndDropdown(searchInputId, selectId) {
  const searchInput = document.getElementById(searchInputId) || document.querySelector(`input[id="${searchInputId}"]`);
  const selectElement = document.getElementById(selectId) || document.querySelector(`select[id="${selectId}"]`);
  
  if (!searchInput || !selectElement) return;

  // 若先前已綁定過，先中止舊的監聽器再重新綁定
  if (searchListenerControllers.has(searchInputId)) {
    searchListenerControllers.get(searchInputId).abort();
  }
  const controller = new AbortController();
  const { signal } = controller;
  searchListenerControllers.set(searchInputId, controller);

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

    // 🌟 支持搜尋中文名稱和英文翻譯
    const filtered = locationMarkers.filter(location => {
      const chineseName = location.name.toLowerCase();
      const translation = buildingTranslations[location.name];
      const englishName = translation?.en?.toLowerCase() || '';
      
      return chineseName.includes(searchTerm) || englishName.includes(searchTerm);
    });
    
    renderLocationOptions(selectElement, filtered);
    selectElement.style.display = 'block';
  };

  searchInput.setAttribute('autocomplete', 'off');
  searchInput.addEventListener('focus', showSearchResults, { signal });
  searchInput.addEventListener('click', showSearchResults, { signal });
  searchInput.addEventListener('input', showSearchResults, { signal });

  selectElement.addEventListener('change', function(e) {
    if (!e.target.value) return;
    
    if (selectElement.dataset.mode === 'categories' && window.buildingCategories[e.target.value]) {
      const category = e.target.value;
      renderLocationOptions(selectElement, getLocationsByCategory(category));
      selectElement.style.display = 'block';
      return;
    }

    if (nodesByName[e.target.value]) {
      const selectedText = selectElement.options[selectElement.selectedIndex].text;
      searchInput.value = selectedText;
      selectElement.style.display = 'none';
    }
  }, { signal });
}

// ===== 國際化 (翻譯) 功能 =====
function updateUITranslations(lang) {
  // 更新 data-i18n 屬性的文本
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const text = translations[lang]?.translation[key];
    if (text) {
      el.textContent = text;
    }
  });

  // 更新 option 元素的翻譯
  document.querySelectorAll('option[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const text = translations[lang]?.translation[key];
    if (text) {
      el.textContent = text;
    }
  });

  // 更新 data-i18n-placeholder 屬性的 placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    const text = translations[lang]?.translation[key];
    if (text) {
      el.placeholder = text;
    }
  });

  // 更新下拉菜單的翻譯
  window.updateDropdownLanguage(lang);
}

// 語言選擇器變化事件
const langSelector = document.getElementById('language-selector');
if (langSelector) {
  langSelector.addEventListener('change', function(e) {
    const newLang = e.target.value;
    updateUITranslations(newLang);
  });
  
  // 初始化翻譯
  updateUITranslations(langSelector.value);
}