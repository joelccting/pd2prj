const translations = {
    en: {
        translation: {
            "language-selector": "Select Language:",
            "start_label": "Start Location:",
            "end_label": "End Location:",
            "algorithm_label": "Algorithm:",
            "find_route_btn": "Find Route",
            "select_a_start_label": "Select a start location",
            "select_an_end_label": "Select an end location",
            "algorithm_select_label": "Choose an algorithm",
            "algorithm_bfs_label": "BFS",
            "algorithm_dfs_label": "DFS",
            "algorithm_dik_label": "Dijkstra's Algorithm"
        }
    },
    zh: {
        translation: {
            "language-selector": "選擇語言：",
            "start_label": "起始位置：",
            "end_label": "終點位置：",
            "algorithm_label": "演算法：",
            "find_route_btn": "尋找路線",
            "select_a_start_label": "選擇一個起始位置",
            "select_an_end_label": "選擇一個終點位置",
            "algorithm_select_label": "選擇一個演算法：",
            "algorithm_bfs_label": "廣度優先走訪",
            "algorithm_dfs_label": "深度優先走訪",
            "algorithm_dik_label": "戴克斯特拉演算法"
        }
    }
};

function applyTranslations(lang) {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang].translation[key]) {
            el.textContent = translations[lang].translation[key];
        }
    });
}

// React to the selector change
const selector = document.getElementById('language-selector');
selector.addEventListener('change', (e) => {
    const lang = e.target.value;
    applyTranslations(lang);
    localStorage.setItem('preferredLang', lang);
});

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    const savedLang = localStorage.getItem('preferredLang') || 'zh';
    selector.value = savedLang;
    applyTranslations(savedLang);
});