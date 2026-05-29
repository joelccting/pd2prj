// editor.js
export function initEditorMode(map, data, graph) {
  console.log("🛠️ 進入開發者環境：已載入圖形編輯器模組");

  const editorLayerGroup = L.layerGroup();
  let isEditModeActive = false;
  const toggleBtn = document.getElementById("god-mode");
  const exportBtn = document.getElementById('exportBtn');

  const activePolylines = [];
  const activeMarkers = [];
  let selectedNodeForEdge = null;
  const selectedEdges = new Set();
  const selectedNodes = new Set();
  let currentEditorMode = "build";
  let isBoxSelectMode = false;
  let boxSelectTarget = null;
  let selectionBox = null;
  let boxStartLatLng = null;

  // --- 注入 God Mode 專屬動畫 CSS ---
  const styleId = 'god-mode-custom-style';
  if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
          .god-pulse-animation {
              animation: map-pulse 1.5s infinite;
          }
          @keyframes map-pulse {
              0% { stroke-opacity: 0.8; stroke-width: 4; }
              50% { stroke-opacity: 0.2; stroke-width: 12; }
              100% { stroke-opacity: 0.8; stroke-width: 4; }
          }
      `;
      document.head.appendChild(style);
  }

  // --- 取得海拔的魔法函數 ---
  async function getElevation(lat, lng) {
    try {
      const response = await fetch(`https://api.opentopodata.org/v1/srtm30m?locations=${lat},${lng}`);
      const result = await response.json();
      if (result && result.results && result.results.length > 0) {
        return result.results[0].elevation || 0;
      }
      return 0;
    } catch (error) {
      console.error("無法取得海拔資料:", error);
      return 0;
    }
  }

  function getDistance(lat1, lon1, lat2, lon2) {
     const R = 6371000;
     const dLat = (lat2 - lat1) * Math.PI / 180;
     const dLon = (lon2 - lon1) * Math.PI / 180;
     const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
               Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
               Math.sin(dLon/2) * Math.sin(dLon/2);
     return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
  }

  const customIcon = L.divIcon({
    className: 'custom-div-icon',
    html: "<div style='background-color:#0055ff; width:12px; height:12px; border-radius:50%; border:2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);'></div>",
    iconSize: [12, 12],
    iconAnchor: [6, 6]
  });

  const selectedNodeIcon = L.divIcon({
    className: 'custom-div-icon selected-node-icon',
    html: "<div style='background-color:#00aa55; width:16px; height:16px; border-radius:50%; border:3px solid white; box-shadow:0 0 0 3px #00aa55, 0 0 6px rgba(0,0,0,0.45);'></div>",
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });

  const modePanel = document.createElement('div');
  modePanel.id = 'god-mode-panel';
  modePanel.style = "position:fixed; bottom:20px; right:150px; z-index:2000; display:none; flex-direction:column; gap:8px;";
  modePanel.innerHTML = `
    <div style="display:flex; gap:8px;">
      <button id="god-build-mode" type="button" style="padding:10px 14px; font-weight:bold; border:none; border-radius:8px; cursor:pointer; box-shadow:0 4px 6px rgba(0,0,0,0.25);">建築模式</button>
      <button id="god-attr-mode" type="button" style="padding:10px 14px; font-weight:bold; border:none; border-radius:8px; cursor:pointer; box-shadow:0 4px 6px rgba(0,0,0,0.25);">修改模式</button>
    </div>
  `;
  document.body.appendChild(modePanel);

  // --- 🔍 精緻化的屬性搜尋面板 ---
  const searchPanel = document.createElement('div');
  searchPanel.id = 'property-search-panel';
  searchPanel.style = "position:fixed; bottom:140px; right:20px; z-index:2000; display:none; background:rgba(255, 255, 255, 0.95); padding:16px; border-radius:12px; box-shadow:0 8px 24px rgba(0,0,0,0.15); border: 1px solid #e0e0e0; min-width:320px; font-family:sans-serif; backdrop-filter: blur(8px);";
  searchPanel.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
          <label style="font-size:14px; font-weight:900; color:#2c3e50; margin:0;">🔍 屬性條件過濾</label>
          <span style="font-size:11px; background:#e8f4f8; color:#0077aa; padding:3px 8px; border-radius:12px; font-weight:bold;">God Mode</span>
      </div>
      <input type="text" id="property-search-input" placeholder="例: tree_shade=1, slope>0.05, elevation!=0"padding:10px; border:1px solid #ccd1d9; border-radius:8px; font-size:14px; box-sizing: border-box; transition: border-color 0.3s; outline:none;" onfocus="this.style.borderColor='#4A90E2'" onblur="this.style.borderColor='#ccd1d9'">
      <div style="display:flex; gap:8px;">
        <button id="property-search-btn" type="button" style="flex:2; padding:10px; background:linear-gradient(135deg, #4A90E2, #357abd); color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold; font-size:13px; transition: opacity 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">搜尋圖元</button>
        <button id="property-clear-btn" type="button" style="flex:1; padding:10px; background:#f1f3f6; color:#555; border:1px solid #d9dce1; border-radius:8px; cursor:pointer; font-weight:bold; font-size:13px; transition: background 0.2s;" onmouseover="this.style.background='#e4e7eb'" onmouseout="this.style.background='#f1f3f6'">清除</button>
      </div>
      <div id="search-result-info" style="font-size:13px; color:#444; background:#f8f9fa; border-radius:8px; padding:10px; display:none; border-left:4px solid #4CAF50; box-shadow: inset 0 0 4px rgba(0,0,0,0.05);"></div>
    </div>
  `;
  document.body.appendChild(searchPanel);

  const buildModeBtn = document.getElementById('god-build-mode');
  const attrModeBtn = document.getElementById('god-attr-mode');

  function setMarkerSelected(marker, isSelected) {
    marker.setIcon(isSelected ? selectedNodeIcon : customIcon);
  }

  function refreshModeButtons() {
    if (!buildModeBtn || !attrModeBtn) return;
    const buildActive = currentEditorMode === "build";
    buildModeBtn.style.backgroundColor = buildActive ? "#4A90E2" : "white";
    buildModeBtn.style.color = buildActive ? "white" : "#333";
    attrModeBtn.style.backgroundColor = buildActive ? "white" : "#4A90E2";
    attrModeBtn.style.color = buildActive ? "#333" : "white";
  }

  function resetBoxSelectButtons() {
    isBoxSelectMode = false;
    boxSelectTarget = null;
    if (selectionBox) {
      map.removeLayer(selectionBox);
      selectionBox = null;
    }
    map.dragging.enable();
    map.getContainer().style.cursor = '';
  }

  // 🔧 修正：取得反向邊 (確保無向邊兩個方向都被同步修改)
  function findReverseEdge(edgeData) {
    if (!edgeData) return null;
    return data.edges.find(e => e.from === edgeData.to && e.to === edgeData.from) || null;
  }

  // 同步路權屬性到反向邊
  function syncReverseEdgeTransport(edgeData, vals) {
    const rev = findReverseEdge(edgeData);
    if (!rev) return;
    const def = (rev.accessible === false) ? 0 : 1;
    ['walk', 'bike', 'ebike', 'motorcycle', 'car'].forEach(type => {
      if (rev[type] === undefined) rev[type] = def;
      if (vals[type] !== null && vals[type] !== undefined) rev[type] = vals[type];
    });
    delete rev.accessible;
    delete rev.pedestrian_only;
    delete rev.motor_vehicle_allowed;
  }

  // 同步單一屬性到反向邊
  function syncReverseEdgeAttr(edgeData, key, val) {
    const transportKeys = ['walk', 'bike', 'ebike', 'motorcycle', 'car', 'tree_shade'];
    // 只同步路權類屬性，其他屬性 (如 slope、distance) 方向性不同不應同步
    if (!transportKeys.includes(key)) return;
    const rev = findReverseEdge(edgeData);
    if (!rev) return;
    rev[key] = val;
  }

  function readPromptValue(key) {
    let valStr = prompt(`請輸入『${key}』的數值:`);
    if (valStr === null || valStr.trim() === "") return undefined;
    valStr = valStr.trim();
    if (valStr === "true") return true;
    if (valStr === "false") return false;
    if (valStr === "null") return null;
    return isNaN(Number(valStr)) ? valStr : Number(valStr);
  }

  function promptAndApplyAttribute(targets, label) {
    if (!targets || targets.size === 0) return;
    let key = prompt(`請輸入要新增/修改的『${label}屬性名稱』\n例如: category, lit, sheltered`);
    if (!key || key.trim() === "") return;
    key = key.trim();

    const val = readPromptValue(key);
    if (val === undefined) return;

    targets.forEach(target => { target[key] = val;
      if (label === "Edge") {
            syncReverseEdgeAttr(target, key, val);
        }
     });
    alert(`✅ 已更新 ${targets.size} 個${label}的 ${key} = ${val}`);
    clearSelection();
  }

  function openAttributeEditor(target, label, latlng) {
    if (currentEditorMode !== "modify") return;
    let attrHtml = `<ul style="list-style:none; padding:0; margin:0 0 12px 0; font-size:14px; max-height:180px; overflow:auto;">`;
    Object.keys(target).sort().forEach(key => {
      const value = target[key];
      const displayVal = typeof value === 'number' ? Number(value.toFixed(4)) : value;
      attrHtml += `<li style="border-bottom:1px dashed #ccc; padding:3px 0;"><b>${key}</b>: <span style="color:#0055ff;">${displayVal}</span></li>`;
    });
    attrHtml += `</ul>`;

    const btnId = `btnAddAttr-${Date.now()}`;
    const html = `
      <div style="min-width:190px; font-family:sans-serif;">
        <h4 style="margin:0 0 10px 0; border-bottom:2px solid #333; padding-bottom:5px;">${label}屬性</h4>
        ${attrHtml}
        <button id="${btnId}" style="width:100%; background:#007bff; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer;">新增/修改屬性</button>
      </div>
    `;

    L.popup().setLatLng(latlng).setContent(html).openOn(map);
    setTimeout(() => {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      btn.onclick = () => {
        let key = prompt(`請輸入${label}屬性名稱:`);
        if (!key || key.trim() === "") return;
        key = key.trim();
        const val = readPromptValue(key);
        if (val === undefined) return;
        target[key] = val;
        // 🔧 修正：若修改的是 Edge 的路權屬性，同步到反向邊
        if (label === "Edge") {
          syncReverseEdgeAttr(target, key, val);
        }
        alert(`✅ 成功設定 ${key} = ${val}`);
        map.closePopup();
      };
    }, 100);
  }

  function toggleEdgeSelection(edgeData, polyline) {
    if (!edgeData) return;
    if (selectedEdges.has(edgeData)) {
      selectedEdges.delete(edgeData);
      polyline.setStyle({ color: polyline._lineColor || 'gray', weight: 5 });
    } else {
      selectedEdges.add(edgeData);
      polyline.setStyle({ color: '#00aa55', weight: 8 });
    }
    updateBatchUI();
  }

  function toggleNodeSelection(node, marker) {
    if (!node) return;
    if (selectedNodes.has(node)) {
      selectedNodes.delete(node);
      setMarkerSelected(marker, false);
    } else {
      selectedNodes.add(node);
      setMarkerSelected(marker, true);
    }
    updateBatchUI();
  }

  function updateBatchUI() {
    let batchDiv = document.getElementById('batch-edit-panel');
    if (!batchDiv) {
      batchDiv = document.createElement('div');
      batchDiv.id = 'batch-edit-panel';
      batchDiv.style = "position:fixed; bottom:20px; left:20px; background:white; padding:15px; border-radius:8px; box-shadow:0 0 15px rgba(0,0,0,0.3); z-index:1001; display:none; min-width: 220px;";
      document.body.appendChild(batchDiv);
    }

    if (selectedEdges.size === 0 && selectedNodes.size === 0) {
      batchDiv.style.display = 'none';
      return;
    }

    batchDiv.style.display = 'block';

    let edgeControls = "";
    if (selectedEdges.size > 0) {
      let states = { walk: new Set(), bike: new Set(), ebike: new Set(), motorcycle: new Set(), car: new Set() };

      selectedEdges.forEach(edge => {
        const def = (edge.accessible === false) ? 0 : 1;
        states.walk.add(edge.walk !== undefined ? edge.walk : def);
        states.bike.add(edge.bike !== undefined ? edge.bike : def);
        states.ebike.add(edge.ebike !== undefined ? edge.ebike : def);
        states.motorcycle.add(edge.motorcycle !== undefined ? edge.motorcycle : def);
        states.car.add(edge.car !== undefined ? edge.car : def);
      });

      const getProps = (stateSet) => {
        if (stateSet.size === 1) return stateSet.has(1) ? "checked" : "";
        return "data-mixed='true'";
      };

      edgeControls = `
        <hr style="margin:8px 0; border:0; border-top:1px solid #ccc;">
        <p style="margin:4px 0 8px 0; font-size:13px; font-weight:bold; color:#0056b3;">Edge 路權設定</p>
        <div style="font-size:14px; line-height:1.8; margin-bottom:8px;">
          <label><input type="checkbox" id="batch-walk" ${getProps(states.walk)}> 步行</label><br>
          <label><input type="checkbox" id="batch-bike" ${getProps(states.bike)}> 腳踏車</label><br>
          <label><input type="checkbox" id="batch-ebike" ${getProps(states.ebike)}> 電動車</label><br>
          <label><input type="checkbox" id="batch-motorcycle" ${getProps(states.motorcycle)}> 機車</label><br>
          <label><input type="checkbox" id="batch-car" ${getProps(states.car)}> 汽車</label>
        </div>
        <button id="btnApplyBatch" style="margin-bottom:8px; width:100%; padding:8px; background:#4CAF50; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">套用 Edge 路權</button>
        <button id="btnEdgeAttr" style="margin-bottom:8px; width:100%; padding:6px; background:#007bff; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">新增/修改 Edge 屬性</button>
      `;
    }

    const nodeControls = selectedNodes.size > 0 ? `
      <hr style="margin:8px 0; border:0; border-top:1px solid #ccc;">
      <button id="btnNodeAttr" style="margin-bottom:8px; width:100%; padding:6px; background:#0055aa; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">新增/修改 Node 屬性</button>
    ` : "";

    batchDiv.innerHTML = `
      <h4 style="margin:0 0 10px 0; color:#333;">批次修改</h4>
      <div style="font-size:13px; color:#444;">已選 Edge：${selectedEdges.size}，Node：${selectedNodes.size}</div>
      ${edgeControls}
      ${nodeControls}
      <button id="btnClear" style="width:100%; padding:6px; background:#ccc; color:#333; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">取消選取</button>
    `;

    if (selectedEdges.size > 0) {
      ['walk', 'bike', 'ebike', 'motorcycle', 'car'].forEach(type => {
        let el = document.getElementById(`batch-${type}`);
        if (el.getAttribute('data-mixed') === 'true') {
          el.indeterminate = true;
        }
        el.addEventListener('click', function() {
           this.indeterminate = false; 
        });
      });

      document.getElementById('btnApplyBatch').onclick = () => {
        const getVal = (id) => {
          const el = document.getElementById(id);
          return el.indeterminate ? null : (el.checked ? 1 : 0);
        };

        const vals = {
          walk: getVal('batch-walk'),
          bike: getVal('batch-bike'),
          ebike: getVal('batch-ebike'),
          motorcycle: getVal('batch-motorcycle'),
          car: getVal('batch-car')
        };

        selectedEdges.forEach(edge => {
          const def = (edge.accessible === false) ? 0 : 1;
          
          ['walk', 'bike', 'ebike', 'motorcycle', 'car'].forEach(type => {
             if (edge[type] === undefined) edge[type] = def;
             if (vals[type] !== null) {
                edge[type] = vals[type];
             }
          });

          delete edge.accessible;
          delete edge.pedestrian_only;
          delete edge.motor_vehicle_allowed;

          // 🔧 修正：同步路權設定到反向邊，確保無向邊兩個方向一致
          syncReverseEdgeTransport(edge, vals);
        });

        alert(`✅ 成功更新了 ${selectedEdges.size} 條路段的路權設定！\n(請記得點擊畫面上的「儲存路網」按鈕寫入資料庫)`);
        
        clearSelection();
      };

      document.getElementById('btnEdgeAttr').onclick = () => promptAndApplyAttribute(selectedEdges, "Edge");
    }

    if (selectedNodes.size > 0) {
      document.getElementById('btnNodeAttr').onclick = () => promptAndApplyAttribute(selectedNodes, "Node");
    }

    document.getElementById('btnClear').onclick = clearSelection;
  }

  function clearSelection() {
    selectedEdges.clear();
    selectedNodes.clear();
    activePolylines.forEach(p => p.setStyle({ color: p._lineColor || 'gray', weight: 5 }));
    activeMarkers.forEach(marker => setMarkerSelected(marker, false));
    updateBatchUI();
  }

  function createEditableEdge(nodeA, nodeB, isNew = false) {
    const lineColor = isNew ? "#ff0044" : "gray";
    const polyline = L.polyline(
      [[nodeA.lat, nodeA.lng], [nodeB.lat, nodeB.lng]],
      { color: lineColor, weight: 5, opacity: 0.7 }
    ).addTo(editorLayerGroup);

    polyline._nodeA = nodeA;
    polyline._nodeB = nodeB;
    polyline._lineColor = lineColor;
    activePolylines.push(polyline);

    const edgeData = data.edges.find(edge =>
      (edge.from === nodeA.id && edge.to === nodeB.id) ||
      (edge.from === nodeB.id && edge.to === nodeA.id)
    );
    polyline._edgeData = edgeData;

    polyline.on('mouseover', function () { if(!selectedEdges.has(edgeData)) this.setStyle({ color: '#ff9900', weight: 8 }); });
    polyline.on('mouseout', function () { if(!selectedEdges.has(edgeData)) this.setStyle({ color: lineColor, weight: 5 }); });

    polyline.on('click', function (e) {
      L.DomEvent.stopPropagation(e);
      if (!edgeData) return;
      if (currentEditorMode !== "modify") return;

      if (e.originalEvent.shiftKey) {
        toggleEdgeSelection(edgeData, this);
        return;
      }

      openAttributeEditor(edgeData, "Edge", e.latlng);
    });

    polyline.on('contextmenu', function (e) {
      L.DomEvent.stopPropagation(e);
      if (currentEditorMode !== "build") return;
      if (confirm(`確定要剪斷 [${nodeA.id}] 和 [${nodeB.id}] 之間的連線嗎？`)) {
        editorLayerGroup.removeLayer(polyline);
        const index = activePolylines.indexOf(polyline);
        if (index > -1) activePolylines.splice(index, 1);
        selectedEdges.delete(edgeData);
        data.edges = data.edges.filter(edge =>
          !(edge.from === nodeA.id && edge.to === nodeB.id) &&
          !(edge.from === nodeB.id && edge.to === nodeA.id)
        );
      }
    });
    return polyline;
  }

  function createEditableMarker(node) {
    const marker = L.marker([node.lat, node.lng], {
      icon: customIcon, draggable: true, title: `ID: ${node.id}`
    }).addTo(editorLayerGroup);
    marker._nodeData = node;
    activeMarkers.push(marker);

    marker.on('drag', function (e) {
      if (currentEditorMode !== "build") return;
      const newPos = e.target.getLatLng();
      node.lat = newPos.lat; node.lng = newPos.lng;
      activePolylines.forEach(polyline => {
        if (polyline._nodeA.id === node.id || polyline._nodeB.id === node.id) {
          polyline.setLatLngs([
            [polyline._nodeA.lat, polyline._nodeA.lng],
            [polyline._nodeB.lat, polyline._nodeB.lng]
          ]);
        }
      });
    });

    marker.on('dragend', async function (e) {
      if (currentEditorMode !== "build") return;
      const newElev = await getElevation(node.lat, node.lng);
      node.elevation = newElev;
      data.edges.forEach(edge => {
        if (edge.from === node.id || edge.to === node.id) {
          const otherNodeId = edge.from === node.id ? edge.to : edge.from;
          const otherNode = data.nodes.find(n => n.id === otherNodeId);
          if (otherNode) {
             const dist = getDistance(node.lat, node.lng, otherNode.lat, otherNode.lng);
             edge.distance = dist;
             const otherElev = otherNode.elevation || 0;
             edge.slope = dist > 0 ? Math.abs(newElev - otherElev) / dist : 0;
          }
        }
      });
    });

    marker.on('contextmenu', function () {
      if (currentEditorMode !== "build") return;
      if (confirm(`確定要刪除節點 ${node.id} 嗎？`)) {
        editorLayerGroup.removeLayer(marker);
        const markerIndex = activeMarkers.indexOf(marker);
        if (markerIndex > -1) activeMarkers.splice(markerIndex, 1);
        data.nodes = data.nodes.filter(n => n.id !== node.id);
        data.edges = data.edges.filter(e => e.from !== node.id && e.to !== node.id);
        selectedNodes.delete(node);
        for (let i = activePolylines.length - 1; i >= 0; i--) {
          const polyline = activePolylines[i];
          if (polyline._nodeA.id === node.id || polyline._nodeB.id === node.id) {
            if (polyline._edgeData) selectedEdges.delete(polyline._edgeData);
            editorLayerGroup.removeLayer(polyline);
            activePolylines.splice(i, 1);
          }
        }
        updateBatchUI();
      }
    });

    marker.on('click', function (e) {
      L.DomEvent.stopPropagation(e);
      if (currentEditorMode === "modify") {
        if (e.originalEvent.shiftKey) {
          toggleNodeSelection(node, marker);
          return;
        }
        openAttributeEditor(node, "Node", e.latlng);
        return;
      }

      if (currentEditorMode !== "build") return;
      if (!selectedNodeForEdge) {
        selectedNodeForEdge = node;
        alert(`📍 已選取起點 (ID: ${node.id})\n👉 點擊另一個節點建立連線`);
      } else {
        if (selectedNodeForEdge.id === node.id) { selectedNodeForEdge = null; return; }
        const nodeA = selectedNodeForEdge;
        const nodeB = node;
        const dist = getDistance(nodeA.lat, nodeA.lng, nodeB.lat, nodeB.lng);
        const elevA = nodeA.elevation || 0;
        const elevB = nodeB.elevation || 0;
        let slope = dist > 0 ? Math.abs(elevA - elevB) / dist : 0;

        data.edges.push(
          { from: nodeA.id, to: nodeB.id, distance: dist, slope: slope, walk: 1, bike: 1, ebike: 1, motorcycle: 1, car: 1 },
          { from: nodeB.id, to: nodeA.id, distance: dist, slope: slope, walk: 1, bike: 1, ebike: 1, motorcycle: 1, car: 1 }
        );
        createEditableEdge(nodeA, nodeB, true);
        selectedNodeForEdge = null;
      }
    });
  }

  data.nodes.forEach(node => createEditableMarker(node));
  const drawnEdges = new Set();
  data.edges.forEach((edge) => {
    const fromNode = data.nodes.find(n => n.id === edge.from);
    const toNode = data.nodes.find(n => n.id === edge.to);
    if (!fromNode || !toNode) return;
    const edgeKey = edge.from < edge.to ? `${edge.from}-${edge.to}` : `${edge.to}-${edge.from}`;
    if (!drawnEdges.has(edgeKey)) {
      createEditableEdge(fromNode, toNode, false);
      drawnEdges.add(edgeKey);
    }
  });

  async function onMapClick(e) {
    if (!isEditModeActive || currentEditorMode !== "build" || isBoxSelectMode) return;
    if (selectedNodeForEdge) { selectedNodeForEdge = null; return; }
    const tempMarker = L.marker(e.latlng).addTo(editorLayerGroup);
    tempMarker.bindPopup("⏳ 測量海拔中...").openPopup();
    const elevation = await getElevation(e.latlng.lat, e.latlng.lng);
    editorLayerGroup.removeLayer(tempMarker);
    const currentMaxId = data.nodes.reduce((max, node) => Math.max(max, Number(node.id)), 0);
    const newNode = {
      id: currentMaxId + 1, name: "", lat: e.latlng.lat, lng: e.latlng.lng,
      elevation: elevation, accessible: true, type: "path_node"
    };
    data.nodes.push(newNode);
    createEditableMarker(newNode);
  }

  const boxButtonPanel = document.createElement('div');
  boxButtonPanel.id = 'box-select-panel';
  boxButtonPanel.style = "position:absolute; top:80px; right:10px; z-index:1000; display:none; gap:8px;";
  document.body.appendChild(boxButtonPanel);

  const boxEdgeBtn = document.createElement('button');
  boxEdgeBtn.type = 'button';
  boxEdgeBtn.textContent = "框選 Edge";
  boxEdgeBtn.style = "padding:10px; background:white; border:2px solid rgba(0,0,0,0.2); border-radius:5px; cursor:pointer; font-weight:bold; box-shadow:0 2px 5px rgba(0,0,0,0.3);";
  boxButtonPanel.appendChild(boxEdgeBtn);

  const boxNodeBtn = document.createElement('button');
  boxNodeBtn.type = 'button';
  boxNodeBtn.textContent = "框選 Node";
  boxNodeBtn.style = boxEdgeBtn.style.cssText;
  boxButtonPanel.appendChild(boxNodeBtn);

  function refreshBoxButtons() {
    boxEdgeBtn.style.backgroundColor = isBoxSelectMode && boxSelectTarget === "edge" ? "#ffeb3b" : "white";
    boxNodeBtn.style.backgroundColor = isBoxSelectMode && boxSelectTarget === "node" ? "#ffeb3b" : "white";
    boxEdgeBtn.textContent = isBoxSelectMode && boxSelectTarget === "edge" ? "停止框選 Edge" : "框選 Edge";
    boxNodeBtn.textContent = isBoxSelectMode && boxSelectTarget === "node" ? "停止框選 Node" : "框選 Node";
  }

  function setBoxSelectMode(target) {
    if (!isEditModeActive || currentEditorMode !== "modify") return;
    if (isBoxSelectMode && boxSelectTarget === target) {
      resetBoxSelectButtons();
    } else {
      isBoxSelectMode = true;
      boxSelectTarget = target;
      map.dragging.disable();
      map.getContainer().style.cursor = 'crosshair';
    }
    refreshBoxButtons();
  }

  boxEdgeBtn.addEventListener('click', () => setBoxSelectMode("edge"));
  boxNodeBtn.addEventListener('click', () => setBoxSelectMode("node"));

  map.on('mousedown', function (e) {
    if (!isBoxSelectMode || currentEditorMode !== "modify") return;
    boxStartLatLng = e.latlng;
    selectionBox = L.rectangle([boxStartLatLng, boxStartLatLng], { color: "#0055ff", weight: 1, fillOpacity: 0.2 }).addTo(map);
  });

  map.on('mousemove', function (e) {
    if (!isBoxSelectMode || !selectionBox || currentEditorMode !== "modify") return;
    selectionBox.setBounds([boxStartLatLng, e.latlng]);
  });

  map.on('mouseup', function (e) {
    if (!isBoxSelectMode || !selectionBox || currentEditorMode !== "modify") return;
    const bounds = selectionBox.getBounds();

    if (boxSelectTarget === "edge") {
      activePolylines.forEach(polyline => {
        const nodeA = polyline._nodeA;
        const nodeB = polyline._nodeB;
        if (bounds.contains([nodeA.lat, nodeA.lng]) || bounds.contains([nodeB.lat, nodeB.lng])) {
          const edgeData = polyline._edgeData;
          if (edgeData && !selectedEdges.has(edgeData)) {
            selectedEdges.add(edgeData);
            polyline.setStyle({ color: '#00aa55', weight: 8 });
          }
        }
      });
    } else if (boxSelectTarget === "node") {
      activeMarkers.forEach(marker => {
        const node = marker._nodeData;
        if (node && bounds.contains([node.lat, node.lng]) && !selectedNodes.has(node)) {
          selectedNodes.add(node);
          setMarkerSelected(marker, true);
        }
      });
    }

    map.removeLayer(selectionBox);
    selectionBox = null;
    updateBatchUI();
  });

  function updateMarkerDragState() {
    activeMarkers.forEach(marker => {
      if (!marker.dragging) return;
      if (isEditModeActive && currentEditorMode === "build") {
        marker.dragging.enable();
      } else {
        marker.dragging.disable();
      }
    });
  }

  function setEditorMode(mode) {
    currentEditorMode = mode;
    selectedNodeForEdge = null;
    resetBoxSelectButtons();
    refreshBoxButtons();
    clearSelection();
    refreshModeButtons();
    updateMarkerDragState();

    if (!isEditModeActive) return;

    if (currentEditorMode === "build") {
      map.off('click', onMapClick);
      map.on('click', onMapClick);
      boxButtonPanel.style.display = 'none';
    } else {
      map.off('click', onMapClick);
      boxButtonPanel.style.display = 'flex';
    }
  }

  buildModeBtn.addEventListener('click', () => setEditorMode("build"));
  attrModeBtn.addEventListener('click', () => setEditorMode("modify"));
  refreshModeButtons();

  // ==============================================
  // 🔍 重構：強大的屬性搜尋機制（不會阻擋原有物件點擊）
  // ==============================================
  
  // 建立獨立圖層以存放高亮的無互動圖形
  const searchHighlightLayer = L.layerGroup().addTo(map);

  function clearPropertyHighlight() {
    searchHighlightLayer.clearLayers();
    const resultInfo = document.getElementById('search-result-info');
    if (resultInfo) resultInfo.style.display = 'none';
  }

  function performPropertySearch(query) {
    if (!query || query.trim() === "") {
      alert("請輸入搜尋條件\n例如: tree_shade=1 / slope>0.05 / slope>=0.1 / elevation!=0 / distance<50");
      return;
    }

    clearPropertyHighlight();
    query = query.trim();

    // --- 解析運算子，順序很重要：先比對雙字元 >=, <=, != 再比對單字元 >, < ---
    const OPERATORS = ['>=', '<=', '!=', '>', '<', '='];
    let propName = null;
    let operator = null;
    let propValue = null;

    for (const op of OPERATORS) {
      const idx = query.indexOf(op);
      if (idx > 0) {                      // idx > 0 確保屬性名不為空
        propName = query.slice(0, idx).trim();
        operator = op;
        const rawVal = query.slice(idx + op.length).trim();
        // 嘗試轉換為數字或布林值以利比對
        if (rawVal.toLowerCase() === 'true')       propValue = true;
        else if (rawVal.toLowerCase() === 'false') propValue = false;
        else if (rawVal !== '' && !isNaN(rawVal))  propValue = Number(rawVal);
        else                                        propValue = rawVal;
        break;
      }
    }

    // 沒有任何運算子 → 只要屬性存在即符合（原有行為）
    if (!propName) {
      propName = query;
      operator = 'exists';
    }

    if (!propName) return;

    // --- 比對函數：根據運算子判斷是否符合 ---
    function matches(objVal) {
      if (operator === 'exists') return true;

      // != / = 支援字串與數字
      if (operator === '=')  return String(objVal) === String(propValue);
      if (operator === '!=') return String(objVal) !== String(propValue);

      // >, >=, <, <= 只對數字有意義
      const numObj = Number(objVal);
      const numProp = Number(propValue);
      if (isNaN(numObj) || isNaN(numProp)) return false;
      if (operator === '>')  return numObj >  numProp;
      if (operator === '>=') return numObj >= numProp;
      if (operator === '<')  return numObj <  numProp;
      if (operator === '<=') return numObj <= numProp;
      return false;
    }

    console.log(`🔍 搜尋條件: ${propName} ${operator} ${propValue ?? '(exists)'}`);

    let matchedNodeCount = 0;
    let matchedEdgeCount = 0;

    // 搜尋 Nodes
    if (data && data.nodes) {
      data.nodes.forEach(node => {
        if (!node.hasOwnProperty(propName)) return;
        if (!matches(node[propName])) return;

        matchedNodeCount++;
        L.circleMarker([node.lat, node.lng], {
          radius: 18,
          color: '#FF007F',
          weight: 4,
          fillColor: '#FF007F',
          fillOpacity: 0.4,
          interactive: false,
          className: 'god-pulse-animation'
        }).addTo(searchHighlightLayer);
      });
    }

    // 搜尋 Edges
    if (data && data.edges) {
      data.edges.forEach(edge => {
        if (!edge.hasOwnProperty(propName)) return;
        if (!matches(edge[propName])) return;

        matchedEdgeCount++;
        const nodeA = data.nodes.find(n => n.id === edge.from);
        const nodeB = data.nodes.find(n => n.id === edge.to);
        if (nodeA && nodeB) {
          L.polyline([[nodeA.lat, nodeA.lng], [nodeB.lat, nodeB.lng]], {
            color: '#00FFFF',
            weight: 14,
            opacity: 0.55,
            dashArray: '15, 10',
            lineCap: 'round',
            interactive: false
          }).addTo(searchHighlightLayer);
        }
      });
    }

    // 顯示結果反饋
    const resultInfo = document.getElementById('search-result-info');
    if (resultInfo) {
      resultInfo.style.display = 'block';
      if (matchedNodeCount === 0 && matchedEdgeCount === 0) {
        resultInfo.style.borderLeftColor = '#f44336';
        resultInfo.innerHTML = `❌ <b>未找到結果</b><br><span style="font-size:11px; color:#777;">條件: ${query}</span>`;
      } else {
        resultInfo.style.borderLeftColor = '#4CAF50';
        resultInfo.innerHTML = `✅ <b>搜尋成功</b><br>找到 <b style="color:#FF007F;">${matchedNodeCount}</b> 個 Node<br>找到 <b style="color:#009999;">${matchedEdgeCount}</b> 條 Edge`;
      }
    }
  }

  // 綁定搜尋按鈕與事件
  const searchBtn = document.getElementById('property-search-btn');
  const clearBtn = document.getElementById('property-clear-btn');
  const searchInput = document.getElementById('property-search-input');

  if (searchBtn) searchBtn.addEventListener('click', () => performPropertySearch(searchInput.value));
  if (clearBtn) clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearPropertyHighlight();
  });
  
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') performPropertySearch(searchInput.value);
    });
  }

  // --- 上帝模式開關邏輯 ---
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      isEditModeActive = !isEditModeActive;
      if (isEditModeActive) {
        editorLayerGroup.addTo(map);
        modePanel.style.display = 'flex';
        searchPanel.style.display = 'block';
        if (exportBtn) exportBtn.style.display = 'block';
        toggleBtn.style.backgroundColor = "#d9534f";
        toggleBtn.innerHTML = "關閉 God Mode";
        setEditorMode(currentEditorMode);
      } else {
        map.removeLayer(editorLayerGroup);
        map.off('click', onMapClick);
        modePanel.style.display = 'none';
        searchPanel.style.display = 'none';
        if (exportBtn) exportBtn.style.display = 'none';
        boxButtonPanel.style.display = 'none';
        selectedNodeForEdge = null;
        toggleBtn.style.backgroundColor = "#f0ad4e";
        toggleBtn.innerHTML = "🛠️ 開啟上帝模式";
        
        clearPropertyHighlight();
        resetBoxSelectButtons();
        refreshBoxButtons();
        updateMarkerDragState();
        clearSelection();
      }
    });
  }

  const PASSWORD_TOKEN_KEY = "export_password_token";

  function isPasswordVerified() {
    const token = sessionStorage.getItem(PASSWORD_TOKEN_KEY);
    return !!token && token.length > 0;
  }

  function getPasswordToken() {
    return sessionStorage.getItem(PASSWORD_TOKEN_KEY) || "";
  }

  function verifyPassword() {
    return new Promise((resolve) => {
      if (isPasswordVerified()) {
        resolve(true);
        return;
      }

      const passwordDiv = document.createElement('div');
      passwordDiv.style = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 30px;
        border-radius: 10px;
        box-shadow: 0 0 20px rgba(0,0,0,0.5);
        z-index: 10000;
        min-width: 350px;
        font-family: Arial, sans-serif;
      `;
      passwordDiv.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 15px;">
          <h3 style="margin: 0; color: #333; text-align: center;">🔐 密碼驗證</h3>
          <p style="margin: 0; color: #666; font-size: 13px; text-align: center;">儲存修改需要密碼驗證</p>
          <input type="password" id="password-input" placeholder="請輸入密碼" style="padding: 10px; border: 1px solid #ccc; border-radius: 5px; font-size: 14px;" autofocus>
          <div style="display: flex; gap: 10px;">
            <button id="password-confirm" style="flex: 1; padding: 10px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">確認</button>
            <button id="password-cancel" style="flex: 1; padding: 10px; background: #ccc; color: #333; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">取消</button>
          </div>
          <div id="password-error" style="color: #d32f2f; font-size: 12px; display: none; text-align: center;"></div>
        </div>
      `;

      const overlay = document.createElement('div');
      overlay.style = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.4);
        z-index: 9999;
      `;

      document.body.appendChild(overlay);
      document.body.appendChild(passwordDiv);

      const passwordInput = document.getElementById('password-input');
      const confirmBtn = document.getElementById('password-confirm');
      const cancelBtn = document.getElementById('password-cancel');
      const errorDiv = document.getElementById('password-error');

      const cleanup = () => {
        document.body.removeChild(overlay);
        document.body.removeChild(passwordDiv);
      };

      confirmBtn.addEventListener('click', async () => {
        const inputPassword = passwordInput.value;
        confirmBtn.disabled = true;
        confirmBtn.innerText = "⏳ 驗證中...";

        try {
          const response = await fetch('http://localhost:8000/api/verify-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: inputPassword })
          });
          const result = await response.json();

          if (result.status === 'success' && result.token) {
            sessionStorage.setItem(PASSWORD_TOKEN_KEY, result.token);
            console.log("✅ 密碼驗證成功");
            cleanup();
            resolve(true);
          } else {
            errorDiv.textContent = "❌ 密碼錯誤，請重試";
            errorDiv.style.display = 'block';
            passwordInput.value = '';
            passwordInput.focus();
            confirmBtn.disabled = false;
            confirmBtn.innerText = "確認";
          }
        } catch (error) {
          console.error("密碼驗證請求失敗:", error);
          errorDiv.textContent = "❌ 連線失敗，請檢查伺服器";
          errorDiv.style.display = 'block';
          confirmBtn.disabled = false;
          confirmBtn.innerText = "確認";
        }
      });

      cancelBtn.addEventListener('click', () => {
        cleanup();
        resolve(false);
      });

      passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !confirmBtn.disabled) {
          confirmBtn.click();
        }
      });
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      const passwordOk = await verifyPassword();
      if (!passwordOk) {
        console.log("密碼驗證已取消");
        return;
      }

      const originalText = exportBtn.innerText;
      exportBtn.innerText = "⏳ 儲存中...";
      exportBtn.style.backgroundColor = "#5bc0de";
      exportBtn.disabled = true;
      try {
        const response = await fetch('http://localhost:8000/api/graph', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Export-Token': getPasswordToken()
          },
          body: JSON.stringify(data)
        });
        const result = await response.json();
        if (result.status === 'success') {
          alert("✅ 上帝模式：地圖資料已成功儲存至後端數據庫！");
        } else {
          alert("❌ 儲存失敗：" + result.message);
        }
      } catch (error) {
        console.error("儲存 API 錯誤:", error);
        alert("❌ 無法連線到 Python 伺服器。");
      } finally {
        exportBtn.innerText = originalText;
        exportBtn.style.backgroundColor = "#ff3333";
        exportBtn.disabled = false;
      }
    });
  }
}