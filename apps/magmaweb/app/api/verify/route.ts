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
// 2. SymPy向け 数式整形ヘルパー
// =========================================================================
function formatForSympy(str: string): string {
  if (!str) return '';
  
  // 余計な丸数字や記号を削除
  let s = str
    .replace(/\(\s*[①-⑳]\s*\)/g, '')
    .replace(/[①-⑳]/g, '')
    .replace(/[…・]/g, '')
    .trim();
  
  // SymPyは累乗を ^ ではなく ** で計算するため変換
  s = s.replace(/\^/g, '**');

  // 等式 (A = B) の場合は、差分 (A) - (B) を計算させる形に変換する
  const eqIndex = s.indexOf('=');
  if (eqIndex !== -1 && !s.includes('<') && !s.includes('>')) {
    const lhs = s.substring(0, eqIndex);
    const rhs = s.substring(eqIndex + 1);
    return `(${lhs}) - (${rhs})`;
  }
  
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
                node.error_reason = `SymPy解析: 数学的に等価ではありません (変形ミスまたは論理の飛躍)`;
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