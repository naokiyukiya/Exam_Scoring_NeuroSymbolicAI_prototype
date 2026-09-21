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
// 2. SymPy向け 数式整形ヘルパー (完全修正版)
// =========================================================================
function formatForSympy(str: string): string {
  if (!str) return '';
  
  let s = str.replace(/\(\s*[①-⑳]\s*\)/g, '').replace(/[①-⑳]/g, '').replace(/[…・]/g, '').trim();
  s = s.replace(/\^/g, '**');

  s = s.replace(/≦/g, '<=').replace(/≧/g, '>=');
  s = s.replace(/≤/g, '<=').replace(/≥/g, '>=');

  // 【修正1】連立不等式 (A < B < C) を And(A < B, B < C) に安全に分割
  const compRegex = /([^<>=&|]+)\s*(<=|<|>=|>)\s*([^<>=&|]+)\s*(<=|<|>=|>)\s*([^<>=&|]+)/;
  if (compRegex.test(s)) {
    s = s.replace(compRegex, 'And($1 $2 $3, $3 $4 $5)');
  }

  // 【修正2】ノットイコール ≠ を Ne(A, B) に安全に変換
  const notEqRegex = /([^=<>≠&|]+)\s*≠\s*([^=<>≠&|]+)/g;
  s = s.replace(notEqRegex, 'Ne($1, $2)');

  // 【修正3】または・かつ を SymPy の Or(), And() に安全に変換
  // 例: "A または B" -> "Or(A, B)"
  if (s.includes('または')) {
    const parts = s.split(/\s*または\s*/);
    s = `Or(${parts.join(', ')})`;
  }
  
  if (s.includes('かつ') || s.includes('，') || s.includes(',')) {
    // Orの中身を壊さないように、またはが含まれていない場合のみAndで繋ぐ
    if (!s.startsWith('Or(')) {
      const parts = s.split(/\s*かつ\s*|，|,/);
      s = `And(${parts.join(', ')})`;
    }
  }

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
          
          let sourceStrs = sourcePropositions.map(p => p.label || p.text || '');
          const targetStr = targetPropositions[0].label || targetPropositions[0].text || '';

          // 前提条件（ドメイン）の自動分離
          let domainStr = '';
          let realSourceStrs = sourceStrs;
          
          if (sourceStrs.length > 1) {
            const domainRegex = /^[a-zA-Z0-9\s\-]+[<>≠]\s*-?[0-9a-zA-Z\s\/]+$/;
            const foundDomainIdx = sourceStrs.findIndex(s => domainRegex.test(s));
            if (foundDomainIdx !== -1) {
              domainStr = sourceStrs[foundDomainIdx];
              realSourceStrs = sourceStrs.filter((_, idx) => idx !== foundDomainIdx);
            }
          }

          // 【修正ポイント】先に個々の式を formatForSympy で翻訳してから、最後にカッコで囲んで '&' で繋ぐ！
          const combinedSourceStr = realSourceStrs
            .map(s => formatForSympy(s))
            .map(s => `(${s})`)
            .join(' & ');

          const expr1 = combinedSourceStr;
          const expr2 = formatForSympy(targetStr);
          const domainExpr = domainStr ? formatForSympy(domainStr) : '';

          try {
            // Vercel上のPython (SymPy) APIへ検証リクエストを送信
            const response = await fetch(`${sympyApiUrl}/api/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ expr1, expr2, domain: domainExpr }),
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