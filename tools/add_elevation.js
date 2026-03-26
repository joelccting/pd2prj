const fs = require('fs');

// 1. 讀取你們剛剛辛苦生出來的地圖資料
const rawData = fs.readFileSync('campus_nodes_edges.json');
const campusData = JSON.parse(rawData);

async function fetchElevations() {
  const nodes = campusData.nodes;
  const chunkSize = 100; // Open Topo Data 規定每次最多只能查 100 個點
  
  console.log(`🏔️ 準備為 ${nodes.length} 個節點注入海拔高度...`);

  // 將幾千個點分批處理 (迴圈)
  for (let i = 0; i < nodes.length; i += chunkSize) {
    const chunk = nodes.slice(i, i + chunkSize);
    
    // 將 100 個座標組裝成 API 要求的格式: lat1,lng1|lat2,lng2|...
    const locations = chunk.map(n => `${n.lat},${n.lng}`).join('|');
    const url = `https://api.opentopodata.org/v1/mapzen?locations=${locations}`;
    
    try {
      console.log(`⏳ 正在向衛星資料庫查詢第 ${i + 1} ~ ${Math.min(i + chunkSize, nodes.length)} 個點...`);
      const response = await fetch(url);
      const data = await response.json();
      
      // 將伺服器算好的海拔高度 (elevation)，寫回我們的 node 物件裡
      if (data.results) {
        data.results.forEach((res, index) => {
          // res.elevation 就是海拔高度 (單位: 公尺)
          chunk[index].elevation = Number(res.elevation.toFixed(2)); 
        });
      }
      
      // ⚠️ 禮貌性暫停：每次打完 API 休息 1.5 秒，避免把免費伺服器塞爆被封鎖 IP
      await new Promise(r => setTimeout(r, 1500));
      
    } catch (error) {
      console.error("❌ 抓取失敗，請檢查網路狀態：", error);
    }
  }

  // 2. 將包含海拔的新資料，覆寫回原本的檔案
  fs.writeFileSync('campus_nodes_edges.json', JSON.stringify(campusData, null, 2));
  console.log("🎉 大功告成！所有的點現在都有真實的 3D 海拔高度了！");
}

fetchElevations();