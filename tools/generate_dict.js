const fs = require('fs');

// 1. 讀取你現有的校園圖資 JSON
const rawData = fs.readFileSync('campus_nodes_edges.json');
const data = JSON.parse(rawData);

// 2. 建立一個 Set 來過濾重複的名字 (避免同一個系館有很多節點)
const uniqueNames = new Set();

data.nodes.forEach(node => {
  // 嚴格過濾：必須有 name、不能是空字串、不能是 undefined
  if (node.name && node.name.trim() !== "" && node.name !== "undefined") {
    uniqueNames.add(node.name.trim());
  }
});

// 3. 轉換成 JavaScript 字典格式的字串
let outputString = "const buildingTranslations = {\n";

uniqueNames.forEach(name => {
  // 幫你把格式排版好，英文部分先用 TODO 標記
  outputString += `  "${name}": { "zh": "${name}", "en": "" },\n`;
});

outputString += "};\n";

// 4. 將結果直接存成一個新的 js 檔案
fs.writeFileSync('lang_template.js', outputString);

console.log(`✅ 萃取完成！共找到 ${uniqueNames.size} 個獨立建築物名稱。`);
console.log(`👉 請查看自動生成的 lang_template.js 檔案！`);