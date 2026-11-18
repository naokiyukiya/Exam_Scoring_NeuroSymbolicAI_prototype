import { NextResponse } from 'next/server';

// =========================================================================
// 1. 型定義 / 既存UIのverification_statusを保持
// =========================================================================
type NodeType = 'proposition' | 'inference' | 'theorem';
type SymbolicStatus = 'valid' | 'invalid' | 'unknown';

interface GraphNode {
  id: string;
  type: NodeType;
  label?: string;
  text?: string;
  theorem_id?: string | null;
  formula_ast?: Record<string, unknown> | null;
  ast_validation?: string;
  verification_status?: '問題なし' | '問題あり' | '未検証';
  symbolic_status?: SymbolicStatus;
  error_reason?: string;
  [key: string]: any;
}
interface GraphEdge {
  source?: string;
  target?: string;
  from?: string;
  to?: string;
}
interface LogicGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  symbol_registry?: Record<string, unknown>;
  evidence_sources?: Array<Record<string, unknown>>;
  contract_version?: string;
}

// =========================================================================
// 2. SymPy向け 数式整形ヘルパー（旧API用に保持）
// この文字列処理は一般的なLaTeXパーサーではないため、新しい検証APIには渡さない。
// =========================================================================
function formatForSympy(str: string): string {
  if (!str) return '';
  let s = str.replace(/\(\s*[①-⑳]\s*\)/g, '').replace(/[①-⑳]/g, '').replace(/[…・]/g, '').trim();
  s = s.replace(/\\sqrt\{([^}]+)\}/g, 'sqrt($1)');
  s = s.replace(/\\sqrt/g, 'sqrt');
  s = s.replace(/\\/g, '');
  s = s.replace(/\^/g, '**');
  s = s.replace(/≦/g, '<=').replace(/≧/g, '>=').replace(/≤/g, '<=').replace(/≥/g, '>=');
  const eqParts = s.split(/(?<![<>=!])=(?![<>=])/);
  if (eqParts.length === 2 && !s.includes('または') && !s.includes('かつ') && !s.includes(',')) {
    s = `Eq(${eqParts[0].trim()}, ${eqParts[1].trim()})`;
  }
  if (s.includes('または')) {
    const parts = s.split(/\s*または\s*/);
    return `Or(${parts.map(p => formatForSympy(p)).join(', ')})`;
  }
  if (s.includes('かつ') || s.includes('，') || s.includes(',')) {
    const parts = s.split(/\s*かつ\s*|，|,/);
    return `And(${parts.map(p => formatForSympy(p)).join(', ')})`;
  }
  const compRegex = /([^<>=]+)\s*(<=|<|>=|>)\s*([^<>=]+)\s*(<=|<|>=|>)\s*([^<>=]+)/;
  if (compRegex.test(s)) s = s.replace(compRegex, 'And($1 $2 $3, $3 $4 $5)');
  const notEqRegex = /([^=<>≠!]+)\s*(?:≠|!=)\s*([^=<>≠!]+)/g;
  s = s.replace(notEqRegex, 'Ne($1, $2)');
  s = s.replace(/Σ\[([a-zA-Z]+)=([^\s\]]+)\s+to\s+([^\]]+)\]\s*([a-zA-Z0-9_]+|\([^)]+\))/g, 'Sum($4, ($1, $2, $3))');
  s = s.replace(/∫\[([^\]]+)\s+to\s+([^\]]+)\]\s*(.+?)\s*d([a-zA-Z])/g, 'Integral($3, ($4, $1, $2))');
  s = s.replace(/∫\s*(.+?)\s*d([a-zA-Z])/g, 'Integral($1, $2)');
  s = s.replace(/lim\[([a-zA-Z]+)\s*(?:->\vert{}→)\s*([^\]]+)\]\s*(.+)/g, 'Limit($3, $1, $2)');
  s = s.replace(/d\/d([a-zA-Z])\s*\((.+?)\)/g, 'Derivative($2, $1)');
  s = s.replace(/log\[([^\]]+)\]\((.+?)\)/g, 'log($2, $1)');
  s = s.replace(/ln\((.+?)\)/g, 'log($1)');
  s = s.replace(/\|([^|]+)\|/g, 'Abs($1)');
  s = s.replace(/C\(([^,]+),\s*([^)]+)\)/g, 'binomial($1, $2)');
  s = s.replace(/P\(([^,]+),\s*([^)]+)\)/g, '(factorial($1)/factorial($1-$2))');
  return s;
}

function uiStatus(status: SymbolicStatus): GraphNode['verification_status'] {
  return status === 'valid' ? '問題なし' : status === 'invalid' ? '問題あり' : '未検証';
}

