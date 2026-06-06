import json

def add_default_transportation(input_filepath, output_filepath):
    # 讀取原本的 JSON 檔案
    with open(input_filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # 檢查並處理 edges
    if 'edges' in data:
        for edge in data['edges']:
            # 如果沒有 'car' 屬性，預設設為 1 (代表允許通行)
            if 'car' not in edge:
                edge['car'] = 1
            if 'motorcycle' not in edge:
                edge['motorcycle'] = 1
            if 'bike' not in edge:
                edge['bike'] = 1
            if 'walk' not in edge:
                edge['walk'] = 1
            if 'ebike' not in edge:
                edge['ebike'] = 1

    with open(output_filepath, 'w', encoding='utf-8') as f:
        # ensure_ascii=False 確保中文正常顯示，indent=2 讓排版易讀
        json.dump(data, f, ensure_ascii=False, indent=2)
        
    print(f"處理完成！已儲存至 {output_filepath}")

if __name__ == "__main__":
    input_file = 'campus_nodes_edges.json'
    output_file = 'campus_nodes_edges.json'
    
    add_default_transportation(input_file, output_file)