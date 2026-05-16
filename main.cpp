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
#include <cmath>
#include <tuple>

using namespace std;

constexpr double DEG_TO_RAD = 0.017453292519943295; // M_PI / 180.0
constexpr double RAD_TO_DEG = 57.29577951308232;    // 180.0 / M_PI

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

inline double calculateTurnAngle(double latA, double lonA, double latB, double lonB, double latC, double lonC) {
    // 1. 取得經緯度差值
    double dLat1 = latB - latA;
    double dLon1 = lonB - lonA;
    double dLat2 = latC - latB;
    double dLon2 = lonC - lonB;

    // 2. 計算經度投影修正係數 (以轉折點 B 的緯度為基準)
    double cosLat = std::cos(latB * DEG_TO_RAD);
    
    // 3. 套用投影修正 (將經度差轉換為與緯度差等比例的平面向量 dx, dy)
    double dx1 = dLon1 * cosLat;
    double dy1 = dLat1;
    double dx2 = dLon2 * cosLat;
    double dy2 = dLat2;

    // 4. 計算內積與向量長度平方
    double dotProduct = dx1 * dx2 + dy1 * dy2;
    double magSq1 = dx1 * dx1 + dy1 * dy1;
    double magSq2 = dx2 * dx2 + dy2 * dy2;

    // 避免除以零的情況 (若 A=B 或 B=C，代表原地未動，視為無轉彎 0 度)
    if (magSq1 == 0.0 || magSq2 == 0.0) {
        return 0.0; 
    }

    // 5. 透過內積公式計算 cos(θ)
    double cosTheta = dotProduct / std::sqrt(magSq1 * magSq2);

    // 6. 修正浮點數運算誤差
    cosTheta = std::max(-1.0, std::min(1.0, cosTheta));

    // 7. 將弧度轉換回度數
    return std::acos(cosTheta) * RAD_TO_DEG;
}

int main(int argc, char* argv[]) {
    if (argc < 3 || argc > 4) return 1;

    vector<long long> starts = parseList(argv[1]);
    vector<long long> ends = parseList(argv[2]);
    string weight_type = (argc == 4) ? argv[3] : "distance";

    // 將終點放入 Hash Set 加速查詢
    unordered_set<long long> end_set(ends.begin(), ends.end());

    // 🚀 修復：宣告並實際載入 coords
    unordered_map<long long, pair<double, double>> coords;
    
    // 讀取 nodes.txt 以獲取真實的經緯度供夾角運算
    ifstream node_file("nodes.txt");
    if (node_file.is_open()) {
        string nline;
        while (getline(node_file, nline)) {
            if (nline.empty()) continue;
            istringstream niss(nline);
            long long nid;
            double lat, lon;
            // 預期格式：節點ID 緯度 經度 (例如：12345 23.560 120.470)
            if (niss >> nid >> lat >> lon) {
                coords[nid] = {lat, lon};
            }
        }
        node_file.close();
    }

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
        // 順向 (u -> v) 絕對可以走，直接加入
        graph[u].push_back({v, edge_weights});
    }
    file.close();

    string cost_key = "distance";
    if (weight_type != "car" && weight_type != "motorcycle" && weight_type != "bike" && weight_type != "walk" && weight_type != "lazy") {
        cost_key = weight_type;
    }

    // ==========================================
    // 🚀 狀態空間擴充定義區
    // ==========================================
    constexpr double TURN_PENALTY_COST = 50.0;
    using State = std::tuple<double, long long, long long>; // {累積權重, 目前節點, 前驅節點}
    priority_queue<State, vector<State>, greater<State>> pq;
    
    // dist[目前節點][前驅節點] = 最小成本
    unordered_map<long long, unordered_map<long long, double>> dist;
    // parent[目前節點][前驅節點] = 前驅的前驅
    unordered_map<long long, unordered_map<long long, long long>> parent;

    for (long long s : starts) {
        if (graph.count(s)) {
            dist[s][s] = 0.0;
            pq.push({0.0, s, s});
            parent[s][s] = s; 
        }
    }

    long long final_end = -1;
    long long final_prev = -1; 

    // ==========================================
    // 🚀 Dijkstra 核心迴圈
    // ==========================================
    while (!pq.empty()) {
        auto [current_dist, current_node, previous_node] = pq.top();
        pq.pop();

        if (current_dist > dist[current_node][previous_node]) continue;

        if (end_set.count(current_node)) {
            final_end = current_node;
            final_prev = previous_node;
            break;
        }

        for (const auto& edge : graph[current_node]) {
            long long next_node = edge.to;

            if (weight_type == "car" || weight_type == "motorcycle") {
                if (edge.weights.count("pedestrian_only") && edge.weights.at("pedestrian_only") == 1.0) continue;
            }
            if (weight_type == "motorcycle") {
                if (edge.weights.count("motor_vehicle_allowed") && edge.weights.at("motor_vehicle_allowed") == 0.0) continue;
            }

            double next_weight = edge.weights.count(cost_key) ? edge.weights.at(cost_key) : 
                                 (edge.weights.count("distance") ? edge.weights.at("distance") : 99999.0);
            
            if (cost_key == "accessible" && next_weight == 0) continue;

            double penalty = 0.0;
            if (weight_type == "lazy" && previous_node != current_node) {
                // 確保三個點的座標都有成功讀取，否則不計算懲罰
                if (coords.count(previous_node) && coords.count(current_node) && coords.count(next_node)) {
                    double angle = calculateTurnAngle(
                        coords[previous_node].first, coords[previous_node].second,
                        coords[current_node].first,  coords[current_node].second,
                        coords[next_node].first,     coords[next_node].second
                    );
                    
                    if (angle > 45.0) {
                        penalty = TURN_PENALTY_COST;
                    }
                }
            }

            double new_dist = current_dist + next_weight + penalty;

            if (dist[next_node].find(current_node) == dist[next_node].end() || 
                new_dist < dist[next_node][current_node]) {
                
                dist[next_node][current_node] = new_dist;
                parent[next_node][current_node] = previous_node; 
                pq.push({new_dist, next_node, current_node});
            }
        }
    } 

    if (final_end == -1) {
        cout << "NONE\n";
    } else {
        vector<long long> path;
        long long curr = final_end;
        long long prev = final_prev;
        
        while (curr != prev) { 
            path.push_back(curr);
            long long next_prev = parent[curr][prev];
            curr = prev;
            prev = next_prev;
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