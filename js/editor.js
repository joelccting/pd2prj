// editor.js
export function initEditorMode(map, data, graph) {
  console.log("🛠️ 進入開發者環境：已載入圖形編輯器模組");

  // --- 1. 初始化專屬圖層與 UI ---
  const editorLayerGroup = L.layerGroup(); // 魔法袋：把所有編輯用的點和線裝進這裡
  let isEditModeActive = false;
  
  const toggleBtn = document.getElementById("toggleEditModeBtn");
  const exportBtn = document.getElementById('exportBtn');
  
  // 如果網址有 ?mode=edit，才顯示切換按鈕
  if (toggleBtn) toggleBtn.style.display = "inline-block";

  // --- 2. 狀態變數 (絕對不能重複宣告) ---
  const activePolylines = [];
  let selectedNodeForEdge = null;

  const customIcon = L.divIcon({
    className: 'custom-div-icon',
    html: "<div style='background-color:#0055ff; width:12px; height:12px; border-radius:50%; border:2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);'></div>",
    iconSize: [12, 12],
    iconAnchor: [6, 6]
  });

  // --- 3. 核心工具函數 ---
  function getDistance(lat1, lon1, lat2, lon2) { 
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
  }

  // --- 4. 繪圖組件 (加入 editorLayerGroup 而不是 map) ---
  function createEditableEdge(nodeA, nodeB, isNew = false) { 
    const lineColor = isNew ? "#ff0044" : "gray";
    const polyline = L.polyline(
      [[nodeA.lat, nodeA.lng], [nodeB.lat, nodeB.lng]], 
      { color: lineColor, weight: 5, opacity: 0.7 } 
    ).addTo(editorLayerGroup); // 👈 關鍵：加到圖層群組

    polyline._nodeA = nodeA;
    polyline._nodeB = nodeB;
    activePolylines.push(polyline);

    polyline.on('mouseover', function () { this.setStyle({ color: '#ff9900', weight: 8 }); });
    polyline.on('mouseout', function () { this.setStyle({ color: lineColor, weight: 5 }); });

    polyline.on('contextmenu', function (e) {
      L.DomEvent.stopPropagation(e); 
      if (confirm(`確定要剪斷 [${nodeA.id}] 和 [${nodeB.id}] 之間的連線嗎？`)) {
        editorLayerGroup.removeLayer(polyline); // 👈 從群組移除
        
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

  function createEditableMarker(node) {
    const marker = L.marker([node.lat, node.lng], {
      icon: customIcon,
      draggable: true,
      title: `ID: ${node.id}\n(左鍵連線 / 右鍵刪除)`
    }).addTo(editorLayerGroup); // 👈 關鍵：加到圖層群組

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

    marker.on('dragend', function (e) {
      data.edges.forEach(edge => {
        if (edge.from === node.id || edge.to === node.id) {
          const otherNodeId = edge.from === node.id ? edge.to : edge.from;
          const otherNode = data.nodes.find(n => n.id === otherNodeId);
          if (otherNode) edge.distance = getDistance(node.lat, node.lng, otherNode.lat, otherNode.lng);
        }
      });
    });

    marker.on('contextmenu', function () {
      if (confirm(`確定要刪除節點 ${node.id} 嗎？`)) {
        editorLayerGroup.removeLayer(marker);
        data.nodes = data.nodes.filter(n => n.id !== node.id);
        data.edges = data.edges.filter(e => e.from !== node.id && e.to !== node.id);
        graph.removeNode(node.id);
      }
    });

    marker.on('click', function (e) {
      L.DomEvent.stopPropagation(e); 
      if (!selectedNodeForEdge) {
        selectedNodeForEdge = node;
        alert(`📍 已選取起點 (ID: ${node.id})\n👉 現在請點擊另一個節點來建立連線！`);
      } else {
        if (selectedNodeForEdge.id === node.id) {
          selectedNodeForEdge = null; 
          return;
        }
        const nodeA = selectedNodeForEdge;
        const nodeB = node;
        const dist = getDistance(nodeA.lat, nodeA.lng, nodeB.lat, nodeB.lng);

        data.edges.push(
          { from: nodeA.id, to: nodeB.id, distance: dist, accessible: true },
          { from: nodeB.id, to: nodeA.id, distance: dist, accessible: true }
        );
        graph.addEdge({ from: nodeA.id, to: nodeB.id, distance: dist, accessible: true });
        graph.addEdge({ from: nodeB.id, to: nodeA.id, distance: dist, accessible: true });
        
        createEditableEdge(nodeA, nodeB, true);
        selectedNodeForEdge = null; 
      }
    });
  }

  // --- 5. 初始資料載入 ---
  data.nodes.forEach(node => createEditableMarker(node));

  const drawnEdges = new Set();
  data.edges.forEach((edge) => {
    const fromNode = graph.nodes.get(edge.from);
    const toNode = graph.nodes.get(edge.to);
    if (!fromNode || !toNode) return;

    const edgeKey = edge.from < edge.to ? `${edge.from}-${edge.to}` : `${edge.to}-${edge.from}`;
    if (!drawnEdges.has(edgeKey)) {
      createEditableEdge(fromNode, toNode, false);
      drawnEdges.add(edgeKey);
    }
  });

  // --- 6. 點擊地圖新增點 (包裝成函數) ---
  function onMapClick(e) {
    if (selectedNodeForEdge) { selectedNodeForEdge = null; return; }
    
    const currentMaxId = data.nodes.reduce((max, node) => Math.max(max, Number(node.id)), 0);
    const newNode = {
      id: currentMaxId + 1, name: "", lat: e.latlng.lat, lng: e.latlng.lng,
      accessible: true, type: "path_node"
    };

    data.nodes.push(newNode);
    graph.addNode(newNode);
    createEditableMarker(newNode);
  }

  // --- 7. 上帝模式切換邏輯 (完美開關) ---
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      isEditModeActive = !isEditModeActive;

      if (isEditModeActive) {
        editorLayerGroup.addTo(map);
        map.on('click', onMapClick);
        if (exportBtn) exportBtn.style.display = 'block';
        
        // 👉 狀態開啟時：改變 i18n 標籤為「關閉」，並換成紅色
        toggleBtn.setAttribute('data-i18n', 'god_mode_disable_btn');
        toggleBtn.style.backgroundColor = "#d9534f";
      } else {
        map.removeLayer(editorLayerGroup);
        map.off('click', onMapClick);
        if (exportBtn) exportBtn.style.display = 'none';
        selectedNodeForEdge = null; 
        
        // 👉 狀態關閉時：改變 i18n 標籤為「開啟」，並換回黃色
        toggleBtn.setAttribute('data-i18n', 'god_mode_enable_btn');
        toggleBtn.style.backgroundColor = "#f0ad4e";
      }

      // 🪄 神奇魔法：呼叫 lang.js 的函數，讓它根據新的標籤重新翻譯按鈕！
      const currentLang = document.getElementById("language-selector").value || "zh";
      if (window.applyTranslations) {
        window.applyTranslations(currentLang);
      }
    });
  }

  // --- 8. 匯出與外掛功能 ---
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "campus_nodes_edges.json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      alert("✅ 下載完成！請覆蓋原本的 JSON 並重整。");
    });
  }

  window.calcd = function(id1, id2) { /* 你原本的外掛代碼 */ };
}