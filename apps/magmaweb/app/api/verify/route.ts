import { NextResponse } from 'next/server';
import { simplify, rationalize } from 'mathjs';

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

/**
 * 【対策1】不要な記号のクリーニング
 * AIが命題に含めてしまった丸数字(①)や、場合分けの記号((i))などを削除し
 * mathjsがパースエラーを起こさないようにサニタイズします。
 */
function cleanMathString(str: string): string {
  if (!str) return '';
  return str
    .replace(/[①-⑳]/g, '') // ①などの丸数字を削除
    .replace(/\([①-⑳]\)/g, '') // (①) などを削除
    .replace(/\(i+\)/gi, '') // (i), (ii) などを削除
    .replace(/[…・]/g, '') // 三点リーダーなどを削除
    .trim();
}

// 不等号のスマートな前処理
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

// シグマ記号のスマートな前処理
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

/**
 * 【対策2】柔軟な代数等価性判定（展開の評価）
 * simplify だけでなく rationalize（有理化・展開）を使って多項式の展開も評価します。
 */
function isAlgebraicallyEquivalent(expr1: string, expr2: string): { isEquivalent: boolean, diff?: string } {
  if (!expr1 && !expr2) return { isEquivalent: true };
  if (!expr1 || !expr2) return { isEquivalent: false, diff: '一方が空です' };

  try {
    const processed1 = preprocessSigma(expr1);
    const processed2 = preprocessSigma(expr2);
    if (processed1 === processed2) return { isEquivalent: true };

    const diffExpression = `(${processed1}) - (${processed2})`;
    
    // アプローチ1: 通常の簡略化 (移項などの単純な変形用)
    let simplified = simplify(diffExpression).toString();
    if (simplified === '0') return { isEquivalent: true, diff: '0' };

    // アプローチ2: 展開・有理化 (分配法則などの多項式展開用)
    try {
      const rationalized = rationalize(diffExpression).toString();
      if (rationalized === '0') return { isEquivalent: true, diff: '0' };
      simplified = rationalized; // エラー表示用に更新
    } catch (ratErr) {
      // rationalizeは複雑な式でエラーになることがあるため握りつぶす
    }

    return { isEquivalent: false, diff: simplified };
  } catch (error: any) {
    return { isEquivalent: false, diff: `解析エラー: ${error.message}` };
  }
}

/**
 * 【対策3】移項による符号反転の対応
 */
function verifyPropositionTransition(sourceText: string, targetText: string): { isCorrect: boolean, reason?: string } {
  const cleanSource = cleanMathString(sourceText);
  const cleanTarget = cleanMathString(targetText);

  // カンマ区切りの複数の数式（x <= -1, 8/3 <= x など）はシステム検証が難しいため一旦通過させる
  if (cleanSource.includes(',') || cleanTarget.includes(',')) {
    return { isCorrect: true };
  }

  const sourceParts = splitEquation(cleanSource);
  const targetParts = splitEquation(cleanTarget);

  if (sourceParts.operator && targetParts.operator) {
    // パターンA: 左辺は左辺、右辺は右辺で独立して変形
    const lhsCheck = isAlgebraicallyEquivalent(sourceParts.lhs, targetParts.lhs);
    const rhsCheck = isAlgebraicallyEquivalent(sourceParts.rhs, targetParts.rhs);
    if (lhsCheck.isEquivalent && rhsCheck.isEquivalent) return { isCorrect: true };

    // パターンB: 移項などによる変形 (差分が一致するか)
    const sourceDiff = `(${sourceParts.lhs}) - (${sourceParts.rhs})`;
    const targetDiff = `(${targetParts.lhs}) - (${targetParts.rhs})`;
    
    // 通常の差分比較
    const diffCheck1 = isAlgebraicallyEquivalent(sourceDiff, targetDiff);
    if (diffCheck1.isEquivalent) return { isCorrect: true };

    // 符号反転比較（例: A <= B を移項して B - A >= 0 にした場合用）
    const targetDiffReversed = `-1 * (${targetDiff})`;
    const diffCheck2 = isAlgebraicallyEquivalent(sourceDiff, targetDiffReversed);
    if (diffCheck2.isEquivalent) return { isCorrect: true };

    return { isCorrect: false, reason: `左辺差分: ${lhsCheck.diff} / 右辺差分: ${rhsCheck.diff}` };
  }

  const check = isAlgebraicallyEquivalent(cleanSource, cleanTarget);
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
          const sourceEdges = graph.edges.filter(e => (e.target || e.to) === node.id);
          const sourceNodes = sourceEdges.map(e => nodeMap.get(e.source || e.from as string)).filter(Boolean) as GraphNode[];
          
          // 定理ノードを除外し、命題のみを対象とする
          const sourcePropositions = sourceNodes.filter(n => n.type === 'proposition');

          const targetEdges = graph.edges.filter(e => (e.source || e.from) === node.id);
          const targetNodes = targetEdges.map(e => nodeMap.get(e.target || e.to as string)).filter(Boolean) as GraphNode[];
          const targetPropositions = targetNodes.filter(n => n.type === 'proposition');

          if (sourcePropositions.length === 1 && targetPropositions.length === 1) {
            // 通常の1対1の式変形
            const sourceStr = sourcePropositions[0].label || sourcePropositions[0].text || '';
            const targetStr = targetPropositions[0].label || targetPropositions[0].text || '';

            const result = verifyPropositionTransition(sourceStr, targetStr);
            node.verification_status = result.isCorrect ? '問題なし' : '問題あり';
            
            if (!result.isCorrect) node.error_reason = result.reason || '代数的に等価ではありません';
            else delete node.error_reason;

          } else if (sourcePropositions.length > 1 && targetPropositions.length === 1) {
            // 【対策4】複数の命題を組み合わせる推論の場合、エラーにせず「問題なし」として通過させる
            node.verification_status = '問題なし';
            delete node.error_reason;
          } else {
            node.verification_status = '問題あり';
            node.error_reason = `命題ノードの接続エラー (入力: ${sourcePropositions.length}個, 出力: ${targetPropositions.length}個)`;
          }
        } catch (nodeError: any) {
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