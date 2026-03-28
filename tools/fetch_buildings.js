const fs = require('fs');

// 備份機制
fs.copyFileSync('campus_nodes_edges.json', 'campus_nodes_edges_backup.json');
console.log("✅ 已備份原始資料");

const rawData = fs.readFileSync('campus_nodes_edges.json');
const campusData = JSON.parse(rawData);

// 1. 測量地球兩點真實距離 (公尺)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// 2. 向量投影數學：尋找點 P 在線段 AB 上的「垂直投影點」
function getProjectedPoint(pLat, pLng, aLat, aLng, bLat, bLng) {
  const dx = bLng - aLng;
  const dy = bLat - aLat;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) return { lat: aLat, lng: aLng, t: 0 };

  // 計算 t 值 (投影點在線段上的比例)
  let t = ((pLng - aLng) * dx + (pLat - aLat) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t)); // 限制在 0~1 之間，確保不超出線段兩端

  return {
    lat: aLat + t * dy,
    lng: aLng + t * dx,
    t: t
  };
}

async function fetchAndConnectBuildings() {
  console.log("⏳ 啟動 Snap-to-Road 垂直吸附抓取...");
  const bbox = "23.550,120.460,23.570,120.480";
  const query = `
    [out:json][timeout:25];
    (
      way["building"](${bbox});
      relation["building"](${bbox});
      node["amenity"="restaurant"](${bbox});
      node["amenity"="cafe"](${bbox});
      node["shop"="convenience"](${bbox});
    );
    out center;
  `;

  const url = "https://overpass.kumi.systems/api/interpreter";

  try {
    const response = await fetch(url, {
      method: "POST",
      body: "data=" + encodeURIComponent(query),
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });

    const osmData = await response.json();
    
    // 建立 Node 快速查詢字典
    const nodeMap = new Map();
    campusData.nodes.forEach(n => nodeMap.set(n.id, n));

    let splitEdgesCount = 0;
    let nextVirtualNodeId = 9000001; // 從 900 萬開始編號，代表我們切出來的虛擬點

    osmData.elements.forEach(element => {
      const name = element.tags && element.tags.name ? element.tags.name : null;
      if (!name) return;

      const lat = element.lat || (element.center && element.center.lat);
      const lng = element.lon || (element.center && element.center.lon);
      if (!lat || !lng) return;

      const newId = element.id;

      // 新增店家/建築物 Node
      const poiNode = {
        id: newId,
        name: name,
        lat: Number(lat),
        lng: Number(lng),
        accessible: true,
        type: "poi"
      };
      campusData.nodes.push(poiNode);
      nodeMap.set(newId, poiNode);

      // 🎯 核心邏輯：這次我們不找最近的 Node，而是找最近的「Edge (線段)」！
      let minDistance = Infinity;
      let bestEdgeInfo = null;
      let bestProjectedPoint = null;

      campusData.edges.forEach(edge => {
        if (edge._deleted) return; // 跳過已經被剪斷的廢棄路線
        
        const nodeA = nodeMap.get(edge.from);
        const nodeB = nodeMap.get(edge.to);
        
        if (!nodeA || !nodeB) return;
        if (nodeA.type === 'poi' || nodeB.type === 'poi') return; // 不要連到別家店身上

        // 算出垂直點
        const proj = getProjectedPoint(lat, lng, nodeA.lat, nodeA.lng, nodeB.lat, nodeB.lng);
        // 算出店家到垂直點的距離
        const dist = getDistance(lat, lng, proj.lat, proj.lng);

        if (dist < minDistance) {
          minDistance = dist;
          bestEdgeInfo = { edge, nodeA, nodeB };
          bestProjectedPoint = proj;
        }
      });

      // 如果找到的最近道路在 150 公尺內，執行「吸附」
      if (bestEdgeInfo && minDistance < 150) {
        let connectionNodeId;

        // 狀況 1：投影點剛好在端點上
        if (bestProjectedPoint.t === 0) {
          connectionNodeId = bestEdgeInfo.nodeA.id;
        } else if (bestProjectedPoint.t === 1) {
          connectionNodeId = bestEdgeInfo.nodeB.id;
        } 
        // 狀況 2：投影點在線段中間！拿出剪刀！
        else {
          connectionNodeId = nextVirtualNodeId++;
          
          // 生出一個虛擬路口 Node
          const virtualNode = {
            id: connectionNodeId,
            name: "", // 路口沒有名字
            lat: Number(bestProjectedPoint.lat.toFixed(6)),
            lng: Number(bestProjectedPoint.lng.toFixed(6)),
            accessible: bestEdgeInfo.edge.accessible,
            type: "virtual_path"
          };
          campusData.nodes.push(virtualNode);
          nodeMap.set(connectionNodeId, virtualNode);

          // 計算剪斷後的兩段新長度
          const distA_to_V = getDistance(bestEdgeInfo.nodeA.lat, bestEdgeInfo.nodeA.lng, virtualNode.lat, virtualNode.lng);
          const distV_to_B = getDistance(virtualNode.lat, virtualNode.lng, bestEdgeInfo.nodeB.lat, bestEdgeInfo.nodeB.lng);

          // 標記原本的線段為「已刪除」(包含正向跟反向)
          bestEdgeInfo.edge._deleted = true;
          const reverseEdge = campusData.edges.find(e => e.from === bestEdgeInfo.nodeB.id && e.to === bestEdgeInfo.nodeA.id && !e._deleted);
          if (reverseEdge) reverseEdge._deleted = true;

          // 重新接線：A <-> 虛擬點 <-> B
          campusData.edges.push(
            { from: bestEdgeInfo.nodeA.id, to: virtualNode.id, distance: Number(distA_to_V.toFixed(8)), accessible: bestEdgeInfo.edge.accessible },
            { from: virtualNode.id, to: bestEdgeInfo.nodeA.id, distance: Number(distA_to_V.toFixed(8)), accessible: bestEdgeInfo.edge.accessible },
            { from: virtualNode.id, to: bestEdgeInfo.nodeB.id, distance: Number(distV_to_B.toFixed(8)), accessible: bestEdgeInfo.edge.accessible },
            { from: bestEdgeInfo.nodeB.id, to: virtualNode.id, distance: Number(distV_to_B.toFixed(8)), accessible: bestEdgeInfo.edge.accessible }
          );
          splitEdgesCount++;
        }

        // 把店家連到我們決定好的 connectionNodeId 上 (雙向)
        campusData.edges.push(
          { from: newId, to: connectionNodeId, distance: Number(minDistance.toFixed(8)), accessible: true },
          { from: connectionNodeId, to: newId, distance: Number(minDistance.toFixed(8)), accessible: true }
        );
      }
    });

    // 最後，把那些被我們剪斷標記為 _deleted 的舊線段徹底丟掉
    campusData.edges = campusData.edges.filter(e => !e._deleted);

    fs.writeFileSync('campus_nodes_edges.json', JSON.stringify(campusData, null, 2));
    
    console.log("==================================================");
    console.log(`🎉 抓取完成！`);
    console.log(`✂️  為了讓店家能「垂直」接上馬路，我們打斷並重接了 ${splitEdgesCount} 條道路！`);
    console.log("==================================================");

  } catch (error) {
    console.error("❌ 抓取失敗:", error);
  }
}

fetchAndConnectBuildings();