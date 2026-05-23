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

using namespace std;

// --- 結構定義 ---

// 節點結構 (新增座標，用於計算轉彎角度)
struct Node {
    long long id;
    double lat;
    double lon;
};

// 邊的結構
struct Edge {
    long long to; 
    double distance = 1.0;
    double slope = 0.0;
    double tree_shade = 0.0;
    double building_shade = 0.0;
    int walk = 1;
    int bike = 1;
    int ebike = 1;
    int motorcycle = 1;
    int car = 1;
};

// 狀態結構 (Priority Queue 使用)
struct State {
    double cost;  // 累積的權重
    long long u;  // 當前節點
    long long p;  // 前一個節點
    
    bool operator>(const State& other) const {
        return cost > other.cost;
    }
};

// --- 全域變數 ---
unordered_map<long long, vector<Edge>> graph;
unordered_map<long long, Node> nodes; // 儲存所有節點的座標

// --- 輔助函數 ---

vector<long long> parseList(const string& str) {
    vector<long long> res;
    stringstream ss(str);
    string token;
    while (getline(ss, token, ',')) {
        res.push_back(stoll(token));
    }
    return res;
}

// 載入節點座標
void loadNodes(const string& filename) {
    ifstream infile(filename);
    if (!infile.is_open()) {
        cerr << "Error: Cannot open " << filename << endl;
        exit(1);
    }
    long long id;
    double lat, lon;
    // 假設 nodes.txt 的格式是: id lat lon
    while (infile >> id >> lat >> lon) {
        nodes[id] = {id, lat, lon};
    }
    infile.close();
}

// 載入圖的邊與權重
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
            else if (weight_name == "walk")       edge.walk = (int)weight_value;
            else if (weight_name == "bike")       edge.bike = (int)weight_value;
            else if (weight_name == "ebike")      edge.ebike = (int)weight_value;
            else if (weight_name == "motorcycle") edge.motorcycle = (int)weight_value;
            else if (weight_name == "car")        edge.car = (int)weight_value;
        }
        graph[u].push_back(edge);
    }
    infile.close();
}

// 計算轉彎角度
double calculate_turn_angle(Node prev, Node curr, Node next) {
    double dx1 = curr.lon - prev.lon;
    double dy1 = curr.lat - prev.lat;
    
    double dx2 = next.lon - curr.lon;
    double dy2 = next.lat - curr.lat;
    
    double angle1 = atan2(dy1, dx1);
    double angle2 = atan2(dy2, dx2);
    
    double diff = abs(angle2 - angle1);
    if (diff > M_PI) {
        diff = 2.0 * M_PI - diff;
    }
    return diff; 
}

// --- 主程式 ---

