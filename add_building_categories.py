#!/usr/bin/env python3
"""
Script to add building categories to nodes in campus_nodes_edges.json
This script categorizes nodes into three categories:
- school: 學校區 (School buildings - blue)
- dining: 餐飲區 (Dining area - orange)
- housing: 住宿區 (Accommodation - black)
"""

import json
import os
import argparse
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Category rules based on building names and types
SCHOOL_KEYWORDS = [
    "大樓", "學院", "教室", "系", "館", "活動中心", "環安中心",
    "禮堂", "實習工廠", "苗圃", "動物實驗室", "變電所", "納米運動", "三興國小",
    "共同教室", "工學院", "法學院", "教育學院", "圖書", "行政", "社會科學院"
]

HOUSING_KEYWORDS = [
    "宿舍", "學苑", "會館", "凱格鹿",
    "伯爵", "陶潛", "現代首席", "京采", "墨香苑", "陶居", "木菊苑", 
    "書香門第", "常春藤", "鼎泰", "柏克萊", "彬彬", "夏都", "深白舍", "橙舍", "節能宿舍",
    "康乃爾學院", "苗園"
]

DINING_KEYWORDS = [
    "全家", "7-ELEVEN", "萊爾富", "蝦皮", "早餐",
    "嘉農小館", "咖啡", "便利商店", "餐廳", "食堂"
]

BUILDING_TYPE_MAPPING = {
    "university": "school",
    "dormitory": "housing",
    "residential": "housing",
    "yes": "dining",
    "commercial": "dining"
}

def get_category_from_name(name):
    """Determine category based on building name"""
    if not name:
        return "school"  # default
    
    name_lower = name.lower()
    
    # Check for specific overrides
    if name == "嘉農小館":
        return "dining"
    if name == "康乃爾學院":
        return "housing"
    if name == "苗園":
        return "housing"
    
    # Check DINING first (highest priority for specific names)
    for keyword in DINING_KEYWORDS:
        if keyword in name:
            return "dining"
    
    # Check HOUSING
    for keyword in HOUSING_KEYWORDS:
        if keyword in name:
            return "housing"
    
    # Check SCHOOL
    for keyword in SCHOOL_KEYWORDS:
        if keyword in name:
            return "school"
    
    # Default to dining if not matched
    return "dining"

def get_category_from_building_type(building_type):
    """Determine category based on OSM building type"""
    if not building_type:
        return None
    
    building_type_lower = building_type.lower()
    return BUILDING_TYPE_MAPPING.get(building_type_lower)

def process_nodes(input_file, output_file, verbose=False):
    """Process nodes and add category information"""
    
    # Read the input JSON file
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Track statistics
    stats = {
        "total": 0,
        "school": 0,
        "dining": 0,
        "housing": 0,
        "category_from_name": 0,
        "category_from_type": 0
    }
    
    # Process each node
    if 'nodes' in data:
        for node in data['nodes']:
            stats["total"] += 1
            
            source = "name"

            # Try to get category from building type first (if available)
            category = None
            if 'building' in node:
                category = get_category_from_building_type(node['building'])
                if category:
                    stats["category_from_type"] += 1
                    source = "type"
            
            # If not found from type, try from name
            if not category:
                category = get_category_from_name(node.get('name', ''))
                stats["category_from_name"] += 1
            
            # Add category to node
            node['category'] = category
            
            # Track statistics
            stats[category] += 1
            
            if verbose:
                print(f"✓ {node.get('name', 'Unknown')}: {category} (from {source})")
    
    # Write output file
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print("\n" + "="*60)
    print("📊 統計結果 Statistics:")
    print("="*60)
    print(f"總節點數 Total nodes: {stats['total']}")
    print(f"🏫 學校區 School: {stats['school']}")
    print(f"🍔 餐飲區 Dining: {stats['dining']}")
    print(f"🛏️  住宿區 Housing: {stats['housing']}")
    print(f"\n從建築類型識別 From building type: {stats['category_from_type']}")
    print(f"從名稱識別 From name: {stats['category_from_name']}")
    print("="*60)
    print(f"\n✅ 輸出文件已保存至: {output_file}")

def parse_args():
    parser = argparse.ArgumentParser(
        description="Add school/dining/housing category attributes to graph nodes."
    )
    parser.add_argument(
        "-i", "--input",
        default="campus_nodes_edges.json",
        help="Input graph JSON file. Default: campus_nodes_edges.json"
    )
    parser.add_argument(
        "-o", "--output",
        default=None,
        help="Output graph JSON file. Default: overwrite the input file."
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Print every node as it is categorized."
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    input_file = args.input
    output_file = args.output or args.input
    
    if os.path.exists(input_file):
        print(f"📖 讀取輸入文件: {input_file}")
        process_nodes(input_file, output_file, verbose=args.verbose)
    else:
        print(f"❌ 錯誤: 找不到文件 {input_file}")
        print("\n請確保在以下目錄執行此腳本:")
        print(f"  {os.path.abspath('.')}")
