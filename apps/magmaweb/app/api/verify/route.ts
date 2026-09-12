import { NextResponse } from 'next/server';
import { simplify } from 'mathjs';

// =========================================================================
// 1. 型定義 (Type Definitions)
// =========================================================================
type NodeType = 'proposition' | 'inference' | 'theorem';

interface GraphNode {
  id: string;
  type: NodeType;
  label?: string;
  text?: string;
  applied_theorem?: string;
  theorem?: {
    before?: string;
    after?: string;
  };
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
// 2. 数学・前処理ヘルパー関数 (Preprocessors & Math Helpers)
// =========================================================================

const RELATIONAL_OPERATORS = ['≦', '≧', '<=', '>=', '<', '>', '≠', '='];

/**
 * 【制約3: 不等号のスマートな前処理】
 * 命題の文字列に関係演算子が含まれる場合、文字列を左辺 (LHS) と右辺 (RHS) に分割する関数。
 */
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

/**
 * 【制約2: シグマ記号のスマートな前処理（プリプロセッサ）】
 * LaTeX記法のシグマ記号（例: Σ_{k=1}^{n-1} 2k）を検出し、
 * 自然数の和の公式などに基づいて mathjs が解釈できる標準的な多項式表現に展開・置換します。
 */
function preprocessSigma(expr: string): string {
  if (!expr || !expr.includes('Σ')) return expr;

  try {
    // Σ_{変数=下限}^{上限} 本体 のパターンマッチング
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
      // 自然数の和の公式の展開形に置き換えて代数処理を可能にする
      return `((${coeff} * (1 + (${upper})) / 2) * (${upper}))`;
    });
  } catch (e) {
    console.warn('[Sigma Preprocessor Warning] Failed to process sigma expression:', e);
    return expr; // 失敗時は安全のため元の文字列を維持
  }
}

/**
 * 【制約4: 柔軟な代数等価性判定】
 * simplify(期待値 - 実際の値) == 0 を用いて数学的な等価性を判定します。
 */
function isAlgebraicallyEquivalent(expr1: string, expr2: string): { isEquivalent: boolean, diff?: string } {
  if (!expr1 && !expr2) return { isEquivalent: true };
  if (!expr1 || !expr2) return { isEquivalent: false, diff: '一方が空です' };

  try {
    // シグマ等のプリプロセッサを適用してから代数評価にかける
    const processed1 = preprocessSigma(expr1);
    const processed2 = preprocessSigma(expr2);

    if (processed1 === processed2) return { isEquivalent: true };

    const diffExpression = `(${processed1}) - (${processed2})`;
    const simplified = simplify(diffExpression).toString();
    return { isEquivalent: simplified === '0', diff: simplified };
  } catch (error: any) {
    // 【制約5: 数学的な例外処理】
    return { isEquivalent: false, diff: `解析エラー: ${error.message}` };
  }
}

/**
 * 前後の命題の変形が正しいかを検証する総合関数
 */
function verifyPropositionTransition(sourceText: string, targetText: string): { isCorrect: boolean, reason?: string } {
  const sourceParts = splitEquation(sourceText);
  const targetParts = splitEquation(targetText);

  // 両方に等号・不等号が含まれている場合
  if (sourceParts.operator && targetParts.operator) {
    const lhsCheck = isAlgebraicallyEquivalent(sourceParts.lhs, targetParts.lhs);
    const rhsCheck = isAlgebraicallyEquivalent(sourceParts.rhs, targetParts.rhs);
    
    if (lhsCheck.isEquivalent && rhsCheck.isEquivalent) {
      return { isCorrect: true };
    }

    const sourceDiff = `(${sourceParts.lhs}) - (${sourceParts.rhs})`;
    const targetDiff = `(${targetParts.lhs}) - (${targetParts.rhs})`;
    const diffCheck = isAlgebraicallyEquivalent(sourceDiff, targetDiff);
    
    if (diffCheck.isEquivalent) {
      return { isCorrect: true };
    }

    return { isCorrect: false, reason: `左辺差分: ${lhsCheck.diff} / 右辺差分: ${rhsCheck.diff}` };
  }

  // 単一の式の場合
  const check = isAlgebraicallyEquivalent(sourceText, targetText);
  return { isCorrect: check.isEquivalent, reason: check.isEquivalent ? undefined : `数式差分: ${check.diff}` };
}

// =========================================================================
// 3. APIルートハンドラ (Next.js App Router POST Handler)
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
          // 入力側の命題ノードを取得
          const sourceEdges = graph.edges.filter(e => (e.target || e.to) === node.id);
          const sourceNodes = sourceEdges.map(e => nodeMap.get(e.source || e.from as string)).filter(Boolean) as GraphNode[];
          const sourcePropositions = sourceNodes.filter(n => n.type === 'proposition');

          // 出力側のエッジを探索
          const targetEdges = graph.edges.filter(e => (e.source || e.from) === node.id);
          const targetNodes = targetEdges.map(e => nodeMap.get(e.target || e.to as string)).filter(Boolean) as GraphNode[];
          
          // 【制約1: エッジの接続判定】
          // 接続先ノードの type が "theorem"（定理）であるものはカウントから除外（無視）し、
          // "proposition"（命題）のみを1対1の接続判定対象としてカウントします。
          const targetPropositions = targetNodes.filter(n => n.type === 'proposition');

          // 前後ともに命題がちょうど1つずつ存在するか（1対1の接続か）を判定
          if (sourcePropositions.length === 1 && targetPropositions.length === 1) {
            const sourceProp = sourcePropositions[0];
            const targetProp = targetPropositions[0];

            const sourceStr = sourceProp.label || sourceProp.text || '';
            const targetStr = targetProp.label || targetProp.text || '';

            // 【制約4: 定理名の欠落対応】
            // applied_theorem の有無に関わらず、前後の命題が代数的に等価かを直接計算して検証するフォールバック
            const result = verifyPropositionTransition(sourceStr, targetStr);

            node.verification_status = result.isCorrect ? '問題なし' : '問題あり';
            if (!result.isCorrect) {
              node.error_reason = result.reason || '代数的に等価ではありません';
            } else {
              delete node.error_reason; // 問題なしの場合は詳細をクリア
            }
          } else {
            node.verification_status = '問題あり';
            node.error_reason = `命題ノードの1対1接続エラー (入力: ${sourcePropositions.length}個, 出力: ${targetPropositions.length}個)`;
          }
        } catch (nodeError: any) {
          // 【制約5: 数学的な例外処理】
          // 個別ノードの検証中に予期せぬエラーが発生した場合でもAPI全体を落とさず安全に処理
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