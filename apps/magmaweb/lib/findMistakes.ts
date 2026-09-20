type Node = {
  id: string
  type: string
  label: string
  verification_status?: string
}

type Edge = {
  from: string
  to: string
}

type Graph = {
  nodes: Node[]
  edges: Edge[]
}

export function findMistakes(graph: Graph) {
  // ① 「問題あり」のノードを探す
  const problemNodes = graph.nodes.filter(
    (node) => node.verification_status === "問題あり"
  )

  // ② 問題ありノードごとに調べる
  return problemNodes.map((problemNode) => {
    // 問題ありノードにつながっているエッジを探す
    const connectedEdges = graph.edges.filter(
      (edge) =>
        edge.from === problemNode.id ||
        edge.to === problemNode.id
    )

    // ③ 接続しているノードのIDを取得
    const connectedNodeIds = connectedEdges.map((edge) =>
      edge.from === problemNode.id
        ? edge.to
        : edge.from
    )

    // ④ 接続しているノードを取得
    const connectedNodes = graph.nodes.filter((node) =>
      connectedNodeIds.includes(node.id)
    )

    // ⑤ theorem（定理）だけ取り出す
    const theorems = connectedNodes.filter(
      (node) => node.type === "theorem"
    )

    return {
      problemNode,
      theorems,
    }
  })
}