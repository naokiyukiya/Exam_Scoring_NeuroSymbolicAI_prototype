import { NextResponse } from 'next/server';
import * as math from 'mathjs';

// ==========================================
// 1. 型定義 (Type Definitions)
// ==========================================

type NodeType = 'proposition' | 'inference';

interface Theorem {
  before: string;
  after: string;
}

interface LogicNode {
  id: string;
  type: NodeType;
  expression?: string;
  theorem?: Theorem;
  input_expression?: string;
  output_expression?: string;
  verification_status?: '未検証' | '問題なし' | '問題あり';
  error_reason?: string; // 💡 追加：どこで問題が起きたかのデバッグ情報
}

interface LogicGraph {
  nodes: LogicNode[];
}

type Scope = Record<string, math.MathNode>;

// ==========================================
// 2. AST操作とパターンマッチング (AST Manipulation)
// ==========================================

function matchAST(pattern: math.MathNode, target: math.MathNode, scope: Scope): boolean {
  if (pattern.type === 'ParenthesisNode') {
    return matchAST((pattern as any).content, target, scope);
  }
  if (target.type === 'ParenthesisNode') {
    return matchAST(pattern, (target as any).content, scope);
  }

  if (pattern.type === 'SymbolNode') {
    const symbolNode = pattern as math.SymbolNode;
    const name = symbolNode.name;
    
    if (scope[name]) {
      return scope[name].toString() === target.toString();
    }
    
    scope[name] = target;
    return true;
  }

  if (pattern.type === 'OperatorNode' && target.type === 'OperatorNode') {
    const pOp = pattern as math.OperatorNode;
    const tOp = target as math.OperatorNode;
    
    if (pOp.op !== tOp.op || pOp.args.length !== tOp.args.length) return false;
    
    for (let i = 0; i < pOp.args.length; i++) {
      if (!matchAST(pOp.args[i], tOp.args[i], scope)) return false;
    }
    return true;
  }

  if (pattern.type === 'ConstantNode' && target.type === 'ConstantNode') {
    return (pattern as math.ConstantNode).value === (target as math.ConstantNode).value;
  }

  if (pattern.type === 'FunctionNode' && target.type === 'FunctionNode') {
    const pFn = pattern as math.FunctionNode;
    const tFn = target as math.FunctionNode;
    
    if (pFn.fn.name !== tFn.fn.name || pFn.args.length !== tFn.args.length) return false;
    for (let i = 0; i < pFn.args.length; i++) {
      if (!matchAST(pFn.args[i], tFn.args[i], scope)) return false;
    }
    return true;
  }

  return false;
}

// ==========================================
// 3. API ルートハンドラ (Next.js Route Handler)
// ==========================================

export async function POST(request: Request) {
  try {
    const graph: LogicGraph = await request.json();

    const updatedNodes = graph.nodes.map((node) => {
      if (node.type !== 'inference') return node;
      if (!node.theorem || !node.input_expression || !node.output_expression) {
        return { 
          ...node, 
          verification_status: '問題あり' as const,
          error_reason: '定理、入力式、または出力式が不足しています'
        };
      }

      try {
        const astPatternBefore = math.parse(node.theorem.before);
        const astPatternAfter = math.parse(node.theorem.after);
        const astInput = math.parse(node.input_expression);
        const astOutput = math.parse(node.output_expression);

        const scope: Scope = {};
        const isMatched = matchAST(astPatternBefore, astInput, scope);

        if (!isMatched) {
          return { 
            ...node, 
            verification_status: '問題あり' as const,
            error_reason: `入力式 "${node.input_expression}" が定理のパターン "${node.theorem.before}" に一致しません`
          };
        }

        const expectedAST = astPatternAfter.transform((n) => {
          if (n.type === 'SymbolNode') {
            const name = (n as math.SymbolNode).name;
            if (scope[name]) {
              return scope[name];
            }
          }
          return n;
        });

        const diffExpression = `(${expectedAST.toString()}) - (${astOutput.toString()})`;
        const simplifiedDiff = math.simplify(diffExpression);
        const isEquivalent = simplifiedDiff.toString() === '0';

        return {
          ...node,
          verification_status: isEquivalent ? '問題なし' : '問題あり',
          error_reason: isEquivalent 
            ? undefined 
            : `期待値: ${expectedAST.toString()} / 実際の出力: ${astOutput.toString()} (差分: ${simplifiedDiff.toString()})`
        };

      } catch (error: any) {
        console.error(`Verification error at node ${node.id}:`, error);
        return { 
          ...node, 
          verification_status: '問題あり' as const,
          error_reason: `数式解析エラー: ${error?.message || String(error)}`
        };
      }
    });

    return NextResponse.json({ nodes: updatedNodes });

  } catch (error) {
    console.error('Invalid JSON payload', error);
    return NextResponse.json({ error: 'Invalid Request Payload' }, { status: 400 });
  }
}