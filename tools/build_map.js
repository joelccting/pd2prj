const fs = require('fs');

// 1. 定義範圍與 Overpass API 查詢語法
// 這裡使用的是你之前設定的隱形牆邊界 [南, 西, 北, 東]
const bbox = "23.553530, 120.464366,23.569501, 120.481618"; 

// 只抓取 highway (道路/步道/階梯) 的資料
const query = `
  [out:json][timeout:25];
  (
    way["highway"](${bbox});
  );
  out body;
  >;
  out skel qt;
`;

const url = "https://overpass-api.de/api/interpreter";

// 2. Haversine 公式：用經緯度計算地球表面兩點距離 (公尺)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // 地球半徑 (公尺)
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 3. 核心主程式
async function fetchCampusData() {
  console.log("🚀 正在向 OpenStreetMap 請求校園資料...");
  try {
    const response = await fetch(url, {
      method: "POST",
      body: "data=" + encodeURIComponent(query),
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });
    
    const osmData = await response.json();
    console.log("✅ 成功獲取資料，開始轉換 JSON 格式...");

    const nodesMap = new Map();
    const finalNodes = [];
    const finalEdges = [];
    const usedNodeIds = new Set();

    // 步驟 A: 暫存所有點位
    osmData.elements.forEach(el => {
      if (el.type === "node") {
        nodesMap.set(el.id, { lat: el.lat, lng: el.lon });
      }
    });

    // 步驟 B: 處理道路並拆解成 Edge
    osmData.elements.forEach(el => {
      if (el.type === "way" && el.nodes) {
        const tags = el.tags || {};
        // 如果是階梯，無障礙就是 false
        const isAccessible = tags.highway !== "steps";

        for (let i = 0; i < el.nodes.length - 1; i++) {
          const fromId = el.nodes[i];
          const toId = el.nodes[i + 1];

          const fromNode = nodesMap.get(fromId);
          const toNode = nodesMap.get(toId);

          if (fromNode && toNode) {
            usedNodeIds.add(fromId);
            usedNodeIds.add(toId);

            const dist = calculateDistance(fromNode.lat, fromNode.lng, toNode.lat, toNode.lng);

            // 存入 A -> B
            finalEdges.push({
              from: fromId,
              to: toId,
              distance: dist,
              accessible: isAccessible
            });
            
            // 除非 OSM 標記為單行道，否則都加入 B -> A 反向邊
            if (tags.oneway !== "yes") {
              finalEdges.push({
                from: toId,
                to: fromId,
                distance: dist,
                accessible: isAccessible
              });
            }
          }
        }
      }
    });

    // 步驟 C: 將有用到的點轉成你們專案的格式
    usedNodeIds.forEach(id => {
      const n = nodesMap.get(id);
      finalNodes.push({
        id: id,
        name: "", // ⚠️ 程式無法通靈建築物名字，預設留空
        lat: n.lat,
        lng: n.lng,
        accessible: true,
        type: "path_node"
      });
    });

    // 步驟 D: 輸出檔案
    const resultJSON = {
      nodes: finalNodes,
      edges: finalEdges
    };

    fs.writeFileSync("campus_nodes_edges.json", JSON.stringify(resultJSON, null, 2));
    console.log(`🎉 轉換完成！`);
    console.log(`📍 總共抓取了 ${finalNodes.length} 個節點`);
    console.log(`🔗 總共建立了 ${finalEdges.length} 條連線 (Edges)`);
    console.log("💾 檔案已覆蓋/儲存為 campus_nodes_edges.json");

  } catch (error) {
    console.error("❌ 發生錯誤：", error);
  }
}

fetchCampusData();