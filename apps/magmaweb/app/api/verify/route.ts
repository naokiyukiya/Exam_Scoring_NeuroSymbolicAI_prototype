import { NextResponse } from 'next/server';
import * as math from 'mathjs';

// ==========================================
// 1. 型定義 (Type Definitions)
// ==========================================

// グラフノードの基本型
type NodeType = 'proposition' | 'inference';

interface Theorem {
  before: string; // 例: "A * x + B * x"
  after: string;  // 例: "(A + B) * x"
}

interface LogicNode {
  id: string;
  type: NodeType;
  // proposition（命題）用
  expression?: string;
  // inference（推論）用
  theorem?: Theorem;
  input_expression?: string;
  output_expression?: string;
  verification_status?: '未検証' | '問題なし' | '問題あり';
}

interface LogicGraph {
  nodes: LogicNode[];
}

// 抽出された変数を格納するスコープ
type Scope = Record<string, math.MathNode>;

// ==========================================
// 2. AST操作とパターンマッチング (AST Manipulation)
// ==========================================

/**
 * 定理のパターン（pattern）と実際の命題（target）のASTを再帰的に比較し、
 * パターン内の変数（SymbolNode）に該当する部分木を scope に抽出します。
 * 
 * @param pattern 定理の before のASTノード
 * @param target  検証対象の入力命題のASTノード
 * @param scope   抽出した変数を格納するオブジェクト（副作用で更新されます）
 * @returns       マッチングが成功した場合は true、構造が異なる場合は false
 */
function matchAST(pattern: math.MathNode, target: math.MathNode, scope: Scope): boolean {
  // --- A. 括弧ノードのスキップ処理 ---
  // ASTの比較において、単なる括弧は論理構造に影響しないため、中身を取り出して再帰処理します。
  if (pattern.type === 'ParenthesisNode') {
    return matchAST((pattern as any).content, target, scope);
  }
  if (target.type === 'ParenthesisNode') {
    return matchAST(pattern, (target as any).content, scope);
  }

  // --- B. シンボルノード（変数・プレースホルダー）の処理 ---
  // パターン側の変数をプレースホルダーとして扱い、ターゲットの部分木をスコープにバインドします。
  // 例: パターンの "A" に対して、ターゲットの "2 * y" 全体をバインドする。
  if (pattern.type === 'SymbolNode') {
    const symbolNode = pattern as math.SymbolNode;
    const name = symbolNode.name;
    
    // 既に同じ変数がスコープにバインドされている場合
    // 例: "A + A" というパターンの場合、1つ目のAと2つ目のAが同一である必要がある
    if (scope[name]) {
      // ASTの文字列表現が一致するかで等価性を簡易チェック
      return scope[name].toString() === target.toString();
    }
    
    // 未バインドの場合はスコープに登録してマッチ成功とする
    scope[name] = target;
    return true;
  }

  // --- C. 演算子ノードの処理 ---
  // +, -, *, / などの演算子が一致するか確認し、その引数（左右の項など）を再帰的にチェックします。
  if (pattern.type === 'OperatorNode' && target.type === 'OperatorNode') {
    const pOp = pattern as math.OperatorNode;
    const tOp = target as math.OperatorNode;
    
    // 演算子の種類（op）または引数の数が異なる場合はマッチ失敗
    if (pOp.op !== tOp.op || pOp.args.length !== tOp.args.length) return false;
    
    // 子ノード（引数）を順番に再帰評価
    for (let i = 0; i < pOp.args.length; i++) {
      if (!matchAST(pOp.args[i], tOp.args[i], scope)) return false;
    }
    return true;
  }

  // --- D. 定数ノードの処理 ---
  // 1, 2, 3.14 などの定数値が正確に一致するか検証します。
  if (pattern.type === 'ConstantNode' && target.type === 'ConstantNode') {
    return (pattern as math.ConstantNode).value === (target as math.ConstantNode).value;
  }

  // --- E. 関数ノードの処理 ---
  // sin, cos などの関数呼び出しの構造を検証します。
  if (pattern.type === 'FunctionNode' && target.type === 'FunctionNode') {
    const pFn = pattern as math.FunctionNode;
    const tFn = target as math.FunctionNode;
    
    if (pFn.fn.name !== tFn.fn.name || pFn.args.length !== tFn.args.length) return false;
    for (let i = 0; i < pFn.args.length; i++) {
      if (!matchAST(pFn.args[i], tFn.args[i], scope)) return false;
    }
    return true;
  }

  // 上記のいずれにも該当しない（構造が異なる）場合はマッチ失敗
  return false;
}

// ==========================================
// 3. API ルートハンドラ (Next.js Route Handler)
// ==========================================

export async function POST(request: Request) {
  try {
    const graph: LogicGraph = await request.json();

    // グラフ内のすべてのノードを走査
    const updatedNodes = graph.nodes.map((node) => {
      // 推論ノード以外はそのまま返す
      if (node.type !== 'inference') return node;
      if (!node.theorem || !node.input_expression || !node.output_expression) {
        return { ...node, verification_status: '問題あり' as const };
      }

      try {
        // 1. 各数式文字列を mathjs の AST（抽象構文木）にパース
        const astPatternBefore = math.parse(node.theorem.before);
        const astPatternAfter = math.parse(node.theorem.after);
        const astInput = math.parse(node.input_expression);
        const astOutput = math.parse(node.output_expression);

        // 2. パターンマッチングを実行して変数を抽出
        const scope: Scope = {};
        const isMatched = matchAST(astPatternBefore, astInput, scope);

        if (!isMatched) {
          // input_expression が theorem.before の構造に合致しない場合
          return { ...node, verification_status: '問題あり' as const };
        }

        // 3. 抽出した変数を theorem.after に代入し、期待される AST を生成
        // transform メソッドを使用して、パターンの変数を抽出した実態のAST部分木に置換します
        const expectedAST = astPatternAfter.transform((n) => {
          if (n.type === 'SymbolNode') {
            const name = (n as math.SymbolNode).name;
            if (scope[name]) {
              return scope[name]; // 変数ノードを抽出済みの部分木に置き換え
            }
          }
          return n;
        });

        // 4. 生成した期待値(expectedAST) と 実際の出力(astOutput) の代数的な等価性を検証
        // 「(期待値) - (実際の出力)」を計算し、simplify（簡約化）して '0' になるかで判定します。
        const diffExpression = `(${expectedAST.toString()}) - (${astOutput.toString()})`;
        const simplifiedDiff = math.simplify(diffExpression);
        
        // 代数的に等価であれば、差分は '0' になる
        const isEquivalent = simplifiedDiff.toString() === '0';

        // 5. 結果を更新
        return {
          ...node,
          verification_status: isEquivalent ? '問題なし' : '問題あり'
        };

      } catch (error) {
        // パースエラーや簡約化エラーが発生した場合は「問題あり」とする
        console.error(`Verification error at node ${node.id}:`, error);
        return { ...node, verification_status: '問題あり' as const };
      }
    });

    // 更新されたグラフ構造をクライアントへ返却
    return NextResponse.json({ nodes: updatedNodes });

  } catch (error) {
    console.error('Invalid JSON payload', error);
    return NextResponse.json({ error: 'Invalid Request Payload' }, { status: 400 });
  }
}