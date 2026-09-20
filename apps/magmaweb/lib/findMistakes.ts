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

  // ② 問題ありノードから、関係する定理を探す
  const results = problemNodes.map((problemNode) => {
    const connectedEdges = graph.edges.filter(
      (edge) =>
        edge.from === problemNode.id ||
        edge.to === problemNode.id
    )

    const connectedNodeIds = connectedEdges.map((edge) =>
      edge.from === problemNode.id
        ? edge.to
        : edge.from
    )

    const connectedNodes = graph.nodes.filter((node) =>
      connectedNodeIds.includes(node.id)
    )

    const theorems = connectedNodes.filter(
      (node) => node.type === "theorem"
    )

    return {
      problemNode,
      theorems,
    }
  })

  // ③ 定理ごとのミス回数を数える
  const theoremCounts: Record<string, number> = {}

  results.forEach((result) => {
    result.theorems.forEach((theorem) => {
      theoremCounts[theorem.label] =
        (theoremCounts[theorem.label] || 0) + 1
    })
  })

  return {
    results,
    theoremCounts,
  }
}