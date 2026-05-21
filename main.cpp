#include <iostream>
#include <fstream>
#include <vector>
#include <unordered_map>
#include <unordered_set>
#include <queue>
#include <limits>
#include <algorithm>
#include <string>
#include <sstream>

using namespace std;

// 定義邊的結構
struct Edge {
    long long to; 
    double distance = 1.0;
    double slope = 0.0;
    double tree_shade = 0.0;
    double building_shade = 0.0;
};

// 輔助函數：將以逗號分隔的字串 "1,2,3" 解析成 vector
vector<long long> parseList(const string& str) {
    vector<long long> res;
    stringstream ss(str);
    string token;
    while (getline(ss, token, ',')) {
        res.push_back(stoll(token));
    }
    return res;
}

unordered_map<long long, vector<Edge>> graph;

// 讀取圖資的函數
void loadGraph(const string& filename) {
    ifstream infile(filename);
    if (!infile.is_open()) {
        cerr << "Error: Cannot open " << filename << endl;
        exit(1);
    }

    long long u, v;
    int weight_count;
    string weight_name;
    double weight_value;

    while (infile >> u >> v >> weight_count) {
        Edge edge;
        edge.to = v;
        for (int i = 0; i < weight_count; ++i) {
            infile >> weight_name >> weight_value;
            if (weight_name == "distance") edge.distance = weight_value;
            else if (weight_name == "slope") edge.slope = weight_value;
            else if (weight_name == "tree_shade") edge.tree_shade = weight_value;
            else if (weight_name == "building_shade") edge.building_shade = weight_value;
        }
        graph[u].push_back(edge);
    }
    infile.close();
}

int main(int argc, char* argv[]) {
    // 檢查參數數量 (執行檔名稱, 起點列表, 終點列表, 模式, 交通工具)
    if (argc < 5) {
        cerr << "Usage: ./main <starts> <ends> <mode> <vehicle>" << endl;
        return 1;
    }

    // 解析命令列參數
    vector<long long> starts = parseList(argv[1]);
    vector<long long> ends = parseList(argv[2]);
    string mode = argv[3];
    string vehicle = argv[4];

    // 載入 Python 準備好的帶有權重的圖資檔案
    loadGraph("graph.txt");

    // 將目標節點放入 Set，加速查詢
    unordered_set<long long> target_nodes(ends.begin(), ends.end());
    priority_queue<pair<double, long long>, 
                   vector<pair<double, long long>>, 
                   greater<pair<double, long long>>> pq;

    // 🌟 修正點：降維成 1D unordered_map，避免大量記憶體分配導致 bad_alloc！
    // 記錄起點到該節點的最小成本
    unordered_map<long long, double> dist;
    // 記錄回溯路徑的父節點
    unordered_map<long long, long long> parent;

    // 將所有起點放入 Queue 初始化
    for (long long start : starts) {
        pq.push({0.0, start});
        dist[start] = 0.0;
    }

    long long final_end = -1;

    // 開始 Dijkstra 尋路
    while (!pq.empty()) {
        auto [current_dist, current_node] = pq.top();
        pq.pop();

        // 如果找到任何一個目標節點，提早結束搜尋
        if (target_nodes.count(current_node)) {
            final_end = current_node;
            break;
        }

        // Lazy deletion：如果取出的距離比目前記錄的最佳距離還大，代表這是一條舊路徑，略過。
        if (current_dist > dist[current_node]) continue;

        // 遍歷所有相連的邊 (Neighbors)
        for (const auto& edge : graph[current_node]) {
            long long next_node = edge.to;

            // 預設成本為距離
            double next_weight = edge.distance;
            double penalty = 0.0;

            // 1. 處理坡度懲罰
            if (edge.slope > 0.08) {
                penalty += 1000.0 + (edge.slope * 5000.0);
            }

            // 2. 處理日曬/林蔭模式 (Mode: shade)
            if (mode == "shade") {
                if (edge.tree_shade > 0.5 || edge.building_shade > 0.5) {
                    next_weight *= 0.3; 
                } else {
                    penalty += next_weight * 5.0; 
                }
            }

            // 計算走到下個節點的總新成本
            double new_dist = current_dist + next_weight + penalty;

            // Relaxation 鬆弛步驟：如果找到更便宜的走法，就更新它
            if (dist.find(next_node) == dist.end() || new_dist < dist[next_node]) {
                dist[next_node] = new_dist;
                parent[next_node] = current_node; // 紀錄從哪裡走過來的，供回溯使用
                pq.push({new_dist, next_node});
            }
        }
    } 

    // 回溯與輸出路徑
    if (final_end == -1) {
        // 找不到任何路徑到達終點
        cout << "NONE\n";
    } else {
        vector<long long> path;
        long long curr = final_end;
        
        // 循著 parent 指標往回找，直到沒有 parent 為止 (即起點)
        while (true) {
            path.push_back(curr);
            if (parent.find(curr) == parent.end()) {
                break; 
            }
            curr = parent[curr];
        }
        
        // 因為是從終點往回找，所以需要反轉陣列
        reverse(path.begin(), path.end());
        
        // 輸出結果給 Python 讀取 (以空格分隔的 ID 列表)
        for (size_t i = 0; i < path.size(); ++i) {
            cout << path[i] << (i == path.size() - 1 ? "" : " ");
        }
        cout << "\n";
    }

    return 0;
}