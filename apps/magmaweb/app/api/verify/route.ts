import { NextResponse } from 'next/server';
import { simplify } from 'mathjs';

type NodeType = 'proposition' | 'inference';

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

const RELATIONAL_OPERATORS = ['≦', '≧', '<=', '>=', '<', '>', '≠', '='];

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

function isAlgebraicallyEquivalent(expr1: string, expr2: string): { isEquivalent: boolean, diff?: string } {
  if (!expr1 && !expr2) return { isEquivalent: true };
  if (!expr1 || !expr2) return { isEquivalent: false, diff: '一方が空です' };
  try {
    if (expr1 === expr2) return { isEquivalent: true };
    const diffExpression = `(${expr1}) - (${expr2})`;
    const simplified = simplify(diffExpression).toString();
    return { isEquivalent: simplified === '0', diff: simplified };
  } catch (error: any) {
    return { isEquivalent: false, diff: `解析エラー: ${error.message}` };
  }
}

function verifyPropositionTransition(sourceText: string, targetText: string): { isCorrect: boolean, reason?: string } {
  const sourceParts = splitEquation(sourceText);
  const targetParts = splitEquation(targetText);

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

  const check = isAlgebraicallyEquivalent(sourceText, targetText);
  return { isCorrect: check.isEquivalent, reason: check.isEquivalent ? undefined : `数式差分: ${check.diff}` };
}

export async function POST(req: Request) {
  try {
    const graph: LogicGraph = await req.json();
    const updatedNodes = [...graph.nodes];

    const nodeMap = new Map<string, GraphNode>();
    updatedNodes.forEach(node => nodeMap.set(node.id, node));

    for (const node of updatedNodes) {
      if (node.type === 'inference') {
        const sourceEdges = graph.edges.filter(e => (e.target || e.to) === node.id);
        const sourceNodes = sourceEdges.map(e => nodeMap.get(e.source || e.from as string)).filter(Boolean) as GraphNode[];

        const targetEdges = graph.edges.filter(e => (e.source || e.from) === node.id);
        const targetNodes = targetEdges.map(e => nodeMap.get(e.target || e.to as string)).filter(Boolean) as GraphNode[];

        if (sourceNodes.length === 1 && targetNodes.length === 1) {
          const sourceProp = sourceNodes[0];
          const targetProp = targetNodes[0];

          const sourceStr = sourceProp.label || sourceProp.text || '';
          const targetStr = targetProp.label || targetProp.text || '';

          const result = verifyPropositionTransition(sourceStr, targetStr);

          node.verification_status = result.isCorrect ? '問題なし' : '問題あり';
          if (!result.isCorrect) {
            node.error_reason = result.reason || '代数的に等価ではありません';
          } else {
            delete node.error_reason;
          }
        } else {
          node.verification_status = '問題あり';
          node.error_reason = '前後の命題ノードが正しく1対1で接続されていません';
        }
      }
    }

    return NextResponse.json({ nodes: updatedNodes });

  } catch (error) {
    console.error('[API Error] Failed to process verification logic:', error);
    return NextResponse.json(
      { error: 'Internal Server Error during verification' },
      { status: 500 }
    );
  }
}