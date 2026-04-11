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
  "全家便利商店-民雄神農店": { "zh": "全家便利商店-民雄神農店", "en": "FamilyMart - Minxiong Shennong Store" },
  "7-ELEVEN 中正大學門市": { "zh": "7-ELEVEN 中正大學門市", "en": "7-ELEVEN - CCU Store" },
  "全家便利商店-共教店": { "zh": "全家便利商店-共教店", "en": "FamilyMart - Joint Classroom Building Store" },
  "A-bao": { "zh": "A-bao", "en": "A-bao House" },
  "三米藍": { "zh": "三米藍", "en": "San Mi Lan" },
  "即食樂": { "zh": "即食樂", "en": "Ji Shi Le" },
  "8鍋時尚新穎小火鍋": { "zh": "8鍋時尚新穎小火鍋", "en": "8 Pot Hot Pot" },
  "i嘎嗶複合式餐廳": { "zh": "i嘎嗶複合式餐廳", "en": "i-Gabi Restaurant" },
  "全家便利商店-活動中心店": { "zh": "全家便利商店-活動中心店", "en": "FamilyMart - Student Activity Center Store" },
  "品味香快炒": { "zh": "品味香快炒", "en": "Pin Wei Xiang Stir-fry" },
  "花漾廚房": { "zh": "花漾廚房", "en": "Flora Kitchen" },
  "7-ELEVEN 溫莎門市": { "zh": "7-ELEVEN 溫莎門市", "en": "7-ELEVEN - Windsor Store" },
  "萊爾富": { "zh": "萊爾富", "en": "Hi-Life" },
  "神農美食坊": { "zh": "神農美食坊", "en": "Shennong Food Court" },
  "中正快炒": { "zh": "中正快炒", "en": "Zhongzheng Stir-fry" },
  "米六里": { "zh": "米六里", "en": "Mi Liu Li" },
  "ㄎㄎ韓食": { "zh": "ㄎㄎ韓食", "en": "Ke Ke Korean Food" },
  "薩克廚房": { "zh": "薩克廚房", "en": "Zak Kitchen" },
  "鮮茶道": { "zh": "鮮茶道", "en": "Presotea" },
  "地中海美食": { "zh": "地中海美食", "en": "Mediterranean Food" },
  "Tea's原味": { "zh": "Tea's原味", "en": "Tea's" },
  "晨間廚房": { "zh": "晨間廚房", "en": "Morning Kitchen" },
  "全家便利商店-民雄旺萊店": { "zh": "全家便利商店-民雄旺萊店", "en": "FamilyMart - Minxiong Wanglai Store" },
  "鍋道一號": { "zh": "鍋道一號", "en": "Guo Dao No. 1" },
  "123活力早餐屋": { "zh": "123活力早餐屋", "en": "123 Energy Breakfast" },
  "Bubble Z": { "zh": "Bubble Z", "en": "Bubble Z" },
  "瘋beef": { "zh": "瘋beef", "en": "Crazy Beef" },
  "麥香堡早午餐": { "zh": "麥香堡早午餐", "en": "Mai Xiang Bao Brunch" },
  "順傑電動車": { "zh": "順傑電動車", "en": "Shunjie Electric Vehicles" },
  "Yes 厚切雞排": { "zh": "Yes 厚切雞排", "en": "Yes Thick-Cut Chicken Filet" },
  "伊卓島": { "zh": "伊卓島", "en": "Yizhuo Island" },
  "六妹食堂": { "zh": "六妹食堂", "en": "Liu Mei Restaurant" },
  "灶鍋®健康水煮，鍋燒，炒泡麵，鍋物": { "zh": "灶鍋®健康水煮，鍋燒，炒泡麵，鍋物", "en": "Zao Guo Healthy Pot" },
  "侯記中式早餐": { "zh": "侯記中式早餐", "en": "Hou's Chinese Breakfast" },
  "豪記滷味-升學路": { "zh": "豪記滷味-升學路", "en": "Haoji Braised Snacks - Higher Education Road" },
  "財哥鹹酥雞": { "zh": "財哥鹹酥雞", "en": "Cai Ge Fried Chicken" },
  "丼飽處": { "zh": "丼飽處", "en": "Donburi Restaurant" },
  "味芳早餐": { "zh": "味芳早餐", "en": "Wei Fang Breakfast" },
  "泰麻吉": { "zh": "泰麻吉", "en": "Thai Machi" },
  "小羚火鍋": { "zh": "小羚火鍋", "en": "Xiao Ling Hot Pot" },
  "全方味便當、咖哩飯、炒泡麵": { "zh": "全方味便當、咖哩飯、炒泡麵", "en": "Quan Fang Wei Bento" },
  "阿梅簡餐便當": { "zh": "阿梅簡餐便當", "en": "A-Mei Bento" },
  "二口食堂": { "zh": "二口食堂", "en": "Er Kou Restaurant" },
  "a咖牛排": { "zh": "a咖牛排", "en": "A-Ka Steak" },
  "果然製物所": { "zh": "果然製物所", "en": "Guoran Studio" },
  "蝦皮店到店": { "zh": "蝦皮店到店", "en": "Shopee Xpress" },
  "Simple Fit 簡單瘦健康餐": { "zh": "Simple Fit 簡單瘦健康餐", "en": "Simple Fit Healthy Diet" },
  "湖畔咖啡": { "zh": "湖畔咖啡", "en": "Lakeside Coffee" },
  "艾絲": { "zh": "艾絲", "en": "Ice" },
  "行政大樓": { "zh": "行政大樓", "en": "Administration Building" },
  "社會科學院": { "zh": "社會科學院", "en": "College of Social Sciences" },
  "共同教室大樓": { "zh": "共同教室大樓", "en": "Joint Classroom Building" },
  "工學院一館": { "zh": "工學院一館", "en": "College of Engineering I" },
  "禮堂": { "zh": "禮堂", "en": "Auditorium" },
  "學生活動中心": { "zh": "學生活動中心", "en": "Student Activity Center" },
  "管理學院": { "zh": "管理學院", "en": "College of Management" },
  "工學院二館": { "zh": "工學院二館", "en": "College of Engineering II" },
  "法學院": { "zh": "法學院", "en": "College of Law" },
  "教育學院": { "zh": "教育學院", "en": "College of Education" },
  "教育學院二館": { "zh": "教育學院二館", "en": "College of Education II" },
  "數學系": { "zh": "數學系", "en": "Department of Mathematics" },
  "理學院二館": { "zh": "理學院二館", "en": "College of Science II" },
  "中正大學體育館": { "zh": "中正大學體育館", "en": "CCU Gymnasium" },
  "圖書資訊大樓": { "zh": "圖書資訊大樓", "en": "Library and Information Building" },
  "致遠樓": { "zh": "致遠樓", "en": "Zhiyuan Building" },
  "生活商圈": { "zh": "生活商圈", "en": "Commercial District" },
  "員工學生福利社": { "zh": "員工學生福利社", "en": "Staff and Student Cooperative" },
  "大學部宿舍E棟": { "zh": "大學部宿舍E棟", "en": "Undergraduate Dormitory E" },
  "大學部宿舍C棟": { "zh": "大學部宿舍C棟", "en": "Undergraduate Dormitory C" },
  "大學部宿舍D棟": { "zh": "大學部宿舍D棟", "en": "Undergraduate Dormitory D" },
  "大學部宿舍B棟": { "zh": "大學部宿舍B棟", "en": "Undergraduate Dormitory B" },
  "大學部宿舍A棟": { "zh": "大學部宿舍A棟", "en": "Undergraduate Dormitory A" },
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
  "凱格鹿三期": { "zh": "凱格鹿三期", "en": "Kaigelu Phase III" },
  "集智苑": { "zh": "集智苑", "en": "Jizhi Yuan" },
  "陶居": { "zh": "陶居", "en": "Tao Ju" },
  "木菊苑": { "zh": "木菊苑", "en": "Muju Yuan" },
  "書香門第": { "zh": "書香門第", "en": "Scholar's Mansion" },
  "維多利亞學苑": { "zh": "維多利亞學苑", "en": "Victoria Academy" },
  "哈佛學苑": { "zh": "哈佛學苑", "en": "Harvard Academy" },
  "凱格鹿二期": { "zh": "凱格鹿二期", "en": "Kaigelu Phase II" },
  "牛津學苑": { "zh": "牛津學苑", "en": "Oxford Academy" },
  "康乃爾學苑": { "zh": "康乃爾學苑", "en": "Cornell Academy" },
  "苗圃": { "zh": "苗圃", "en": "Plant Nursery" },
  "動物實驗室": { "zh": "動物實驗室", "en": "Animal Laboratory" },
  "食凡捲餅": { "zh": "食凡捲餅", "en": "Shi Fan Burrito" },
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
  "中正駕訓班": { "zh": "中正駕訓班", "en": "Zhongzheng Driving School" },
  "廣場公園": { "zh": "廣場公園", "en": "Plaza Park" },
  "登林學苑": { "zh": "登林學苑", "en": "Denglin Academy" },
  "鼎泰": { "zh": "鼎泰", "en": "Dingtai" },
  "紫荊書苑": { "zh": "紫荊書苑", "en": "Zijing Academy" },
  "牛筋伯爵": { "zh": "牛筋伯爵", "en": "Earl Beef Tendon" },
  "中正大學大門機車停車場": { "zh": "中正大學大門機車停車場", "en": "CCU Main Gate Scooter Parking" },
  "大學部宿舍機車停車場": { "zh": "大學部宿舍機車停車場", "en": "Undergraduate Dormitory Scooter Parking" },
  "匯幸福二期": { "zh": "匯幸福二期", "en": "Hui Xingfu Phase II" },
  "學生會館": { "zh": "學生會館", "en": "Student Hall" },
  "木菊苑二期": { "zh": "木菊苑二期", "en": "Muju Yuan Phase II" },
  "天晴": { "zh": "天晴", "en": "Tian Qing" },
  "淡如菊": { "zh": "淡如菊", "en": "Dan Ru Ju" },
  "21金小火鍋": { "zh": "21金小火鍋", "en": "21 Jin Hot Pot" },
  "Just Eat Brunch": { "zh": "Just Eat Brunch", "en": "Just Eat Brunch" },
  "布格早午餐": { "zh": "布格早午餐", "en": "Burger Brunch" },
  "博多屋台拉麵": { "zh": "博多屋台拉麵", "en": "Hakata Yatai Ramen" },
  "夏豔鳳翔會館": { "zh": "夏豔鳳翔會館", "en": "Xiayan Fengxiang Hall" },
  "劍橋世紀": { "zh": "劍橋世紀", "en": "Cambridge Century" },
  "三興村陳厝寮-大樹下簡餐便當": { "zh": "三興村陳厝寮-大樹下簡餐便當", "en": "Under the Tree Bento - Sanxing Village" },
  "心遠居": { "zh": "心遠居", "en": "Xin Yuan Ju" },
  "琪琪健康舖": { "zh": "琪琪健康舖", "en": "Qi Qi Health Shop" },
  "阿姨早餐": { "zh": "阿姨早餐", "en": "Auntie's Breakfast" },
  "三興村陳厝寮-轉角早餐店": { "zh": "三興村陳厝寮-轉角早餐店", "en": "Corner Breakfast - Sanxing Village" },
  "大四喜牛肉麵": { "zh": "大四喜牛肉麵", "en": "Da Si Xi Beef Noodle" },
  "諾貝爾學院": { "zh": "諾貝爾學院", "en": "Nobel Academy" },
  "常春藤學院": { "zh": "常春藤學院", "en": "Ivy League Academy" },
  "凱格鹿九期": { "zh": "凱格鹿九期", "en": "Kaigelu Phase IX" },
  "享住I": { "zh": "享住I", "en": "Xiang Zhu I" },
  "凱格鹿八期": { "zh": "凱格鹿八期", "en": "Kaigelu Phase VIII" },
  "凱格鹿一期": { "zh": "凱格鹿一期", "en": "Kaigelu Phase I" },
  "民雄鄉召會二會所(學生中心)": { "zh": "民雄鄉召會二會所(學生中心)", "en": "Minxiong Church Hall 2 (Student Center)" },
  "梓園": { "zh": "梓園", "en": "Zi Yuan" },
  "歐風學墅": { "zh": "歐風學墅", "en": "Euro-Style Villa" },
  "鵬莊": { "zh": "鵬莊", "en": "Peng Zhuang" },
  "米蘭": { "zh": "米蘭", "en": "Milan" },
  "柏睿學院": { "zh": "柏睿學院", "en": "Borui Academy" },
  "康莊": { "zh": "康莊", "en": "Kang Zhuang" },
  "菁華學苑": { "zh": "菁華學苑", "en": "Jinghua Academy" },
  "鼎冠學苑": { "zh": "鼎冠學苑", "en": "Dingguan Academy" },
  "唯心之旅": { "zh": "唯心之旅", "en": "Journey of the Mind" },
  "三興會館民宿": { "zh": "三興會館民宿", "en": "Sanxing Hall Homestay" },
  "凱媽的家1館": { "zh": "凱媽的家1館", "en": "Mommy Kai's Home Hall 1" },
  "中正會館": { "zh": "中正會館", "en": "Zhongzheng Hall" },
  "蔬香是家": { "zh": "蔬香是家", "en": "Veggie Home" },
  "中正美學": { "zh": "中正美學", "en": "Zhongzheng Aesthetics" },
  "博士學苑": { "zh": "博士學苑", "en": "PhD Academy" },
  "巴豆夭百元美味鍋物": { "zh": "巴豆夭百元美味鍋物", "en": "Ba Dou Yao 100 NTD Hot Pot" },
  "光明雅舍": { "zh": "光明雅舍", "en": "Guangming Yashe" },
  "早叄早午餐": { "zh": "早叄早午餐", "en": "Zao San Brunch" },
  "蔬芙": { "zh": "蔬芙", "en": "Shu Fu" },
  "八方雲集": { "zh": "八方雲集", "en": "Bafang Dumpling" },
  "阿基鍋燒麵": { "zh": "阿基鍋燒麵", "en": "A-Ji Pot Burn Noodles" },
  "光陽機車": { "zh": "光陽機車", "en": "KYMCO Motorcycles" },
  "早餐好樂": { "zh": "早餐好樂", "en": "Good Morning Breakfast" },
  "紘翔車業": { "zh": "紘翔車業", "en": "Hongxiang Scooters" },
  "中正大學-廣場公園停車場": { "zh": "中正大學-廣場公園停車場", "en": "CCU Plaza Park Parking Lot" },
  "嘉義富野渡假酒店": { "zh": "嘉義富野渡假酒店", "en": "HOYA Resort Hotel Chiayi" },
  "YAMAHA-中正車坊": { "zh": "YAMAHA-中正車坊", "en": "YAMAHA - Zhongzheng Shop" },
  "中正偉文": { "zh": "中正偉文", "en": "Zhongzheng Weiwen" },
  "百田中西式早午餐": { "zh": "百田中西式早午餐", "en": "Bai Tian Brunch" },
  "美廉社民雄裕農店": { "zh": "美廉社民雄裕農店", "en": "Simple Mart - Minxiong Yunong Store" },
  "明發影印行": { "zh": "明發影印行", "en": "Ming Fa Copy Shop" },
  "花圓巧芋": { "zh": "花圓巧芋", "en": "Hua Yuan Qiao Yu" },
  "高點網路學院": { "zh": "高點網路學院", "en": "Knowledge Master" },
  "咖啡王國": { "zh": "咖啡王國", "en": "Coffee Kingdom" },
  "小樹苗電腦": { "zh": "小樹苗電腦", "en": "Little Sapling Computers" },
  "槍與玫瑰": { "zh": "槍與玫瑰", "en": "Guns N' Roses" },
  "橙堡早午餐": { "zh": "橙堡早午餐", "en": "Orange Castle Brunch" },
  "韓湯匙 無人拉麵": { "zh": "韓湯匙 無人拉麵", "en": "Han Spoon Unmanned Ramen" },
  "小栗鼠cafe": { "zh": "小栗鼠cafe", "en": "Chipmunk Cafe" },
  "溫家冷滷味": { "zh": "溫家冷滷味", "en": "Wen's Cold Braised Snacks" },
  "月亮與貓｜貓貓甜點店": { "zh": "月亮與貓｜貓貓甜點店", "en": "Moon & Cat Dessert Shop" },
  "茶湯會 民雄神農店": { "zh": "茶湯會 民雄神農店", "en": "TP TEA - Minxiong Shennong Store" },
  "豪緯麵食館": { "zh": "豪緯麵食館", "en": "Hao Wei Noodle Shop" },
  "仙草奶酪": { "zh": "仙草奶酪", "en": "Grass Jelly Panna Cotta" },
  "古早味炒麵（脆皮臭豆腐）": { "zh": "古早味炒麵（脆皮臭豆腐）", "en": "Traditional Fried Noodles & Crispy Stinky Tofu" },
  "鍋序": { "zh": "鍋序", "en": "Guo Xu Hot Pot" },
  "蘭姐手工水餃": { "zh": "蘭姐手工水餃", "en": "Sister Lan's Handmade Dumplings" },
  "亞米美食": { "zh": "亞米美食", "en": "Yummy Food" },
  "紅樓極麵": { "zh": "紅樓極麵", "en": "Red House Noodles" },
  "東方美早午餐": { "zh": "東方美早午餐", "en": "Dong Fang Mei Brunch" },
  "隱客廳": { "zh": "隱客廳", "en": "Hidden Living Room" },
  "一番食堂": { "zh": "一番食堂", "en": "Ichiban Restaurant" },
  "洵香麻辣燙": { "zh": "洵香麻辣燙", "en": "Xun Xiang Spicy Hot Pot" },
  "富成屋拉麵": { "zh": "富成屋拉麵", "en": "Fuchengya Ramen" },
  "翅炸鍋": { "zh": "翅炸鍋", "en": "Chi Zha Guo" },
  "豐正食堂": { "zh": "豐正食堂", "en": "Feng Zheng Restaurant" },
  "傻師傅神農店": { "zh": "傻師傅神農店", "en": "Sha Shi Fu - Shennong Store" },
  "烘培工房": { "zh": "烘培工房", "en": "Baking Workshop" },
  "嘉農小館": { "zh": "嘉農小館", "en": "Jia Nong Restaurant" },
  "榕樹下": { "zh": "榕樹下", "en": "Under the Banyan Tree" },
  "中正海南雞飯": { "zh": "中正海南雞飯", "en": "Zhongzheng Hainanese Chicken Rice" },
  "鹿初Brunch": { "zh": "鹿初Brunch", "en": "Lu Chu Brunch" },
  "洪媽媽泰式簡餐": { "zh": "洪媽媽泰式簡餐", "en": "Mother Hong's Thai Food" },
  "有go滷乾式炒滷味": { "zh": "有go滷乾式炒滷味", "en": "You Go Dry Braised Snacks" },
  "越式炒泡麵、河粉": { "zh": "越式炒泡麵、河粉", "en": "Vietnamese Fried Noodles & Pho" },
  "王仔滷味": { "zh": "王仔滷味", "en": "Wang Zai Braised Snacks" },
  "愛恨椒雞": { "zh": "愛恨椒雞", "en": "Love & Hate Spicy Chicken" },
  "中正雞場": { "zh": "中正雞場", "en": "Zhongzheng Chicken Farm" },
  "南方快炒": { "zh": "南方快炒", "en": "Nanfang Stir-fry" },
  "農閒時刻的粥": { "zh": "農閒時刻的粥", "en": "Leisure Time Congee" },
  "十畝田滷味": { "zh": "十畝田滷味", "en": "Shi Mu Tian Braised Snacks" },
  "巧味果汁": { "zh": "巧味果汁", "en": "Qiao Wei Juice" },
  "阿湯哥脆皮湯包": { "zh": "阿湯哥脆皮湯包", "en": "Tom's Crispy Soup Dumplings" },
  "錢伯鹽水雞": { "zh": "錢伯鹽水雞", "en": "Uncle Qian's Salted Water Chicken" },
  "早安山丘": { "zh": "早安山丘", "en": "Morning Hill" },
  "大榮數位輸出影印行": { "zh": "大榮數位輸出影印行", "en": "Da Rong Digital Copy Shop" },
  "渝香园簡餐": { "zh": "渝香园簡餐", "en": "Yu Xiang Yuan Restaurant" },
  "鴻昇數位輸出影印中心": { "zh": "鴻昇數位輸出影印中心", "en": "Hong Sheng Digital Copy Center" },
  "楊家豆漿": { "zh": "楊家豆漿", "en": "Yang's Soy Milk" },
  "Nice Nine 雙醬咖哩": { "zh": "Nice Nine 雙醬咖哩", "en": "Nice Nine Dual Sauce Curry" },
  "關東煮炒麵炒米粉": { "zh": "關東煮炒麵炒米粉", "en": "Oden & Fried Noodles" },
  "微微笑手作坊": { "zh": "微微笑手作坊", "en": "Smile Handmade Studio" },
  "豪記滷味-神農路": { "zh": "豪記滷味-神農路", "en": "Haoji Braised Snacks - Shennong Road" }
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