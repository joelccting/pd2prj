const translations = {
    en: {
        translation: {
            "language-selector": "Select Language:",
            "start_label": "Start Location:",
            "end_label": "End Location:",
            "algorithm_label": "Algorithm:",
            "find_route_btn": "Find Route"
        }
    },
    zh: {
        translation: {
            "language-selector": "選擇語言：",
            "start_label": "起始位置：",
            "end_label": "終點位置：",
            "algorithm_label": "演算法：",
            "find_route_btn": "尋找路線"
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