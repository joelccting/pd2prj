import json

with open('campus_nodes_edges.json', encoding='utf-8') as f:
    data = json.load(f)

slope_edges = [e for e in data['edges'] if e.get('slope', 0) > 0.1]
print('坡度 > 0.1 的邊數:', len(slope_edges))
for e in slope_edges[:5]:
    print('from=' + str(e['from']) + ' to=' + str(e['to']) + ' slope=' + str(e['slope']))

# 找適合測試的起終點：從有坡度的節點出發，找距離較遠的終點
all_node_ids = [n['id'] for n in data['nodes']]
print('建議測試起點:', slope_edges[0]['from'])
print('建議測試終點:', slope_edges[-1]['to'])
