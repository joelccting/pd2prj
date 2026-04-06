class Graph {
  constructor() {
    this.nodes = new Map(); // Map of nodeId to node data
    this.adjacencyList = new Map(); // Map of nodeId to array of edges
  }

  addNode(node) {
    this.nodes.set(node.id, node);
    if (!this.adjacencyList.has(node.id)) {
      this.adjacencyList.set(node.id, []);
    }
  }

  addEdge(edge) {
    let fromEdges = this.adjacencyList.get(edge.from);
    if (!fromEdges) {
      fromEdges = [];
      this.adjacencyList.set(edge.from, fromEdges);
    }
    fromEdges.push({
      to: edge.to,
      weight: edge.distance, // Or edge.time, depending on your criteria
      accessible: edge.accessible,
    });
  }
  removeNode(id) {
    this.nodes.delete(id);
    this.adjacencyList.delete(id);
    // 清除其他節點連向此節點的路線
    for (const [nodeId, edges] of this.adjacencyList.entries()) {
      this.adjacencyList.set(nodeId, edges.filter(edge => edge.to !== id));
    }
  }
  removeEdge(from, to) {
    if (this.adjacencyList.has(from)) {
      this.adjacencyList.set(from, this.adjacencyList.get(from).filter(edge => edge.to !== to));
    }
  }
}

const graph = new Graph(); // Create an instance of the Graph
