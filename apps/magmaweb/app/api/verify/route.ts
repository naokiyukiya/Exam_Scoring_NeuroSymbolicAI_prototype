import { NextResponse } from 'next/server';
import { simplify } from 'mathjs';

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
// 2. 数学・前処理ヘルパー関数
// =========================================================================
const RELATIONAL_OPERATORS = ['≦', '≧', '<=', '>=', '<', '>', '≠', '='];

// 【制約3: 不等号のスマートな前処理】
function splitEquation(expression: string): { lhs: string; rhs: string; operator: string | null } {
  const normalized = (expression || '').replace(/\s+/g, '');
  for (const op of RELATIONAL_OPERATORS) {
    const index = normalized.indexOf(op);
    if (index !== -1) {
      return {
        lhs: normalized.substring(0, index),
        rhs: normalized.substring(index + op.length),
        operator: op
      };
    }
  }
  return { lhs: normalized, rhs: '', operator: null };
}

// 【制約2: シグマ記号のスマートな前処理】
function preprocessSigma(expr: string): string {
  if (!expr || !expr.includes('Σ')) return expr;
  try {
    const sigmaRegex = /Σ_\{([a-zA-Z])=([0-9]+)\}\^(?:\{([^}]+)\}|([a-zA-Z0-9\-\+\*\/\(\)]+))\s*([a-zA-Z0-9\*\/\+\-\(\)]+)/g;
    return expr.replace(sigmaRegex, (match, varName, lower, upperBrace, upperPlain, body) => {
      const upper = upperBrace || upperPlain;
      let coeff = '1';
      if (body.includes(varName)) {
        const cleanedBody = body.replace(new RegExp(varName, 'g'), '').trim();
        if (cleanedBody !== '' && cleanedBody !== '*') {
          coeff = cleanedBody.replace(/\*$/, '');
        }
      }
      return `((${coeff} * (1 + (${upper})) / 2) * (${upper}))`;
    });
  } catch (e) {
    return expr;
  }
}

// 【制約4: 柔軟な代数等価性判定（項の順番のズレ許容）】
function isAlgebraicallyEquivalent(expr1: string, expr2: string): { isEquivalent: boolean, diff?: string } {
  if (!expr1 && !expr2) return { isEquivalent: true };
  if (!expr1 || !expr2) return { isEquivalent: false, diff: '一方が空です' };

  try {
    const processed1 = preprocessSigma(expr1);
    const processed2 = preprocessSigma(expr2);
    if (processed1 === processed2) return { isEquivalent: true };

    const diffExpression = `(${processed1}) - (${processed2})`;
    const simplified = simplify(diffExpression).toString();
    return { isEquivalent: simplified === '0', diff: simplified };
  } catch (error: any) {
    // 【制約5: 0除算等の例外処理をキャッチ】
    return { isEquivalent: false, diff: `解析不能な数式または計算エラー: ${error.message}` };
  }
}

// 代数判定の総合関数
function verifyPropositionTransition(sourceText: string, targetText: string): { isCorrect: boolean, reason?: string } {
  const sourceParts = splitEquation(sourceText);
  const targetParts = splitEquation(targetText);

  if (sourceParts.operator && targetParts.operator) {
    const lhsCheck = isAlgebraicallyEquivalent(sourceParts.lhs, targetParts.lhs);
    const rhsCheck = isAlgebraicallyEquivalent(sourceParts.rhs, targetParts.rhs);
    if (lhsCheck.isEquivalent && rhsCheck.isEquivalent) return { isCorrect: true };

    const sourceDiff = `(${sourceParts.lhs}) - (${sourceParts.rhs})`;
    const targetDiff = `(${targetParts.lhs}) - (${targetParts.rhs})`;
    const diffCheck = isAlgebraicallyEquivalent(sourceDiff, targetDiff);
    if (diffCheck.isEquivalent) return { isCorrect: true };

    return { isCorrect: false, reason: `左辺の差分: ${lhsCheck.diff} / 右辺の差分: ${rhsCheck.diff}` };
  }

  const check = isAlgebraicallyEquivalent(sourceText, targetText);
  return { isCorrect: check.isEquivalent, reason: check.isEquivalent ? undefined : `数式差分: ${check.diff}` };
}

// =========================================================================
// 3. APIルートハンドラ
// =========================================================================
export async function POST(req: Request) {
  try {
    const graph: LogicGraph = await req.json();
    if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
      return NextResponse.json({ error: 'Invalid Graph Payload' }, { status: 400 });
    }

    const updatedNodes = [...graph.nodes];
    const nodeMap = new Map<string, GraphNode>();
    updatedNodes.forEach(node => nodeMap.set(node.id, node));

    for (const node of updatedNodes) {
      if (node.type === 'inference') {
        try {
          // 入力側のエッジを取得
          const sourceEdges = graph.edges.filter(e => (e.target || e.to) === node.id);
          const sourceNodes = sourceEdges.map(e => nodeMap.get(e.source || e.from as string)).filter(Boolean) as GraphNode[];
          
          // 【制約1: 定理の完全除外】定理ノードからの入力エッジは無視し、命題のみをカウント
          const sourcePropositions = sourceNodes.filter(n => n.type === 'proposition');

          // 出力側のエッジを取得
          const targetEdges = graph.edges.filter(e => (e.source || e.from) === node.id);
          const targetNodes = targetEdges.map(e => nodeMap.get(e.target || e.to as string)).filter(Boolean) as GraphNode[];
          const targetPropositions = targetNodes.filter(n => n.type === 'proposition');

          // 【制約3: 複数の命題入力への対応分岐】
          if (sourcePropositions.length === 1 && targetPropositions.length === 1) {
            // 通常の 1対1 の変形検証
            const sourceStr = sourcePropositions[0].label || sourcePropositions[0].text || '';
            const targetStr = targetPropositions[0].label || targetPropositions[0].text || '';

            const result = verifyPropositionTransition(sourceStr, targetStr);
            node.verification_status = result.isCorrect ? '問題なし' : '問題あり';
            
            if (!result.isCorrect) node.error_reason = result.reason || '代数的に等価ではありません';
            else delete node.error_reason;

          } else if (sourcePropositions.length > 1 && targetPropositions.length === 1) {
            // 例: 「x > 2」と「x <= 5」を組み合わせて「2 < x <= 5」にするような場合
            // 現在の mathjs では論理式としての結合判定は難しいため、安全にエラー理由を出力して通知
            node.verification_status = '問題あり';
            node.error_reason = `複数の命題（${sourcePropositions.length}個）を組み合わせる推論は、現在自動計算による検証に対応していません`;
          } else {
            // 接続そのものがおかしい場合
            node.verification_status = '問題あり';
            node.error_reason = `命題ノードの接続エラー (入力: ${sourcePropositions.length}個, 出力: ${targetPropositions.length}個)`;
          }
        } catch (nodeError: any) {
          // 【制約5: クラッシュ防止】
          node.verification_status = '問題あり';
          node.error_reason = `推論ノード検証中の内部エラー: ${nodeError?.message || String(nodeError)}`;
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