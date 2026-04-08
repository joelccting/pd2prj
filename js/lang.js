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
const buildingTranslations = {
  "全家便利商店-學人宿舍店": { "zh": "全家便利商店-學人宿舍店", "en": "FamilyMart - Scholar Dormitory Store" },
  "元氣早餐": { "zh": "元氣早餐", "en": "Yuan Qi Breakfast" },
  "全家便利商店-大吃": { "zh": "全家便利商店-大吃", "en": "FamilyMart - Da Chi Store" },
  "7-Eleven中正大學門市": { "zh": "7-Eleven中正大學門市", "en": "7-Eleven - CCU Store" },
  "全家便利商店-共教": { "zh": "全家便利商店-共教", "en": "FamilyMart - Joint Classroom Building Store" },
  "A-bao": { "zh": "A-bao", "en": "A-bao House" },
  "三米藍": { "zh": "三米藍", "en": "San Mi Lan" },
  "即食樂": { "zh": "即食樂", "en": "Ji Shi Le" },
  "隱客廳": { "zh": "隱客廳", "en": "Hidden Living Room" },
  "8鍋時尚新穎小火鍋": { "zh": "8鍋時尚新穎小火鍋", "en": "8 Pot Hot Pot" },
  "i嘎嗶複合式餐廳": { "zh": "i嘎嗶複合式餐廳", "en": "i-Gabi Restaurant" },
  "全家便利商店-活動中心店": { "zh": "全家便利商店-活動中心店", "en": "FamilyMart - Student Activity Center Store" },
  "品味香快炒": { "zh": "品味香快炒", "en": "Pin Wei Xiang Stir-fry" },
  "花漾廚房": { "zh": "花漾廚房", "en": "Flora Kitchen" },
  "7-Eleven": { "zh": "7-Eleven", "en": "7-Eleven" },
  "萊爾富": { "zh": "萊爾富", "en": "Hi-Life" },
  "神農美食坊": { "zh": "神農美食坊", "en": "Shennong Food Court" },
  "中正快炒": { "zh": "中正快炒", "en": "Zhongzheng Stir-fry" },
  "米六里": { "zh": "米六里", "en": "Mi Liu Li" },
  "大四喜牛肉麵": { "zh": "大四喜牛肉麵", "en": "Da Si Xi Beef Noodle" },
  "ㄎㄎ韓食": { "zh": "ㄎㄎ韓食", "en": "Ke Ke Korean Food" },
  "薩克廚房": { "zh": "薩克廚房", "en": "Zak Kitchen" },
  "牛筋伯爵": { "zh": "牛筋伯爵", "en": "Earl Beef Tendon" },
  "鮮茶道": { "zh": "鮮茶道", "en": "Presotea" },
  "地中海美食": { "zh": "地中海美食", "en": "Mediterranean Food" },
  "Tea's原味": { "zh": "Tea's原味", "en": "Tea's" },
  "晨間廚房": { "zh": "晨間廚房", "en": "Morning Kitchen" },
  "全家便利商店-民雄旺萊店": { "zh": "全家便利商店-民雄旺萊店", "en": "FamilyMart - Minxiong Wanglai Store" },
  "健康牛肉麵": { "zh": "健康牛肉麵", "en": "Healthy Beef Noodle" },
  "鍋道一號": { "zh": "鍋道一號", "en": "Guo Dao No. 1" },
  "123活力早餐屋": { "zh": "123活力早餐屋", "en": "123 Energy Breakfast" },
  "Bubble Z": { "zh": "Bubble Z", "en": "Bubble Z" },
  "瘋beef": { "zh": "瘋beef", "en": "Crazy Beef" },
  "麥香堡早午餐": { "zh": "麥香堡早午餐", "en": "Mai Xiang Bao Brunch" },
  "Yes 厚切雞排": { "zh": "Yes 厚切雞排", "en": "Yes Thick-Cut Chicken Filet" },
  "曉品屋歐式餐飲": { "zh": "曉品屋歐式餐飲", "en": "Xiao Pin Wu European Cuisine" },
  "伊卓島": { "zh": "伊卓島", "en": "Yizhuo Island" },
  "六妹食堂": { "zh": "六妹食堂", "en": "Liu Mei Restaurant" },
  "灶鍋®健康水煮，鍋燒，炒泡麵，鍋物": { "zh": "灶鍋®健康水煮，鍋燒，炒泡麵，鍋物", "en": "Zao Guo Hot Pot" },
  "侯記中式早餐": { "zh": "侯記中式早餐", "en": "Hou's Chinese Breakfast" },
  "豪記滷味": { "zh": "豪記滷味", "en": "Haoji Braised Snacks" },
  "財哥鹹酥雞": { "zh": "財哥鹹酥雞", "en": "Cai Ge Fried Chicken" },
  "東方美早午餐": { "zh": "東方美早午餐", "en": "Dong Fang Mei Brunch" },
  "紅樓極麵": { "zh": "紅樓極麵", "en": "Red House Noodles" },
  "黃媽媽的店": { "zh": "黃媽媽的店", "en": "Mother Huang's Shop" },
  "丼飽處": { "zh": "丼飽處", "en": "Donburi Restaurant" },
  "泰麻吉": { "zh": "泰麻吉", "en": "Thai Machi" },
  "古城麻辣燙": { "zh": "古城麻辣燙", "en": "Gu Cheng Spicy Hot Pot" },
  "豐正食堂": { "zh": "豐正食堂", "en": "Feng Zheng Restaurant" },
  "小羚火鍋": { "zh": "小羚火鍋", "en": "Xiao Ling Hot Pot" },
  "傻師傅神農店": { "zh": "傻師傅神農店", "en": "Sha Shi Fu - Shennong Store" },
  "榕樹下": { "zh": "榕樹下", "en": "Under the Banyan Tree" },
  "嘉農小館": { "zh": "嘉農小館", "en": "Jia Nong Restaurant" },
  "鹿初Brunch": { "zh": "鹿初Brunch", "en": "Lu Chu Brunch" },
  "俗頭": { "zh": "俗頭", "en": "Su Tou" },
  "阿梅簡餐便當": { "zh": "阿梅簡餐便當", "en": "A-Mei Bento" },
  "二口食堂": { "zh": "二口食堂", "en": "Er Kou Restaurant" },
  "a咖牛排": { "zh": "a咖牛排", "en": "A-Ka Steak" },
  "果然製物所": { "zh": "果然製物所", "en": "Guoran Studio" },
  "蝦皮店到店": { "zh": "蝦皮店到店", "en": "Shopee Xpress" },
  "蔬香是家": { "zh": "蔬香是家", "en": "Veggie Home" },
  "Simple Fit 簡單瘦 健康餐": { "zh": "Simple Fit 簡單瘦 健康餐", "en": "Simple Fit Healthy Diet" },
  "湖畔咖啡": { "zh": "湖畔咖啡", "en": "Lakeside Coffee" },
  "艾絲": { "zh": "艾絲", "en": "Ice" },
  "行政大樓": { "zh": "行政大樓", "en": "Administration Building" },
  "社會科學院": { "zh": "社會科學院", "en": "College of Social Sciences" },
  "共同教室": { "zh": "共同教室", "en": "Joint Classroom Building" },
  "工學院(一)": { "zh": "工學院(一)", "en": "College of Engineering I" },
  "禮堂": { "zh": "禮堂", "en": "Auditorium" },
  "學生活動中心": { "zh": "學生活動中心", "en": "Student Activity Center" },
  "管理學院": { "zh": "管理學院", "en": "College of Management" },
  "工學院(二)": { "zh": "工學院(二)", "en": "College of Engineering II" },
  "法學院": { "zh": "法學院", "en": "College of Law" },
  "教育學院": { "zh": "教育學院", "en": "College of Education" },
  "教育學院二館": { "zh": "教育學院二館", "en": "College of Education II" },
  "數學系": { "zh": "數學系", "en": "Department of Mathematics" },
  "理學院二館": { "zh": "理學院二館", "en": "College of Science II" },
  "體育館": { "zh": "體育館", "en": "Gymnasium" },
  "圖書資訊大樓": { "zh": "圖書資訊大樓", "en": "Library and Information Building" },
  "致遠樓": { "zh": "致遠樓", "en": "Zhiyuan Building" },
  "生活商圈": { "zh": "生活商圈", "en": "Commercial District" },
  "員工學生福利社": { "zh": "員工學生福利社", "en": "Staff and Student Cooperative" },
  "大學部宿舍E棟": { "zh": "大學部宿舍E棟", "en": "Undergraduate Dormitory E" },
  "大學部宿舍C棟": { "zh": "大學部宿舍C棟", "en": "Undergraduate Dormitory C" },
  "大學部宿舍D棟": { "zh": "大學部宿舍D棟", "en": "Undergraduate Dormitory D" },
  "大學部宿舍B棟": { "zh": "大學部宿舍B棟", "en": "Undergraduate Dormitory B" },
  "大學部宿舍A棟": { "zh": "大學部宿舍A棟", "en": "Undergraduate Dormitory A" },
  "伯爵": { "zh": "伯爵", "en": "Earl" },
  "咖啡王國": { "zh": "咖啡王國", "en": "Coffee Kingdom" },
  "研究生宿舍A棟": { "zh": "研究生宿舍A棟", "en": "Graduate Dormitory A" },
  "研究生宿舍B棟": { "zh": "研究生宿舍B棟", "en": "Graduate Dormitory B" },
  "研究生宿舍E棟": { "zh": "研究生宿舍E棟", "en": "Graduate Dormitory E" },
  "研究生宿舍C棟": { "zh": "研究生宿舍C棟", "en": "Graduate Dormitory C" },
  "研究生宿舍D棟": { "zh": "研究生宿舍D棟", "en": "Graduate Dormitory D" },
  "實習工廠": { "zh": "實習工廠", "en": "Internship Factory" },
  "陶潛": { "zh": "陶潛", "en": "Tao Qian" },
  "鳳凰軒": { "zh": "鳳凰軒", "en": "Phoenix Pavilion" },
  "中正大學變電所(C/S)": { "zh": "中正大學變電所(C/S)", "en": "CCU Substation (C/S)" },
  "創新大樓": { "zh": "創新大樓", "en": "Innovation Building" },
  "現代首席": { "zh": "現代首席", "en": "Modern Chief" },
  "正心學院": { "zh": "正心學院", "en": "Zhengxin Academy" },
  "康乃爾學院": { "zh": "康乃爾學院", "en": "Cornell Academy" },
  "京采": { "zh": "京采", "en": "Jing Cai" },
  "墨香苑": { "zh": "墨香苑", "en": "Moxiang Yuan" },
  "登林學苑": { "zh": "登林學苑", "en": "Denglin Academy" },
  "集智苑": { "zh": "集智苑", "en": "Jizhi Yuan" },
  "陶居": { "zh": "陶居", "en": "Tao Ju" },
  "凱格鹿三期": { "zh": "凱格鹿三期", "en": "Kaigelu Phase III" },
  "木菊苑": { "zh": "木菊苑", "en": "Muju Yuan" },
  "書香門第": { "zh": "書香門第", "en": "Scholar's Mansion" },
  "常春藤": { "zh": "常春藤", "en": "Ivy League" },
  "中正會館": { "zh": "中正會館", "en": "Zhongzheng Hall" },
  "鼎泰": { "zh": "鼎泰", "en": "Dingtai" },
  "紫荊書苑": { "zh": "紫荊書苑", "en": "Zijing Academy" },
  "維多利亞學苑": { "zh": "維多利亞學苑", "en": "Victoria Academy" },
  "哈佛學苑": { "zh": "哈佛學苑", "en": "Harvard Academy" },
  "凱格鹿二期": { "zh": "凱格鹿二期", "en": "Kaigelu Phase II" },
  "牛津學苑": { "zh": "牛津學苑", "en": "Oxford Academy" },
  "康乃爾學苑": { "zh": "康乃爾學苑", "en": "Cornell Academy" },
  "苗圃": { "zh": "苗圃", "en": "Plant Nursery" },
  "動物實驗室": { "zh": "動物實驗室", "en": "Animal Laboratory" },
  "食凡捲餅": { "zh": "食凡捲餅", "en": "Shi Fan Burrito" },
  "123活力早餐店": { "zh": "123活力早餐店", "en": "123 Energy Breakfast Store" },
  "地球與環境科學系 地震館": { "zh": "地球與環境科學系 地震館", "en": "Dept. of Earth and Environmental Sciences - Seismology Building" },
  "物理系": { "zh": "物理系", "en": "Department of Physics" },
  "金桔學苑": { "zh": "金桔學苑", "en": "Kumquat Academy" },
  "凱格鹿旗艦會館": { "zh": "凱格鹿旗艦會館", "en": "Kaigelu Flagship Hall" },
  "靈糧堂": { "zh": "靈糧堂", "en": "Bread of Life Christian Church" },
  "深白舍": { "zh": "深白舍", "en": "Shenbai House" },
  "橙舍": { "zh": "橙舍", "en": "Orange House" },
  "三豐學苑": { "zh": "三豐學苑", "en": "Sanfeng Academy" },
  "三豐學苑(二期)": { "zh": "三豐學苑(二期)", "en": "Sanfeng Academy Phase II" },
  "柏克萊": { "zh": "柏克萊", "en": "Berkeley" },
  "彬彬": { "zh": "彬彬", "en": "Binbin" },
  "夏都": { "zh": "夏都", "en": "Chateau" },
  "管理學院二館": { "zh": "管理學院二館", "en": "College of Management II" },
  "節能宿舍熱水設施": { "zh": "節能宿舍熱水設施", "en": "Energy-Saving Dormitory Hot Water Facility" },
  "三興村社區活動中心": { "zh": "三興村社區活動中心", "en": "Sanxing Village Community Center" },
  "中正大學環安中心": { "zh": "中正大學環安中心", "en": "CCU Center for Environmental Safety and Health" },
  "文學院": { "zh": "文學院", "en": "College of Liberal Arts" },
  "三興國小": { "zh": "三興國小", "en": "Sanxing Elementary School" },
  "納米運動休閒園區": { "zh": "納米運動休閒園區", "en": "Nami Sports and Leisure Park" },
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

function updateDropdownLanguage(currentLang) {
  const startSelect = document.getElementById("start");
  const endSelect = document.getElementById("end");

  if (!startSelect || !endSelect) return;

  // 更新下拉選單的選項 (只處理真正的大樓)
  function translateOptions(selectElement) {
    Array.from(selectElement.options).forEach(option => {
      // 1. 預設的防呆選項 (value 是空的) 已經有 data-i18n 會處理，這裡直接跳過！
      if (option.value === "") {
        return;
      }
      
      // 2. 處理真實的大樓選項
      const translation = buildingTranslations[option.value];
      if (translation && translation[currentLang]) {
        // 如果字典裡有這個大樓的翻譯，就換成該語言的顯示文字
        option.text = translation[currentLang];
      } else {
        // 找不到翻譯就保留原名
        option.text = option.value; 
      }
    });
  }

  // 執行翻譯 (不用再傳遞 "start" 或 "end" 了)
  translateOptions(startSelect);
  translateOptions(endSelect);
}