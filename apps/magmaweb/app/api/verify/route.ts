// 必要なパッケージのインストールコマンド:
// npm install mathjs
// npm install -D @types/mathjs

import { NextResponse } from 'next/server';
import { simplify, parse } from 'mathjs';

/**
 * グラフのノードの型定義
 */
type NodeType = 'proposition' | 'inference';

interface GraphNode {
  id: string;
  type: NodeType;
  text: string;           // 命題の数式、または推論の内容（例：「右辺を展開する」）
  applied_theorem?: string; // 適用された定理（存在しない場合もある）
  verification_status?: '問題なし' | '問題あり' | '未検証';
}

interface GraphEdge {
  source: string; // 送り元のノードID
  target: string; // 受け先のノードID
}

interface LogicGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * 【不等号の分割処理】
 * 命題の文字列に関係演算子（≦, ≧, <, >, ≠, =）が含まれる場合、
 * 文字列を左辺 (LHS) と右辺 (RHS) に分割するヘルパー関数。
 * 
 * mathjsは方程式や不等式自体をパースするよりも、純粋な代数式（式単体）の
 * 評価に長けているため、事前に関係演算子で式を分割して扱うのが最も安全かつスマートです。
 */
const RELATIONAL_OPERATORS = ['≦', '≧', '<=', '>=', '<', '>', '≠', '='];

function splitEquation(expression: string): { lhs: string; rhs: string; operator: string | null } {
  // 空白を取り除いて正規化
  const normalized = expression.replace(/\s+/g, '');
  
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
  
  // 演算子が見つからない場合は単一の式として扱う
  return { lhs: normalized, rhs: '', operator: null };
}

/**
 * 【柔軟な等価性チェック ＆ 例外処理（クラッシュ防止）】
 * 2つの数式（文字列）が代数的に等価であるかを判定します。
 * `simplify(期待される数式 - 実際の次ステップの数式) == 0` をコアロジックとして採用。
 */
function isAlgebraicallyEquivalent(expr1: string, expr2: string): boolean {
  if (!expr1 && !expr2) return true; // 両方空なら等価
  if (!expr1 || !expr2) return false;

  try {
    // 例外処理1: 分母が明示的なゼロなどの構文・評価エラーをパース段階でキャッチ
    // 例外処理2: mathjsのAST構築時の予期せぬエラーを防ぐため try-catch で保護
    
    // 単純な文字列一致なら即座にtrue (処理コスト削減)
    if (expr1 === expr2) return true;

    // 差分をとって simplify するコアロジック
    const diffExpression = `(${expr1}) - (${expr2})`;
    const simplified = simplify(diffExpression).toString();

    // 差が0になれば代数的に等価
    return simplified === '0';
  } catch (error) {
    // 例外処理3: 「6/(x-2)」のx=2代入時のようなゼロ除算や、
    // 無効な数式フォーマット（全角文字の混入など）によるパース失敗時は
    // APIをクラッシュさせず、安全に「等価ではない（検証失敗）」として扱う。
    console.warn(`[Math Verification Error] Failed to evaluate equivalence between "${expr1}" and "${expr2}":`, error);
    return false;
  }
}

/**
 * 2つの命題（関係演算子を含む場合もある）が論理的に等価に変形されているか検証します。
 */
function verifyPropositionTransition(sourceText: string, targetText: string): boolean {
  const sourceParts = splitEquation(sourceText);
  const targetParts = splitEquation(targetText);

  // 両方に等号/不等号が含まれている場合
  if (sourceParts.operator && targetParts.operator) {
    // パターン1: 左辺は左辺、右辺は右辺で独立して変形（展開など）されているか
    const isLhsEquivalent = isAlgebraicallyEquivalent(sourceParts.lhs, targetParts.lhs);
    const isRhsEquivalent = isAlgebraicallyEquivalent(sourceParts.rhs, targetParts.rhs);
    
    if (isLhsEquivalent && isRhsEquivalent) {
      return true;
    }

    // パターン2: 移項などによる変形 (LHS1 - RHS1) == (LHS2 - RHS2)
    const sourceDiff = `(${sourceParts.lhs}) - (${sourceParts.rhs})`;
    const targetDiff = `(${targetParts.lhs}) - (${targetParts.rhs})`;
    if (isAlgebraicallyEquivalent(sourceDiff, targetDiff)) {
      return true;
    }

    return false;
  }

  // 演算子がない単一の式としての変形の場合
  return isAlgebraicallyEquivalent(sourceText, targetText);
}

/**
 * Next.js App Router API Route ハンドラ
 */
export async function POST(req: Request) {
  try {
    const graph: LogicGraph = await req.json();
    const updatedNodes = [...graph.nodes];

    // ノードをIDで引けるようにマップ化（関係性の検索用）
    const nodeMap = new Map<string, GraphNode>();
    updatedNodes.forEach(node => nodeMap.set(node.id, node));

    // グラフ内の「推論ノード」を対象に検証処理を実行
    for (const node of updatedNodes) {
      if (node.type === 'inference') {
        // 推論ノードの入力（前提）となる命題ノードを取得
        const sourceEdges = graph.edges.filter(e => e.target === node.id);
        const sourceNodes = sourceEdges.map(e => nodeMap.get(e.source)).filter(Boolean) as GraphNode[];

        // 推論ノードの出力（結論）となる命題ノードを取得
        const targetEdges = graph.edges.filter(e => e.source === node.id);
        const targetNodes = targetEdges.map(e => nodeMap.get(e.target)).filter(Boolean) as GraphNode[];

        if (sourceNodes.length === 1 && targetNodes.length === 1) {
          const sourceProp = sourceNodes[0];
          const targetProp = targetNodes[0];

          // 【定理名がない推論ノードの救済】
          // node.applied_theorem の有無に関わらず、前後の命題ノードの数式(text)を抽出し、
          // 直接 simplify を使った代数等価性チェックにフォールバックする。
          // これにより、ASTの厳密なパターンマッチングに依存しない柔軟な判定が実現されます。
          const isCorrect = verifyPropositionTransition(sourceProp.text, targetProp.text);

          // 【ステータス更新】
          node.verification_status = isCorrect ? '問題なし' : '問題あり';
        } else {
          // 複数の前提や結論を持つ複雑な推論（本実装のスコープ外とするか、適宜拡張）の場合は
          // 一旦「問題あり（解析不能）」としてマーク
          node.verification_status = '問題あり';
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        nodes: updatedNodes,
        edges: graph.edges
      }
    });

  } catch (error) {
    // API全体のクラッシュを防ぐトップレベルの例外処理
    console.error('[API Error] Failed to process verification logic:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error during verification' },
      { status: 500 }
    );
  }
}