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
  const selectedEdges = new Set(); // 儲存批量選取的邊
  const selectedNodes = new Set();
  let currentEditorMode = "build";
  let isBoxSelectMode = false;
  let boxSelectTarget = null;
  let selectionBox = null;
  let boxStartLatLng = null;

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
  modePanel.style = "position:fixed; bottom:20px; right:150px; z-index:2000; display:none; gap:8px; align-items:center;";
  modePanel.innerHTML = `
    <button id="god-build-mode" type="button" style="padding:10px 14px; font-weight:bold; border:none; border-radius:8px; cursor:pointer; box-shadow:0 4px 6px rgba(0,0,0,0.25);">建築模式</button>
    <button id="god-attr-mode" type="button" style="padding:10px 14px; font-weight:bold; border:none; border-radius:8px; cursor:pointer; box-shadow:0 4px 6px rgba(0,0,0,0.25);">修改模式</button>
  `;
  document.body.appendChild(modePanel);

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

    targets.forEach(target => { target[key] = val; });
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

  // --- 批量操作 UI 邏輯 ---
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

  // --- 繪製可編輯邊線 ---
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

  // --- 初始資料載入 ---
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

  // ==========================================
  // 修改模式專用：Edge / Node 分開框選
  // ==========================================
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

  // --- 上帝模式開關邏輯 ---
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      isEditModeActive = !isEditModeActive;
      if (isEditModeActive) {
        editorLayerGroup.addTo(map);
        modePanel.style.display = 'flex';
        if (exportBtn) exportBtn.style.display = 'block';
        toggleBtn.style.backgroundColor = "#d9534f";
        toggleBtn.innerHTML = "關閉 God Mode";
        setEditorMode(currentEditorMode);
      } else {
        map.removeLayer(editorLayerGroup);
        map.off('click', onMapClick);
        modePanel.style.display = 'none';
        if (exportBtn) exportBtn.style.display = 'none';
        boxButtonPanel.style.display = 'none';
        selectedNodeForEdge = null;
        toggleBtn.style.backgroundColor = "#f0ad4e";
        toggleBtn.innerHTML = "🛠️ 開啟上帝模式";
        
        // 防呆機制：關閉上帝模式時，強制復原地圖拖曳狀態
        resetBoxSelectButtons();
        refreshBoxButtons();
        updateMarkerDragState();
        clearSelection();
      }
    });
  }

  // --- 儲存至數據庫 ---
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      const originalText = exportBtn.innerText;
      exportBtn.innerText = "⏳ 儲存中...";
      exportBtn.style.backgroundColor = "#5bc0de";
      exportBtn.disabled = true;
      try {
        const response = await fetch('http://localhost:8000/api/graph', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