int main(int argc, char* argv[]) {
    cerr << "starts: " << argv[1] << endl;
    cerr << "ends: " << argv[2] << endl;
    cerr << "mode: " << argv[3] << endl;
    cerr << "graph edges loaded: " << graph.size() << endl;
    cerr << "nodes loaded: " << nodes.size() << endl;
    if (argc < 5) {
        cerr << "Usage: ./main <starts> <ends> <mode> <vehicle>" << endl;
        return 1;
    }

    vector<long long> starts = parseList(argv[1]);
    vector<long long> ends = parseList(argv[2]);
    string mode = argv[3];
    string vehicle = argv[4];

    // 載入檔案 (請確保檔名與路徑正確)
    loadNodes("nodes.txt"); 
    loadGraph("graph.txt");

    unordered_set<long long> target_nodes(ends.begin(), ends.end());
    
    // 修正點 1：改用自訂的 State 結構
    priority_queue<State, vector<State>, greater<State>> pq;

    unordered_map<long long, unordered_map<long long, double>> dist;
    unordered_map<long long, unordered_map<long long, long long>> parent;

    // 修正點 2：加入 p = -1 作為起點的標記
    for (long long start : starts) {
        pq.push({0.0, start, -1});
        dist[start][-1] = 0.0;  // 這裡升級成 2D [目前節點][-1]
    }

    long long final_end = -1;

    while (!pq.empty()) {
    State current_state = pq.top();
    pq.pop();
    double current_dist = current_state.cost;
    long long u = current_state.u;
    long long p = current_state.p;

    if (dist.count(u) && dist[u].count(p) && current_dist > dist[u][p]) continue;
    if (target_nodes.count(u)) {
        final_end = u;
        break;
    }

        for (const auto& edge : graph[u]) {
            long long v = edge.to;
            bool can_ride;
            if (vehicle == "bike")       can_ride = edge.bike == 1;
            else if (vehicle == "ebike") can_ride = edge.ebike == 1;
            else if (vehicle == "motorcycle") can_ride = edge.motorcycle == 1;
            else if (vehicle == "car")   can_ride = edge.car == 1;
            else can_ride = true;
            if (vehicle == "walk" && edge.walk == 0) continue;
            double next_cost = can_ride ? edge.distance : edge.distance * 3.0;
            
            // --- 依照不同模式套用各自的權重與懲罰 ---
            if (mode == "shortest") {
                next_cost = edge.distance;
                
            } else if (mode == "least_climbing") {
                // 用絕對值，上下坡都算；斜率越大懲罰越重
                double abs_slope = abs(edge.slope);
                if (abs_slope > 0.01) {
                    next_cost += abs_slope * 10000.0;
                }
            } else if (mode == "shade") {
                // 將樹蔭與建築物陰影相加，但最高限制在 1.0 (100% 遮蔽)
                double total_shade = min(1.0, edge.tree_shade + edge.building_shade);
                
                if (total_shade >= 0.5) { 
                    // 遮蔽率大於 50%，當作林蔭大道，給予權重折扣
                    next_cost *= 0.4; 
                } else {
                    // 遮蔽率不足，太陽直射，加上固定懲罰
                    // 這個 50.0 可以視你的 base distance 單位來調整 (如果是公尺，50 算是滿有感的懲罰)
                    next_cost += 50.0; 
                }    
            } else if (mode == "least_turns") {
                if (p != -1) { 
                    if (nodes.count(p) && nodes.count(u) && nodes.count(v)) {
                        double turn_rad = calculate_turn_angle(nodes[p], nodes[u], nodes[v]);
                        // 2. 只要有微小轉彎 (大約 11 度) 就視為轉彎，並給予毀滅性懲罰
                        if (turn_rad > M_PI / 16.0) {
                            next_cost += 99999.0; 
                        }
                    }
                }
            }

            double dist_v_u = (dist.count(v) && dist[v].count(u)) ? dist[v][u] : numeric_limits<double>::max();

            if (current_dist + next_cost < dist_v_u) {
                dist[v][u] = current_dist + next_cost;
                parent[v][u] = p; // 紀錄從狀態 (v, u) 往回推，前一步是 p
                pq.push({dist[v][u], v, u});
            }
        }
    } 

   if (final_end == -1) {
        cout << "NONE\n";
    } else {
        // 找出到達終點的所有狀態中，Cost 最小的那一個 p
        double min_final_dist = numeric_limits<double>::max();
        long long best_p = -1;
        
        for (const auto& [prev_node, cost] : dist[final_end]) {
            if (cost < min_final_dist) {
                min_final_dist = cost;
                best_p = prev_node;
            }
        }

        // 開始回溯路徑
        vector<long long> path;
        long long curr = final_end;
        long long prev = best_p;
        
        path.push_back(curr);
        
        // 如果 prev == -1，代表已經回到當初起點放入 Queue 時的狀態了
        while (prev != -1) {
            path.push_back(prev);
            long long next_prev = parent[curr][prev];
            curr = prev;
            prev = next_prev;
        }
        
        reverse(path.begin(), path.end());
        
        for (size_t i = 0; i < path.size(); ++i) {
            cout << path[i] << (i == path.size() - 1 ? "" : " ");
        }
        cout << "\n";
    }

    return 0;
}