import json, os

DATA_FILE = 'campus_nodes_edges.json'
TXT_FILE = 'graph.txt'
NODES_FILE = 'nodes.txt'

with open(DATA_FILE, encoding='utf-8') as f:
    data = json.load(f)

with open(NODES_FILE, 'w', encoding='utf-8') as f:
    for node in data['nodes']:
        nid = node['id']
        lat = node.get('lat', 0)
        lon = node.get('lng', node.get('lon', 0))
        f.write(f'{nid} {lat} {lon}\n')

with open(TXT_FILE, 'w', encoding='utf-8') as f:
    for edge in data['edges']:
        u = edge['from']
        v = edge['to']
        dist = edge.get('distance', 1.0)
        slope = edge.get('slope', 0.0)
        tree_shade = edge.get('tree_shade', 0)
        building_shade = edge.get('building_shade', 0)
        walk = edge.get('walk', 1)
        bike = edge.get('bike', 1)
        ebike = edge.get('ebike', 1)
        motorcycle = edge.get('motorcycle', 1)
        car = edge.get('car', 1)
        f.write(f'{u} {v} 9 distance {dist} slope {slope} tree_shade {tree_shade} building_shade {building_shade} walk {walk} bike {bike} ebike {ebike} motorcycle {motorcycle} car {car}\n')

print('graph.txt 重新生成完成')
print('總行數:', sum(1 for _ in open(TXT_FILE)))