function safeUnknown(node: GraphNode, reason: string): void {
  node.symbolic_status = 'unknown';
  node.verification_status = '未検証';
  node.error_reason = reason;
}

function graphForSolver(graph: LogicGraph) {
  const edges = graph.edges.map(e => ({ from: e.from ?? e.source, to: e.to ?? e.target }));
  return {
    contract_version: graph.contract_version || '2.2.0',
    nodes: graph.nodes.map(node => ({
      id: node.id, type: node.type, theorem_id: node.theorem_id ?? null,
      formula_ast: node.formula_ast ?? null,
      ast_validation: node.ast_validation || 'unknown',
      theorem_assignment: node.theorem_assignment || null,
      validity_scope: node.validity_scope ?? 'unspecified',
      scope_evidence: node.scope_evidence ?? [],
      provenance: node.provenance ?? null,
      subject_symbol_id: node.subject_symbol_id ?? null,
      inputs_used: node.inputs_used ?? null,
      outputs_derived: node.outputs_derived ?? null
    })),
    edges,
    symbol_registry: graph.symbol_registry || { registry_id: 'unknown', symbols: [] },
    evidence_sources: graph.evidence_sources || []
  };
}

// =========================================================================
// 3. APIルートハンドラ
// 新方式では式の文字列やAI候補だけでvalidを付けず、構造化ASTだけを検証する。
// =========================================================================
export async function POST(req: Request) {
  try {
    const graph: LogicGraph = await req.json();
    if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
      return NextResponse.json({ error: 'Invalid Graph Payload' }, { status: 400 });
    }
    const updatedNodes: GraphNode[] = graph.nodes.map(node => ({ ...node }));
    const nodeMap = new Map(updatedNodes.map(n => [n.id, n]));
    if (nodeMap.size !== updatedNodes.length) {
      return NextResponse.json({ error: 'Duplicate node IDs' }, { status: 400 });
    }
    const edges = graph.edges.map(e => ({ from: e.from ?? e.source, to: e.to ?? e.target }));
    if (edges.some(e => !e.from || !e.to || !nodeMap.has(e.from) || !nodeMap.has(e.to))) {
      return NextResponse.json({ error: 'Invalid edge endpoints' }, { status: 400 });
    }

    const inferenceNodes = updatedNodes.filter(n => n.type === 'inference');
    const sympyApiUrl = process.env.SYMPY_API_URL;
    if (!sympyApiUrl) {
      for (const node of inferenceNodes) safeUnknown(node, 'SYMPY_API_URL未設定のため未判定');
      return NextResponse.json({ nodes: updatedNodes });
    }

    // If graph has no validated ASTs (legacy records), do not turn sampled
    // numerical agreement or text parsing failures into correctness claims.
    const graphPayload = graphForSolver({ ...graph, nodes: updatedNodes });
    let response: Response;
    try {
      response = await fetch(`${sympyApiUrl.replace(/\/$/, '')}/api/verify_ast`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graph: graphPayload }),
        cache: 'no-store', signal: AbortSignal.timeout(12000)
      });
    } catch (err: any) {
      for (const node of inferenceNodes) safeUnknown(node, `検証API通信失敗: ${err?.message || String(err)}`);
      return NextResponse.json({ nodes: updatedNodes });
    }
    if (!response.ok) {
      const errText = (await response.text().catch(() => '')).slice(0, 200);
      for (const node of inferenceNodes) safeUnknown(node, `検証APIエラー (${response.status}): ${errText}`);
      return NextResponse.json({ nodes: updatedNodes });
    }
    const data = await response.json();
    const results = new Map<string, any>((data?.inferences || []).map((r: any) => [r.node_id, r]));
    for (const node of inferenceNodes) {
      const result = results.get(node.id);
      if (!result || !['valid','invalid','unknown'].includes(result.status)) {
        safeUnknown(node, '検証器が有効な結果を返しませんでした');
        continue;
      }
      const status = result.status as SymbolicStatus;
      node.symbolic_status = status;
      node.verification_status = uiStatus(status);
      node.verification_evidence = result.counterexample || null;
      if (status === 'valid') delete node.error_reason;
      else node.error_reason = result.reason || (status === 'invalid' ? '反例が確認されました' : '現状の情報では判定できません');
    }
    return NextResponse.json({ nodes: updatedNodes });
  } catch (error: any) {
    console.error('[API Error] Failed to process verification logic:', error);
    return NextResponse.json({ error: 'Internal Server Error during verification',
      details: error?.message || String(error) }, { status: 500 });
  }
}
