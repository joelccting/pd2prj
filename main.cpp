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

struct Edge {
    long long to; 
    unordered_map<string, double> weights; 
};

// 輔助函數：將 "1,2,3" 解析成 vector
vector<long long> parseList(const string& str) {
    vector<long long> res;
    stringstream ss(str);
    string token;
    while (getline(ss, token, ',')) {
        res.push_back(stoll(token));
    }
    return res;
}

int main(int argc, char* argv[]) {
    if (argc < 3 || argc > 4) return 1;

    vector<long long> starts = parseList(argv[1]);
    vector<long long> ends = parseList(argv[2]);
    string weight_type = (argc == 4) ? argv[3] : "distance";

    // 將終點放入 Hash Set 加速查詢
    unordered_set<long long> end_set(ends.begin(), ends.end());

    unordered_map<long long, vector<Edge>> graph;
    ifstream file("graph.txt");
    string line;
    while (getline(file, line)) {
        if (line.empty()) continue;
        istringstream iss(line);
        long long u, v;
        if (!(iss >> u >> v)) continue;

        unordered_map<string, double> edge_weights;
        string kv;
        while (iss >> kv) {
            size_t pos = kv.find('=');
            if (pos != string::npos) {
                edge_weights[kv.substr(0, pos)] = stod(kv.substr(pos + 1));
            }
        }
        graph[u].push_back({v, edge_weights});
        graph[v].push_back({u, edge_weights});
    }
    file.close();

    // 🚀 新增：決定尋路時要看哪一個數值當作成本 (Cost)
    // 如果傳入的是交通工具模式，則尋路權重預設使用 "distance" 來找最短物理距離
    // 如果前端傳入其他字串 (例如 "time" 或 "accessible")，則以該字串作為權重
    string cost_key = "distance";
    if (weight_type != "car" && weight_type != "motorcycle" && weight_type != "bike" && weight_type != "walk") {
        cost_key = weight_type;
    }

    unordered_map<long long, double> dist;
    unordered_map<long long, long long> parent;
    for (const auto& pair : graph) dist[pair.first] = numeric_limits<double>::infinity();

    using pdi = pair<double, long long>;
    priority_queue<pdi, vector<pdi>, greater<pdi>> pq;

    // 🚀 核心優化：將所有起點同時放入 Queue，距離為 0
    for (long long s : starts) {
        if (graph.count(s)) {
            dist[s] = 0.0;
            pq.push({0.0, s});
            parent[s] = s; // 自己是自己的起點
        }
    }

    long long final_end = -1; // 記錄最先碰到的終點

    while (!pq.empty()) {
        auto [current_dist, current_node] = pq.top();
        pq.pop();

        if (current_dist > dist[current_node]) continue;

        // 🚀 核心優化：只要碰到「任何一個」終點，就代表找到了全局最短路徑！
        if (end_set.count(current_node)) {
            final_end = current_node;
            break;
        }

        for (const auto& edge : graph[current_node]) {
            // ==========================================
            // 🚀 新增：多交通工具通行限制過濾邏輯
            // ==========================================
            if (weight_type == "car" || weight_type == "motorcycle") {
                // 如果是汽車或機車，檢查是否有 pedestrian_only 屬性，若有且為 1 則不可通行
                if (edge.weights.count("pedestrian_only") && edge.weights.at("pedestrian_only") == 1.0) {
                    continue;
                }
            }

            if (weight_type == "motorcycle") {
                // 如果是機車，檢查是否有 motor_vehicle_allowed 屬性，若有且為 0 則不可通行
                if (edge.weights.count("motor_vehicle_allowed") && edge.weights.at("motor_vehicle_allowed") == 0.0) {
                    continue;
                }
            }
            // ==========================================

            // 決定此邊的實際權重：使用 cost_key，若無則退回找 "distance"，再找不到則給予極大值
            double next_weight = edge.weights.count(cost_key) ? edge.weights.at(cost_key) : 
                                 (edge.weights.count("distance") ? edge.weights.at("distance") : 99999.0);
            
            // 保留原有的 accessible 特殊邏輯
            if (cost_key == "accessible" && next_weight == 0) continue;

            if (dist[current_node] + next_weight < dist[edge.to]) {
                dist[edge.to] = dist[current_node] + next_weight;
                parent[edge.to] = current_node;
                pq.push({dist[edge.to], edge.to});
            }
        }
    }

    // 回推路徑
    if (final_end == -1) {
        cout << "NONE\n";
    } else {
        vector<long long> path;
        long long curr = final_end;
        while (parent[curr] != curr) { // 追溯到最原始的起點
            path.push_back(curr);
            curr = parent[curr];
        }
        path.push_back(curr);
        reverse(path.begin(), path.end());

        for (size_t i = 0; i < path.size(); ++i) {
            cout << path[i] << (i == path.size() - 1 ? "" : " ");
        }
        cout << "\n";
    }
    return 0;
}