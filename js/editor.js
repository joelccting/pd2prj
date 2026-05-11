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
  async function getElevation(lat, lng) {
    try {
      // 使用 SRTM30m 資料集 (全球覆蓋且精度不錯)
      const response = await fetch(`https://api.opentopodata.org/v1/srtm30m?locations=${lat},${lng}`);
      const result = await response.json();
      if (result && result.results && result.results.length > 0) {
        return result.results[0].elevation || 0; // 回傳公尺
      }
      return 0;
    } catch (error) {
      console.error("無法取得海拔資料，預設為 0:", error);
      return 0;
    }
  }

  // --- 4. 繪圖組件 (加入 editorLayerGroup 而不是 map) ---
  // --- 4. 繪圖組件 (加入 editorLayerGroup) ---
  function createEditableEdge(nodeA, nodeB, isNew = false) { 
    const lineColor = isNew ? "#ff0044" : "gray";
    const polyline = L.polyline(
      [[nodeA.lat, nodeA.lng], [nodeB.lat, nodeB.lng]], 
      { color: lineColor, weight: 5, opacity: 0.7 } 
    ).addTo(editorLayerGroup); 

    polyline._nodeA = nodeA;
    polyline._nodeB = nodeB;
    activePolylines.push(polyline);

    polyline.on('mouseover', function () { this.setStyle({ color: '#ff9900', weight: 8 }); });
    polyline.on('mouseout', function () { this.setStyle({ color: lineColor, weight: 5 }); });

    polyline.on('click', function (e) {
      L.DomEvent.stopPropagation(e);
      
      // 找出這條線在資料庫中的真實物件
      let currentEdge = data.edges.find(edge => 
        (edge.from === nodeA.id && edge.to === nodeB.id) ||
        (edge.from === nodeB.id && edge.to === nodeA.id)
      );

      if (!currentEdge) return;

      // 動態生成這條線的當前屬性列表
      let attrHtml = `<ul style="list-style:none; padding:0; margin:0 0 12px 0; font-size:14px; line-height:1.6;">`;
      for(let key in currentEdge) {
        if(['from', 'to', 'source', 'target', 'id'].includes(key)) continue;
        let displayVal = typeof currentEdge[key] === 'number' ? currentEdge[key].toFixed(2) : currentEdge[key];
        attrHtml += `<li style="border-bottom: 1px dashed #ccc; padding-bottom: 2px;"><b>${key}</b>: <span style="color:#0055ff;">${displayVal}</span></li>`;
      }
      attrHtml += `</ul>`;

      // 建立乾淨的面板 (只放一個大按鈕)
      let html = `
        <div style="min-width: 160px; font-family: sans-serif;">
          <h4 style="margin: 0 0 10px 0; color: #333; border-bottom: 2px solid #333; padding-bottom: 5px;">📍 路線屬性</h4>
          ${attrHtml}
          <button id="btnAddAttr" style="width:100%; background:#007bff; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer; font-weight:bold; font-size: 13px;">
            ➕ 新增 / 修改屬性
          </button>
        </div>
      `;

      // 綁定 Popup
      L.popup().setLatLng(e.latlng).setContent(html).openOn(map);

      // 等待 DOM 渲染後綁定「彈出小視窗」事件
      setTimeout(() => {
        let btn = document.getElementById('btnAddAttr');
        if(btn) {
          btn.onclick = () => {
            // 1. 跳出第一個小視窗問「屬性名稱」
            let key = prompt("請輸入要新增或修改的『屬性名稱』\n(例如: night_safety, sheltered, stair_count):");
            if (!key || key.trim() === "") return; // 如果使用者按取消或沒輸入就結束

            key = key.trim();

            // 2. 跳出第二個小視窗問「數值」
            let valStr = prompt(`請輸入『${key}』的數值\n(例如: 1, 0, 99.5):`);
            if (!valStr || valStr.trim() === "") return;

            // 3. 自動判斷輸入的是不是數字
            let val = isNaN(Number(valStr)) ? valStr.trim() : Number(valStr);
            currentEdge[key] = val;

            // 4. 成功提示
            alert(`✅ 成功設定！\n[ ${key} = ${val} ]\n\n(關閉提示後，您可以再次點擊路線查看，確認無誤後請記得點擊右上角「儲存至數據庫」)`);
            map.closePopup(); // 關閉原本的地圖 Popup 以便重新整理畫面
          };
        }
      }, 100);
    });

    // 右鍵剪斷連線 (保留原有功能)
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

    marker.on('dragend', async function (e) {
      // 拖曳結束後，重新抓取該地點的新海拔
      const newElev = await getElevation(node.lat, node.lng);
      node.elevation = newElev;

      data.edges.forEach(edge => {
        if (edge.from === node.id || edge.to === node.id) {
          const otherNodeId = edge.from === node.id ? edge.to : edge.from;
          const otherNode = data.nodes.find(n => n.id === otherNodeId);
          if (otherNode) {
             // 重新計算距離
             const dist = getDistance(node.lat, node.lng, otherNode.lat, otherNode.lng);
             edge.distance = dist;
             
             // 重新計算斜率
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
        
        // 計算水平距離 (distance)
        const dist = getDistance(nodeA.lat, nodeA.lng, nodeB.lat, nodeB.lng);
        
        // 取得兩點海拔 (若舊資料沒海拔則視為 0)
        const elevA = nodeA.elevation || 0;
        const elevB = nodeB.elevation || 0;
        
        // 📐 計算斜率 (Slope) = 高度差 / 水平距離
        let slope = 0;
        if (dist > 0) {
          slope = Math.abs(elevA - elevB) / dist;
        }

        // 👈 將 slope 寫入邊的屬性中！
        data.edges.push(
          { from: nodeA.id, to: nodeB.id, distance: dist, slope: slope, accessible: true },
          { from: nodeB.id, to: nodeA.id, distance: dist, slope: slope, accessible: true }
        );
        
        graph.addEdge({ from: nodeA.id, to: nodeB.id, distance: dist, slope: slope, accessible: true });
        graph.addEdge({ from: nodeB.id, to: nodeA.id, distance: dist, slope: slope, accessible: true });
        
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

  // --- 6. 點擊地圖新增點 (加入海拔自動抓取) ---
  async function onMapClick(e) {
    if (selectedNodeForEdge) { selectedNodeForEdge = null; return; }
    
    // UI 反饋：因為打 API 需要大概零點幾秒，先給使用者一個提示
    const tempMarker = L.marker(e.latlng).addTo(editorLayerGroup);
    tempMarker.bindPopup("⏳ 正在測量海拔...").openPopup();

    // 呼叫 API 取得真實海拔
    const elevation = await getElevation(e.latlng.lat, e.latlng.lng);
    
    editorLayerGroup.removeLayer(tempMarker); // 移除暫時標記

    const currentMaxId = data.nodes.reduce((max, node) => Math.max(max, Number(node.id)), 0);
    const newNode = {
      id: currentMaxId + 1, name: "", lat: e.latlng.lat, lng: e.latlng.lng,
      elevation: elevation, // 👈 關鍵：把海拔存進 JSON 數據庫
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
    exportBtn.addEventListener('click', async () => {
      // 在按鈕上顯示儲存中，給使用者回饋
      const originalText = exportBtn.innerText;
      exportBtn.innerText = "⏳ 儲存至數據庫中...";
      exportBtn.style.backgroundColor = "#5bc0de"; // 換成藍色表示處理中
      exportBtn.disabled = true;

      try {
        // 使用 POST 請求將編輯後的 JSON 傳送給 Python 後端
        const response = await fetch('http://localhost:8000/api/graph', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.status === 'success') {
          alert("✅ 上帝模式：地圖資料已成功儲存至後端數據庫！C++ 引擎已自動同步最新路網。");
        } else {
          alert("❌ 儲存失敗：" + result.message);
        }
      } catch (error) {
        console.error("儲存 API 錯誤:", error);
        alert("❌ 無法連線到後端伺服器，請確認 Python API 已啟動。");
      } finally {
        // 恢復按鈕原本的樣子
        exportBtn.innerText = originalText;
        exportBtn.style.backgroundColor = "#ff3333";
        exportBtn.disabled = false;
      }
    });
  }


}