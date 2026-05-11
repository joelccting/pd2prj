#include <iostream>
#include <fstream>
#include <vector>
#include <unordered_map>
#include <queue>
#include <limits>
#include <algorithm>
#include <string>
#include <sstream>

using namespace std;

// 升級：Edge 現在擁有一個字典 (unordered_map)，可以裝下無限多種權重！
struct Edge {
    long long to; 
    unordered_map<string, double> weights; 
};

int main(int argc, char* argv[]) {
    // 增加第三個參數：你要用哪一種權重模式來尋路？
    if (argc < 3 || argc > 4) {
        cerr << "用法: " << argv[0] << " <start_id> <end_id> [weight_type]\n";
        return 1;
    }

    long long start_id = stoll(argv[1]);
    long long end_id = stoll(argv[2]);
    
    // 預設使用 distance，若有傳入第三個參數(例如 sheltered)則使用傳入的模式
    string weight_type = (argc == 4) ? argv[3] : "distance";

    unordered_map<long long, vector<Edge>> graph;

    ifstream file("graph.txt");
    if (!file.is_open()) {
        cerr << "Error: Cannot open graph.txt\n";
        return 1;
    }

    // 🚀 新版解析器：讀取 key=value 格式
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
                string key = kv.substr(0, pos);
                double val = stod(kv.substr(pos + 1));
                edge_weights[key] = val; // 把權重存入字典
            }
        }
        
        graph[u].push_back({v, edge_weights});
        graph[v].push_back({u, edge_weights});
    }
    file.close();

    if (graph.find(start_id) == graph.end()) {
        cout << "NONE\n";
        return 0;
    }

    unordered_map<long long, double> dist;
    unordered_map<long long, long long> parent;

    for (const auto& pair : graph) {
        dist[pair.first] = numeric_limits<double>::infinity();
    }
    dist[start_id] = 0.0;

    using pdi = pair<double, long long>;
    priority_queue<pdi, vector<pdi>, greater<pdi>> pq;
    pq.push({0.0, start_id});

    while (!pq.empty()) {
        auto [current_dist, current_node] = pq.top();
        pq.pop();

        if (current_dist > dist[current_node]) continue;
        if (current_node == end_id) break;

        for (const auto& edge : graph[current_node]) {
            double next_weight = 0.0;

            // 🌟 核心邏輯：根據前端指定的 weight_type 抓取對應權重
            if (edge.weights.count(weight_type)) {
                next_weight = edge.weights.at(weight_type);
                
                // 特殊邏輯：如果是 accessible 模式，數值為 0 (不可通行) 時，給予無限大懲罰
                if (weight_type == "accessible" && next_weight == 0) {
                    continue; // 這條路輪椅過不去，直接跳過不走！
                }
            } else {
                // 如果這條邊剛好沒有你要找的權重，預設加上一個懲罰值或跳過
                next_weight = 99999.0; 
            }

            if (dist[current_node] + next_weight < dist[edge.to]) {
                dist[edge.to] = dist[current_node] + next_weight;
                parent[edge.to] = current_node;
                pq.push({dist[edge.to], edge.to});
            }
        }
    }

    if (dist.find(end_id) == dist.end() || dist[end_id] == numeric_limits<double>::infinity()) {
        cout << "NONE\n";
    } else {
        vector<long long> path;
        for (long long curr = end_id; curr != start_id; curr = parent[curr]) {
            path.push_back(curr);
        }
        path.push_back(start_id);
        reverse(path.begin(), path.end());

        for (size_t i = 0; i < path.size(); ++i) {
            cout << path[i] << (i == path.size() - 1 ? "" : " ");
        }
        cout << "\n";
    }

    return 0;
}