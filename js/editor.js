// editor.js
export function initEditorMode(map, data, graph) {
  console.log("🛠️ 進入開發者環境：已載入圖形編輯器模組");

  const editorLayerGroup = L.layerGroup();
  let isEditModeActive = false;
  const toggleBtn = document.getElementById("god-mode");
  const exportBtn = document.getElementById('exportBtn');

  const activePolylines = [];
  let selectedNodeForEdge = null;
  const selectedEdges = new Set(); // 儲存批量選取的邊

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

 // --- 批量操作 UI 邏輯 ---
  function updateBatchUI() {
    let batchDiv = document.getElementById('batch-edit-panel');
    if (!batchDiv) {
      batchDiv = document.createElement('div');
      batchDiv.id = 'batch-edit-panel';
      batchDiv.style = "position:fixed; bottom:20px; left:20px; background:white; padding:15px; border-radius:8px; box-shadow:0 0 10px rgba(0,0,0,0.3); z-index:1001; display:none;";
      document.body.appendChild(batchDiv);
    }

    if (selectedEdges.size > 0) {
      batchDiv.style.display = 'block';
      // 🌟 新增了一個藍色的「自訂屬性」按鈕
      batchDiv.innerHTML = `
        <h4 style="margin:0 0 10px 0;">${window.t('batch_selected').replace('{count}', selectedEdges.size)}</h4>
        <button id="btnPedestrian" style="margin-bottom:5px; width:100%; padding:5px; background:#4CAF50; color:white; border:none; cursor:pointer;">${window.t('btn_pedestrian')}</button><br>
        <button id="btnNoMotor" style="margin-bottom:5px; width:100%; padding:5px; background:#f44336; color:white; border:none; cursor:pointer;">${window.t('btn_no_motor')}</button><br>
        <button id="btnCustomAttr" style="margin-bottom:5px; width:100%; padding:5px; background:#007bff; color:white; border:none; cursor:pointer; font-weight:bold;">${window.t('btn_custom_attr')}</button><br>
        <button id="btnClear" style="width:100%; padding:5px; background:#ccc; border:none; cursor:pointer;">${window.t('btn_clear')}</button>
      `;
      
      document.getElementById('btnPedestrian').onclick = () => { applyBatch('pedestrian_only', 1); };
      document.getElementById('btnNoMotor').onclick = () => { applyBatch('motor_vehicle_allowed', 0); };
      document.getElementById('btnClear').onclick = () => { clearSelection(); };

      // 🌟 綁定自訂屬性按鈕的點擊事件 (與單點修改邏輯相同)
      document.getElementById('btnCustomAttr').onclick = () => {
        let key = prompt("請輸入要批量新增/修改的『屬性名稱』\n(例如: lit, sheltered, night_safety):");
        if (!key || key.trim() === "") return;
        
        key = key.trim();
        
        let valStr = prompt(`請輸入『${key}』的數值\n(例如: 1, 0, 99.5):`);
        if (!valStr || valStr.trim() === "") return;
        
        // 自動判斷輸入的是數字還是文字
        let val = isNaN(Number(valStr)) ? valStr.trim() : Number(valStr);
        
        // 呼叫原本寫好的批量應用函數
        applyBatch(key, val);
      };

    } else {
      batchDiv.style.display = 'none';
    }
  }

  function applyBatch(key, value) {
    selectedEdges.forEach(edge => { edge[key] = value; });
    alert(`✅ 已將 ${selectedEdges.size} 條路徑設定為 ${key}=${value}`);
    clearSelection();
  }

  function clearSelection() {
    selectedEdges.clear();
    activePolylines.forEach(p => p.setStyle({ color: 'gray', weight: 5 }));
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
    activePolylines.push(polyline);

    const edgeData = data.edges.find(edge =>
      (edge.from === nodeA.id && edge.to === nodeB.id) ||
      (edge.from === nodeB.id && edge.to === nodeA.id)
    );

    polyline.on('mouseover', function () { if(!selectedEdges.has(edgeData)) this.setStyle({ color: '#ff9900', weight: 8 }); });
    polyline.on('mouseout', function () { if(!selectedEdges.has(edgeData)) this.setStyle({ color: lineColor, weight: 5 }); });

    polyline.on('click', function (e) {
      L.DomEvent.stopPropagation(e);
      if (!edgeData) return;

      // 支援 Shift 多選
      if (e.originalEvent.shiftKey) {
        if (selectedEdges.has(edgeData)) {
          selectedEdges.delete(edgeData);
          this.setStyle({ color: lineColor, weight: 5 });
        } else {
          selectedEdges.add(edgeData);
          this.setStyle({ color: '#00ff00', weight: 8 });
        }
        updateBatchUI();
        return;
      }

      // 單選：編輯屬性視窗
      let attrHtml = `<ul style="list-style:none; padding:0; margin:0 0 12px 0; font-size:14px;">`;
      for(let key in edgeData) {
        if(['from', 'to', 'source', 'target', 'id'].includes(key)) continue;
        let displayVal = typeof edgeData[key] === 'number' ? edgeData[key].toFixed(2) : edgeData[key];
        attrHtml += `<li style="border-bottom: 1px dashed #ccc; padding-bottom: 2px;"><b>${key}</b>: <span style="color:#0055ff;">${displayVal}</span></li>`;
      }
      attrHtml += `</ul>`;

      let html = `
        <div style="min-width: 160px; font-family: sans-serif;">
          <h4 style="margin: 0 0 10px 0; border-bottom: 2px solid #333; padding-bottom: 5px;">📍 路線屬性</h4>
          ${attrHtml}
          <button id="btnAddAttr" style="width:100%; background:#007bff; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer;">➕ 新增/修改屬性</button>
        </div>
      `;

      L.popup().setLatLng(e.latlng).setContent(html).openOn(map);

      setTimeout(() => {
        let btn = document.getElementById('btnAddAttr');
        if(btn) {
          btn.onclick = () => {
            let key = prompt("請輸入屬性名稱 (例如: pedestrian_only):");
            if (!key || key.trim() === "") return;
            key = key.trim();
            let valStr = prompt(`請輸入『${key}』的數值:`);
            if (!valStr || valStr.trim() === "") return;
            let val = isNaN(Number(valStr)) ? valStr.trim() : Number(valStr);
            edgeData[key] = val;
            alert(`✅ 成功設定！[ ${key} = ${val} ]\n記得點擊右上角「儲存」`);
            map.closePopup();
          };
        }
      }, 100);
    });

    polyline.on('contextmenu', function (e) {
      L.DomEvent.stopPropagation(e);
      if (confirm(`確定要剪斷 [${nodeA.id}] 和 [${nodeB.id}] 之間的連線嗎？`)) {
        editorLayerGroup.removeLayer(polyline);
        const index = activePolylines.indexOf(polyline);
        if (index > -1) activePolylines.splice(index, 1);
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

    marker.on('drag', function (e) {
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
      if (confirm(`確定要刪除節點 ${node.id} 嗎？`)) {
        editorLayerGroup.removeLayer(marker);
        data.nodes = data.nodes.filter(n => n.id !== node.id);
        data.edges = data.edges.filter(e => e.from !== node.id && e.to !== node.id);
      }
    });

    marker.on('click', function (e) {
      L.DomEvent.stopPropagation(e);
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
          { from: nodeA.id, to: nodeB.id, distance: dist, slope: slope, accessible: true },
          { from: nodeB.id, to: nodeA.id, distance: dist, slope: slope, accessible: true }
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
  // 🌟 核心升級：滑鼠拖曳框選功能
  // ==========================================
  let isBoxSelectMode = false;
  let selectionBox = null;
  let boxStartLatLng = null;

  // 建立按鈕
  const boxSelectBtn = document.createElement('button');
  boxSelectBtn.innerHTML = window.t('box_select_enable'); // 這裡修改
  boxSelectBtn.style = "position:absolute; top:80px; right:10px; z-index:1000; padding:10px; background:white; border:2px solid rgba(0,0,0,0.2); border-radius:5px; cursor:pointer; font-weight:bold; box-shadow:0 2px 5px rgba(0,0,0,0.3); display:none;";
  document.body.appendChild(boxSelectBtn);

  boxSelectBtn.addEventListener('click', () => {
    isBoxSelectMode = !isBoxSelectMode;
    if (isBoxSelectMode) {
      map.dragging.disable(); 
      boxSelectBtn.innerHTML = window.t('box_select_disable'); // 這裡修改
      boxSelectBtn.style.backgroundColor = "#ffeb3b";
      map.getContainer().style.cursor = 'crosshair';
    } else {
      map.dragging.enable(); 
      boxSelectBtn.innerHTML = window.t('box_select_enable'); // 這裡修改
      boxSelectBtn.style.backgroundColor = "white";
      map.getContainer().style.cursor = '';
    }
  });

  map.on('mousedown', function (e) {
    if (!isBoxSelectMode) return;
    boxStartLatLng = e.latlng;
    selectionBox = L.rectangle([boxStartLatLng, boxStartLatLng], { color: "#0055ff", weight: 1, fillOpacity: 0.2 }).addTo(map);
  });

  map.on('mousemove', function (e) {
    if (!isBoxSelectMode || !selectionBox) return;
    selectionBox.setBounds([boxStartLatLng, e.latlng]);
  });

  map.on('mouseup', function (e) {
    if (!isBoxSelectMode || !selectionBox) return;
    const bounds = selectionBox.getBounds();
    activePolylines.forEach(polyline => {
      const nodeA = polyline._nodeA;
      const nodeB = polyline._nodeB;
      // 只要有一端在框框內就算選中
      if (bounds.contains([nodeA.lat, nodeA.lng]) || bounds.contains([nodeB.lat, nodeB.lng])) {
        const edgeData = data.edges.find(edge =>
          (edge.from === nodeA.id && edge.to === nodeB.id) ||
          (edge.from === nodeB.id && edge.to === nodeA.id)
        );
        if (edgeData && !selectedEdges.has(edgeData)) {
          selectedEdges.add(edgeData);
          polyline.setStyle({ color: '#00ff00', weight: 8 });
        }
      }
    });
    map.removeLayer(selectionBox);
    selectionBox = null;
    updateBatchUI(); // 彈出批量面板
  });

  // --- 上帝模式開關邏輯 ---
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      isEditModeActive = !isEditModeActive;
      if (isEditModeActive) {
        editorLayerGroup.addTo(map);
        map.on('click', onMapClick);
        if (exportBtn) exportBtn.style.display = 'block';
        boxSelectBtn.style.display = 'block'; // 打開上帝模式時，顯示框選按鈕
        toggleBtn.style.backgroundColor = "#d9534f";
      } else {
        map.removeLayer(editorLayerGroup);
        map.off('click', onMapClick);
        if (exportBtn) exportBtn.style.display = 'none';
        boxSelectBtn.style.display = 'none'; // 關閉上帝模式時，隱藏框選按鈕
        selectedNodeForEdge = null;
        toggleBtn.style.backgroundColor = "#f0ad4e";
        
        // 防呆機制：關閉上帝模式時，強制復原地圖拖曳狀態
        isBoxSelectMode = false;
        map.dragging.enable();
        boxSelectBtn.innerHTML = window.t('box_select_enable'); // 這裡修改
        boxSelectBtn.style.backgroundColor = "white";
        map.getContainer().style.cursor = '';
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