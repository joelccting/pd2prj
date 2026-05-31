/**
 * demo_hotkey.js
 * ──────────────────────────────────────────────────────────────────
 * 按下 Ctrl+Shift+V → 根據當前面板設定自動填入 DEMO 起終點。
 * 同一模式有多組場景時，彈出選單讓使用者挑選。
 *
 * 使用方式：在 index.html 最底部（所有 script 之後）加入：
 *   <script src="js/demo_hotkey.js"></script>
 *
 * ⚠️  此檔案必須在 app.js (module) 載入完成後執行，
 *     因為它需要存取 window.addWaypointProgrammatic（見下方說明）。
 *
 * 需要在 app.js 裡把 addBtn.click() 的邏輯包成一個可被外部呼叫的函式，
 * 並掛到 window.addWaypointProgrammatic。
 * （本檔案會自己 polyfill 一個降級版本，若 app.js 未匯出也能運作。）
 * ──────────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  // ════════════════════════════════════════════════════════════════
  // § 1  所有 DEMO 場景定義
  //      每個場景對應 PDF 腳本的一個 DEMO 編號。
  //
  //  cruiseMode : 'single' | 'ordered' | 'optimized'
  //  routeWeight: 'shortest' | 'least_turns' | 'least_climbing' | 'shade'
  //  transport  : 'walk' | 'bike' | 'ebike' | 'motorcycle' | 'car'
  //  start      : string（地點中文名）
  //  waypoints  : string[]（依序目的地，single 只需一個）
  //  shadowLayer: true → 自動勾選即時陰影 checkbox
  // ════════════════════════════════════════════════════════════════
  const DEMO_SCENES = [
    // ── 一、NAVIGATION MODE ── 最短路徑 ──────────────────────────
    {
      id: 1,
      label: 'DEMO #1｜最短路徑 / 步行｜宿舍E棟 → 共同教室大樓',
      cruiseMode: 'single',
      routeWeight: 'shortest',
      transport: 'walk',
      start: '大學部宿舍E棟',
      waypoints: ['共同教室大樓'],
    },
    {
      id: 2,
      label: 'DEMO #2｜最短路徑 / E-bike｜宿舍E棟 → 共同教室大樓',
      cruiseMode: 'single',
      routeWeight: 'shortest',
      transport: 'ebike',
      start: '大學部宿舍E棟',
      waypoints: ['共同教室大樓'],
    },
    {
      id: 3,
      label: 'DEMO #3｜最短路徑 / 步行｜共同教室大樓 → 嘉農小館',
      cruiseMode: 'single',
      routeWeight: 'shortest',
      transport: 'walk',
      start: '共同教室大樓',
      waypoints: ['嘉農小館'],
    },
    {
      id: 4,
      label: 'DEMO #4｜最短路徑 / 腳踏車｜共同教室大樓 → 嘉農小館',
      cruiseMode: 'single',
      routeWeight: 'shortest',
      transport: 'bike',
      start: '共同教室大樓',
      waypoints: ['嘉農小館'],
    },

    // ── 二、依順序巡航 ────────────────────────────────────────────
    {
      id: 5,
      label: 'DEMO #5｜順序巡航 / 步行｜宿舍E棟→教室→創新→體育館→海南雞飯',
      cruiseMode: 'ordered',
      routeWeight: 'shortest',
      transport: 'walk',
      start: '大學部宿舍E棟',
      waypoints: ['共同教室大樓', '創新大樓', '中正大學體育館', '中正海南雞飯'],
    },
    {
      id: 6,
      label: 'DEMO #6｜順序巡航 / 汽車｜宿舍E棟→教室→創新→體育館→海南雞飯',
      cruiseMode: 'ordered',
      routeWeight: 'shortest',
      transport: 'car',
      start: '大學部宿舍E棟',
      waypoints: ['共同教室大樓', '創新大樓', '中正大學體育館', '中正海南雞飯'],
    },
    {
      id: 7,
      label: 'DEMO #7｜順序巡航 / 步行｜宿舍E棟→創新→海南雞飯→教室→體育館',
      cruiseMode: 'ordered',
      routeWeight: 'shortest',
      transport: 'walk',
      start: '大學部宿舍E棟',
      waypoints: ['創新大樓', '中正海南雞飯', '共同教室大樓', '中正大學體育館'],
    },

    // ── 三、TSP ──────────────────────────────────────────────────
    {
      id: 8,
      label: 'DEMO #8｜TSP / 步行｜工學院二館→理學院→社科院→管理二館→工學院→法學院',
      cruiseMode: 'optimized',
      routeWeight: 'shortest',
      transport: 'walk',
      start: '工學院二館',
      waypoints: ['理學院-地震博物館', '社會科學院', '管理學院二館', '工學院', '法學院'],
    },
    {
      id: 9,
      label: 'DEMO #9｜TSP / 步行｜宿舍E棟→創新→海南雞飯→教室→體育館',
      cruiseMode: 'optimized',
      routeWeight: 'shortest',
      transport: 'walk',
      start: '大學部宿舍E棟',
      waypoints: ['創新大樓', '中正海南雞飯', '共同教室大樓', '中正大學體育館'],
    },

    // ── 四、ROUTE PREFERENCES ─────────────────────────────────────
    {
      id: 10,
      label: 'DEMO #10｜最少轉彎 / 步行｜宿舍機車停車場 → 行政大樓',
      cruiseMode: 'single',
      routeWeight: 'least_turns',
      transport: 'walk',
      start: '大學部宿舍機車停車場',
      waypoints: ['行政大樓'],
    },
    {
      id: 11,
      label: 'DEMO #11｜最平坦 / 步行｜宿舍A棟 → 全家便利商店-學人宿舍店',
      cruiseMode: 'single',
      routeWeight: 'least_climbing',
      transport: 'walk',
      start: '大學部宿舍A棟',
      waypoints: ['全家便利商店-學人宿舍店'],
    },
    {
      id: 12,
      label: 'DEMO #12｜林蔭模式 + 即時陰影｜體育館 → 管理學院二館',
      cruiseMode: 'single',
      routeWeight: 'shade',
      transport: 'walk',
      start: '中正大學體育館',
      waypoints: ['管理學院二館'],
      shadowLayer: true,
    },
  ];

  // ════════════════════════════════════════════════════════════════
  // § 2  判斷「當前模式」→ 過濾出相關場景
  // ════════════════════════════════════════════════════════════════
  function getCurrentModeKey() {
    const cruise   = document.getElementById('cruise-mode')?.value   || 'single';
    const weight   = document.getElementById('route-weight')?.value  || 'shortest';
    const transport= document.getElementById('transport-mode')?.value|| 'walk';
    return `${cruise}|${weight}|${transport}`;
  }

  function getScenesForCurrentMode() {
    const cruise    = document.getElementById('cruise-mode')?.value   || 'single';
    const weight    = document.getElementById('route-weight')?.value  || 'shortest';
    const transport = document.getElementById('transport-mode')?.value|| 'walk';

    // 先嘗試三個維度全匹配
    let matches = DEMO_SCENES.filter(
      s => s.cruiseMode === cruise && s.routeWeight === weight && s.transport === transport
    );

    // 退一步：只匹配 cruiseMode + routeWeight（忽略交通工具）
    if (matches.length === 0) {
      matches = DEMO_SCENES.filter(
        s => s.cruiseMode === cruise && s.routeWeight === weight
      );
    }

    // 再退一步：只匹配 cruiseMode
    if (matches.length === 0) {
      matches = DEMO_SCENES.filter(s => s.cruiseMode === cruise);
    }

    return matches;
  }

  // ════════════════════════════════════════════════════════════════
  // § 3  實際填表邏輯
  // ════════════════════════════════════════════════════════════════

  /** 填入單一搜尋框（search input + hidden select）的值 */
  function fillLocationField(searchInputId, selectId, locationName) {
    const input = document.getElementById(searchInputId);
    const sel   = document.getElementById(selectId);
    if (!input) return;

    input.value = locationName;

    // 讓 select 隱藏（UI 邏輯一致）
    if (sel) {
      sel.value = locationName;
      sel.style.display = 'none';
    }
  }

  /**
   * 確保 waypoint-container 裡有 n 個 .waypoint-item，
   * 多的刪除、少的用 addBtn.click() 補上。
   */
  function ensureWaypointCount(n) {
    const container = document.getElementById('waypoint-container');
    if (!container) return;

    // 先清除所有非第一個 waypoint
    const items = Array.from(container.querySelectorAll('.waypoint-item'));
    // 保留第一個，其餘刪掉
    for (let i = 1; i < items.length; i++) items[i].remove();

    // 補到 n 個
    const addBtn = document.getElementById('add-waypoint');
    for (let i = 1; i < n; i++) {
      if (addBtn) addBtn.click();
    }
  }

  /** 填入整個場景到 UI */
  function applyScene(scene) {
    // 1. 設定巡航策略
    const cruiseSel = document.getElementById('cruise-mode');
    if (cruiseSel) {
      cruiseSel.value = scene.cruiseMode;
      cruiseSel.dispatchEvent(new Event('change'));
    }

    // 2. 設定路線偏好
    const weightSel = document.getElementById('route-weight');
    if (weightSel) weightSel.value = scene.routeWeight;

    // 3. 設定交通工具
    const transportSel = document.getElementById('transport-mode');
    if (transportSel) transportSel.value = scene.transport;

    // 4. 填入起點
    fillLocationField('start-search', 'start', scene.start);

    // 5. 確保 waypoint 數量正確
    ensureWaypointCount(scene.waypoints.length);

    // 稍微延遲，等 DOM 更新後填入 waypoints
    setTimeout(() => {
      const container = document.getElementById('waypoint-container');
      if (!container) return;
      const items = container.querySelectorAll('.waypoint-item');

      scene.waypoints.forEach((dest, idx) => {
        const item   = items[idx];
        if (!item) return;
        const searchEl = item.querySelector('.waypoint-search');
        const selectEl = item.querySelector('.waypoint-select');
        if (searchEl) searchEl.value = dest;
        if (selectEl) { selectEl.value = dest; selectEl.style.display = 'none'; }
      });

      // 6. 處理即時陰影 checkbox
      const shadowCb = document.getElementById('toggle-realtime-shadow');
      if (shadowCb) {
        const shouldCheck = !!scene.shadowLayer;
        if (shadowCb.checked !== shouldCheck) {
          shadowCb.click(); // 觸發既有的 change 事件
        }
      }

      showToast(scene);
    }, 120);
  }

  // ════════════════════════════════════════════════════════════════
  // § 4  Toast 提示
  // ════════════════════════════════════════════════════════════════
  function showToast(scene) {
    const existing = document.getElementById('demo-hotkey-toast');
    if (existing) existing.remove();

    const modeMap = {
      single:    '單一目的地',
      ordered:   '依順序巡航',
      optimized: 'TSP 最佳順序',
    };
    const weightMap = {
      shortest:      '距離最短',
      least_turns:   '最少轉彎',
      least_climbing:'最平坦',
      shade:         '林蔭模式',
    };
    const transportMap = {
      walk: '🚶步行', bike: '🚲腳踏車', ebike: '⚡電動車',
      motorcycle: '🛵機車', car: '🚗汽車',
    };

    const waypointsText = scene.waypoints.join(' → ');
    const html = `
      <div id="demo-hotkey-toast" style="
        position: fixed;
        bottom: 120px;
        right: 24px;
        z-index: 99999;
        background: linear-gradient(135deg, #1a237e, #283593);
        color: #fff;
        padding: 14px 18px;
        border-radius: 12px;
        box-shadow: 0 6px 20px rgba(0,0,0,0.45);
        font-family: 'Noto Sans TC', sans-serif;
        font-size: 13px;
        max-width: 320px;
        line-height: 1.7;
        animation: demoToastIn 0.25s ease;
      ">
        <div style="font-weight:700; font-size:15px; margin-bottom:6px;">
          ✅ DEMO #${scene.id} 已填入
        </div>
        <div>🗺️ ${modeMap[scene.cruiseMode]} ／ ${weightMap[scene.routeWeight]}</div>
        <div>${transportMap[scene.transport]}</div>
        <div style="margin-top:6px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.2);">
          <span style="opacity:.75">起</span> ${scene.start}
        </div>
        <div>
          <span style="opacity:.75">終</span> ${waypointsText}
        </div>
        ${scene.shadowLayer ? '<div style="margin-top:4px; color:#80cbc4;">🕶️ 即時陰影已開啟</div>' : ''}
      </div>
    `;

    // 插入 style（只插一次）
    if (!document.getElementById('demo-hotkey-style')) {
      const style = document.createElement('style');
      style.id = 'demo-hotkey-style';
      style.textContent = `
        @keyframes demoToastIn {
          from { opacity:0; transform: translateY(12px); }
          to   { opacity:1; transform: translateY(0); }
        }
        @keyframes demoToastOut {
          from { opacity:1; transform: translateY(0); }
          to   { opacity:0; transform: translateY(12px); }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.insertAdjacentHTML('beforeend', html);
    const toast = document.getElementById('demo-hotkey-toast');

    // 3.5 秒後自動消失
    setTimeout(() => {
      if (toast) {
        toast.style.animation = 'demoToastOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
      }
    }, 3500);
  }

  // ════════════════════════════════════════════════════════════════
  // § 5  選擇器 Modal（同模式多組場景時彈出）
  // ════════════════════════════════════════════════════════════════
  function showScenePicker(scenes) {
    const existing = document.getElementById('demo-scene-picker');
    if (existing) existing.remove();

    const itemsHtml = scenes.map((s, i) => `
      <button
        data-idx="${i}"
        style="
          display: block;
          width: 100%;
          text-align: left;
          background: #fff;
          border: 1.5px solid #c5cae9;
          border-radius: 8px;
          padding: 10px 14px;
          margin-bottom: 8px;
          cursor: pointer;
          font-size: 13px;
          font-family: 'Noto Sans TC', sans-serif;
          transition: background 0.15s, border-color 0.15s;
          color: #1a237e;
          font-weight: 500;
        "
        onmouseover="this.style.background='#e8eaf6'; this.style.borderColor='#3949ab';"
        onmouseout="this.style.background='#fff'; this.style.borderColor='#c5cae9';"
      >
        ${s.label}
      </button>
    `).join('');

    const modal = document.createElement('div');
    modal.id = 'demo-scene-picker';
    modal.innerHTML = `
      <div style="
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.45);
        z-index: 99998;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: demoToastIn 0.2s ease;
      ">
        <div style="
          background: #f5f5f5;
          border-radius: 14px;
          padding: 22px 24px;
          max-width: 480px;
          width: 90vw;
          box-shadow: 0 12px 40px rgba(0,0,0,0.35);
          font-family: 'Noto Sans TC', sans-serif;
        ">
          <div style="
            font-size: 16px;
            font-weight: 700;
            color: #1a237e;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
          ">
            🎬 選擇 DEMO 場景
            <span style="font-size:12px; font-weight:400; color:#555; margin-left:auto;">
              Ctrl+Shift+V
            </span>
          </div>
          <div id="demo-scene-list">
            ${itemsHtml}
          </div>
          <button id="demo-picker-cancel" style="
            width: 100%;
            margin-top: 4px;
            padding: 8px;
            border: none;
            background: transparent;
            color: #888;
            cursor: pointer;
            font-size: 13px;
            border-radius: 6px;
          ">取消</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // 點選場景
    modal.querySelectorAll('#demo-scene-list button').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        modal.remove();
        applyScene(scenes[idx]);
      });
    });

    // 取消
    modal.querySelector('#demo-picker-cancel').addEventListener('click', () => modal.remove());

    // 點遮罩關閉
    modal.querySelector('div').addEventListener('click', e => {
      if (e.target === e.currentTarget) modal.remove();
    });

    // ESC 關閉
    const escHandler = (e) => {
      if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', escHandler); }
    };
    document.addEventListener('keydown', escHandler);
  }

  // ════════════════════════════════════════════════════════════════
  // § 6  快捷鍵監聽  Ctrl + Shift + V
  // ════════════════════════════════════════════════════════════════
  document.addEventListener('keydown', function (e) {
    // Windows/Linux: ctrlKey, macOS: metaKey（Command）皆支援
    const ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl || !e.shiftKey || e.key.toUpperCase() !== 'V') return;

    e.preventDefault(); // 避免觸發瀏覽器預設貼上行為

    const matches = getScenesForCurrentMode();

    if (matches.length === 0) {
      // 沒找到任何場景 → 顯示全部讓使用者選
      showScenePicker(DEMO_SCENES);
    } else if (matches.length === 1) {
      // 恰好一個 → 直接填入
      applyScene(matches[0]);
    } else {
      // 多個 → 彈出選擇器
      showScenePicker(matches);
    }
  });

  console.log(
    '%c[Demo Hotkey] 已載入 ✅  按 Ctrl+Shift+V 自動填入 DEMO 場景',
    'background:#1a237e; color:#fff; padding:4px 10px; border-radius:4px;'
  );
})();