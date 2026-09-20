import { NextResponse } from 'next/server';

// =========================================================================
// 1. 型定義
// =========================================================================
type NodeType = 'proposition' | 'inference' | 'theorem';

interface GraphNode {
  id: string;
  type: NodeType;
  label?: string;
  text?: string;
  verification_status?: '問題なし' | '問題あり' | '未検証';
  error_reason?: string;
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
}

// =========================================================================
// 2. SymPy向け 数式整形ヘルパー (高校数学フルカバー版)
// =========================================================================
function formatForSympy(str: string): string {
  if (!str) return '';
  
  let s = str
    .replace(/\(\s*[①-⑳]\s*\)/g, '')
    .replace(/[①-⑳]/g, '')
    .replace(/[…・]/g, '')
    .trim();
  
  // 累乗
  s = s.replace(/\^/g, '**');

  // 【1】シグマ: Σ[k=1 to n] 2k -> Sum(2k, (k, 1, n))
  s = s.replace(/Σ\[([a-zA-Z]+)=([^\s\]]+)\s+to\s+([^\]]+)\]\s*([a-zA-Z0-9_]+|\([^)]+\))/g, 'Sum($4, ($1, $2, $3))');

  // 【2】定積分: ∫[a to b] x^2 dx -> Integral(x**2, (x, a, b))
  s = s.replace(/∫\[([^\]]+)\s+to\s+([^\]]+)\]\s*(.+?)\s*d([a-zA-Z])/g, 'Integral($3, ($4, $1, $2))');

  // 【3】不定積分: ∫ x^2 dx -> Integral(x**2, x)
  s = s.replace(/∫\s*(.+?)\s*d([a-zA-Z])/g, 'Integral($1, $2)');

  // 【4】極限: lim[x->0] (x^2) -> Limit((x**2), x, 0)
  s = s.replace(/lim\[([a-zA-Z]+)\s*(?:->|→)\s*([^\]]+)\]\s*(.+)/g, 'Limit($3, $1, $2)');

  // 【5】微分: d/dx (x^2) -> Derivative(x**2, x)
  s = s.replace(/d\/d([a-zA-Z])\s*\((.+?)\)/g, 'Derivative($2, $1)');

  // --- 今回追加した高校数学対応 ---

  // 【6】対数: log[a](x) -> log(x, a)
  s = s.replace(/log\[([^\]]+)\]\((.+?)\)/g, 'log($2, $1)');
  
  // 【7】自然対数: ln(x) -> log(x)
  s = s.replace(/ln\((.+?)\)/g, 'log($1)');

  // 【8】絶対値: |x| -> Abs(x)
  s = s.replace(/\|([^|]+)\|/g, 'Abs($1)');

  // 【9】組合せ (nCr): C(n, r) -> binomial(n, r)
  s = s.replace(/C\(([^,]+),\s*([^)]+)\)/g, 'binomial($1, $2)');

  // 【10】順列 (nPr): P(n, r) -> (factorial(n)/factorial(n-r))
  s = s.replace(/P\(([^,]+),\s*([^)]+)\)/g, '(factorial($1)/factorial($1-$2))');

  // ※平方根(sqrt)、三角関数(sin, cos, tan)、階乗(!) は、
  // 後述するAIへの指示で直接出力させることでSymPyがそのまま理解します。

  return s;
}
// =========================================================================
// 3. APIルートハンドラ (SymPy通信版)
// =========================================================================
export async function POST(req: Request) {
  try {
    const graph: LogicGraph = await req.json();
    if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
      return NextResponse.json({ error: 'Invalid Graph Payload' }, { status: 400 });
    }

    const sympyApiUrl = process.env.SYMPY_API_URL;
    if (!sympyApiUrl) {
      throw new Error('SYMPY_API_URL is not configured');
    }

    const updatedNodes = [...graph.nodes];
    const nodeMap = new Map<string, GraphNode>();
    updatedNodes.forEach(node => nodeMap.set(node.id, node));

    // 全てのノードをループし、推論(inference)ノードを探す
    for (const node of updatedNodes) {
      if (node.type === 'inference') {
        const sourceEdges = graph.edges.filter(e => (e.target || e.to) === node.id);
        const sourceNodes = sourceEdges.map(e => nodeMap.get(e.source || e.from as string)).filter(Boolean) as GraphNode[];
        const sourcePropositions = sourceNodes.filter(n => n.type === 'proposition');

        const targetEdges = graph.edges.filter(e => (e.source || e.from) === node.id);
        const targetNodes = targetEdges.map(e => nodeMap.get(e.target || e.to as string)).filter(Boolean) as GraphNode[];
        const targetPropositions = targetNodes.filter(n => n.type === 'proposition');

        // 入力と出力の命題が正しく接続されているか確認
        if (sourcePropositions.length > 0 && targetPropositions.length === 1) {
          
          // 複数の前提条件がある場合は、メインの数式（1つ目）を対象にする
          const sourceStr = sourcePropositions[0].label || sourcePropositions[0].text || '';
          const targetStr = targetPropositions[0].label || targetPropositions[0].text || '';

          const expr1 = formatForSympy(sourceStr);
          const expr2 = formatForSympy(targetStr);

          try {
            // Vercel上のPython (SymPy) APIへ検証リクエストを送信
            const response = await fetch(`${sympyApiUrl}/api/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ expr1, expr2 }),
            });

            if (response.ok) {
              const data = await response.json();
              
              if (data.is_equal) {
                node.verification_status = '問題なし';
                delete node.error_reason; // 成功時はエラー理由を消去
              } else {
                node.verification_status = '問題あり';
                // 【変更】Python側でエラーが起きた場合は、そのエラー内容をそのまま表示する！
                node.error_reason = data.error 
                  ? `SymPyエラー: ${data.error}` 
                  : `SymPy解析: 数学的に等価ではありません (変形ミスまたは論理の飛躍)`;
              }
            } else {
              node.verification_status = '問題あり';
              node.error_reason = `SymPyサーバーエラー (Status: ${response.status})`;
            }
          } catch (apiErr: any) {
            node.verification_status = '問題あり';
            node.error_reason = `SymPy通信エラー: ${apiErr.message}`;
          }

        } else {
          node.verification_status = '問題あり';
          node.error_reason = `グラフ構造エラー (入力: ${sourcePropositions.length}個, 出力: ${targetPropositions.length}個)`;
        }
      }
    }

    return NextResponse.json({ nodes: updatedNodes });

  } catch (error: any) {
    console.error('[API Error] Failed to process verification logic:', error);
    return NextResponse.json(
      { error: 'Internal Server Error during verification', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}