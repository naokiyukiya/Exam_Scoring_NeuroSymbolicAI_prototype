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

// 【制約3: 不等号のスマートな前処理】
// 「<=」や「≠」はもちろん、全角の「≦」「≧」もキャッチできるよう定義
const RELATIONAL_OPERATORS = ['≦', '≧', '<=', '>=', '<', '>', '≠', '='];

/**
 * 命題の文字列に関係演算子が含まれる場合、文字列を左辺 (LHS) と右辺 (RHS) に分割する関数。
 */
function splitEquation(expression: string): { lhs: string; rhs: string; operator: string | null } {
  // 処理しやすいように空白を除去
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
    // 例: Σ_{k=1}^{n-1} 2k を抽出
    const sigmaRegex = /Σ_\{([a-zA-Z])=([0-9]+)\}\^(?:\{([^}]+)\}|([a-zA-Z0-9\-\+\*\/\(\)]+))\s*([a-zA-Z0-9\*\/\+\-\(\)]+)/g;
    
    return expr.replace(sigmaRegex, (match, varName, lower, upperBrace, upperPlain, body) => {
      // 上限の文字列（n-1 など）を取得
      const upper = upperBrace || upperPlain;
      let coeff = '1';
      
      // シグマの中身（2k など）から係数を取り出す
      if (body.includes(varName)) {
        const cleanedBody = body.replace(new RegExp(varName, 'g'), '').trim();
        if (cleanedBody !== '' && cleanedBody !== '*') {
          coeff = cleanedBody.replace(/\*$/, ''); // 末尾の*を除去して係数を取得
        }
      }
      
      // 自然数の和の公式の展開形 n(n+1)/2 に係数を掛けて代数処理可能な形式に置換
      return `((${coeff} * (1 + (${upper})) / 2) * (${upper}))`;
    });
  } catch (e) {
    console.warn('[Sigma Preprocessor Warning] Failed to process sigma expression:', e);
    return expr; // 置換失敗時は安全のため元の文字列を維持し、パースエラーのキャッチに任せる
  }
}

/**
 * 【制約4: 柔軟な代数等価性判定】
 * simplify(期待値 - 実際の値) == 0 を用いて数学的な等価性を判定します。項の順番の違いも吸収されます。
 */
function isAlgebraicallyEquivalent(expr1: string, expr2: string): { isEquivalent: boolean, diff?: string } {
  if (!expr1 && !expr2) return { isEquivalent: true };
  if (!expr1 || !expr2) return { isEquivalent: false, diff: '一方が空です' };

  try {
    // 【前処理】シグマ等のプリプロセッサを適用してから代数評価にかける
    const processed1 = preprocessSigma(expr1);
    const processed2 = preprocessSigma(expr2);

    if (processed1 === processed2) return { isEquivalent: true };

    const diffExpression = `(${processed1}) - (${processed2})`;
    const simplified = simplify(diffExpression).toString();
    
    return { isEquivalent: simplified === '0', diff: simplified };
  } catch (error: any) {
    // 【制約5: 数学的な例外処理】
    // 0除算や構文エラーなどで mathjs が落ちた場合、APIを落とさずに安全にエラー理由として返却
    return { isEquivalent: false, diff: `解析エラー: ${error.message}` };
  }
}

/**
 * 【制約4: フォールバック処理】
 * 定理名の有無に関わらず、前後の命題の変形が代数的に正しいかを検証する総合関数。
 */
function verifyPropositionTransition(sourceText: string, targetText: string): { isCorrect: boolean, reason?: string } {
  const sourceParts = splitEquation(sourceText);
  const targetParts = splitEquation(targetText);

  // 両方に等号・不等号が含まれている場合
  if (sourceParts.operator && targetParts.operator) {
    // アプローチA: 左辺は左辺、右辺は右辺で独立して変形（展開など）されているか
    const lhsCheck = isAlgebraicallyEquivalent(sourceParts.lhs, targetParts.lhs);
    const rhsCheck = isAlgebraicallyEquivalent(sourceParts.rhs, targetParts.rhs);
    
    if (lhsCheck.isEquivalent && rhsCheck.isEquivalent) {
      return { isCorrect: true };
    }

    // アプローチB: 移項などによる変形 (LHS1 - RHS1) == (LHS2 - RHS2)
    const sourceDiff = `(${sourceParts.lhs}) - (${sourceParts.rhs})`;
    const targetDiff = `(${targetParts.lhs}) - (${targetParts.rhs})`;
    const diffCheck = isAlgebraicallyEquivalent(sourceDiff, targetDiff);
    
    if (diffCheck.isEquivalent) {
      return { isCorrect: true };
    }

    return { isCorrect: false, reason: `左辺差分: ${lhsCheck.diff} / 右辺差分: ${rhsCheck.diff}` };
  }

  // 単一の数式の場合
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
      // 対象を推論ノードに絞る
      if (node.type === 'inference') {
        try {
          // 推論ノードの入力（前提）となる命題ノードを取得
          const sourceEdges = graph.edges.filter(e => (e.target || e.to) === node.id);
          const sourceNodes = sourceEdges.map(e => nodeMap.get(e.source || e.from as string)).filter(Boolean) as GraphNode[];
          const sourcePropositions = sourceNodes.filter(n => n.type === 'proposition');

          // 推論ノードの出力（結論）となるエッジを探索
          const targetEdges = graph.edges.filter(e => (e.source || e.from) === node.id);
          const targetNodes = targetEdges.map(e => nodeMap.get(e.target || e.to as string)).filter(Boolean) as GraphNode[];
          
          // 【制約1: エッジの接続判定（誤検知防止）】
          // 接続先ノードの type が "theorem"（定理）であるものは完全に除外（無視）し、
          // "proposition"（命題）のみをカウントして1対1の接続判定対象とする。
          const targetPropositions = targetNodes.filter(n => n.type === 'proposition');

          // 前後ともに命題がちょうど1つずつ存在するか（1対1の接続か）を判定
          if (sourcePropositions.length === 1 && targetPropositions.length === 1) {
            const sourceProp = sourcePropositions[0];
            const targetProp = targetPropositions[0];

            // 'label' か 'text' かを柔軟に吸収して数式を取得
            const sourceStr = sourceProp.label || sourceProp.text || '';
            const targetStr = targetProp.label || targetProp.text || '';

            // 代数的な等価性検証を実行
            const result = verifyPropositionTransition(sourceStr, targetStr);

            node.verification_status = result.isCorrect ? '問題なし' : '問題あり';
            if (!result.isCorrect) {
              node.error_reason = result.reason || '代数的に等価ではありません';
            } else {
              delete node.error_reason; // 問題なしの場合はエラー理由をクリア
            }
          } else {
            // 命題ノードの接続数が異常な場合
            node.verification_status = '問題あり';
            node.error_reason = `命題ノードの1対1接続エラー (入力: ${sourcePropositions.length}個, 出力: ${targetPropositions.length}個)`;
          }
        } catch (nodeError: any) {
          // 【制約5: 数学的な例外処理】
          // 予期せぬ内部エラーが発生した場合でもAPI全体を落とさず安全に処理
          node.verification_status = '問題あり';
          node.error_reason = `推論ノード検証中の内部エラー: ${nodeError?.message || String(nodeError)}`;
        }
      }
    }

    // フロントエンド側が受け取りやすい形で返却する
    return NextResponse.json({ nodes: updatedNodes });

  } catch (error: any) {
    console.error('[API Error] Failed to process verification logic:', error);
    return NextResponse.json(
      { error: 'Internal Server Error during verification', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}