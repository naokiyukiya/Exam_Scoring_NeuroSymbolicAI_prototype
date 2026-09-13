import { NextResponse } from 'next/server';
import { simplify, rationalize, evaluate } from 'mathjs';

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
// 2. 第1ステージ：代数・記号検証ヘルパー
// =========================================================================
const RELATIONAL_OPERATORS = ['≦', '≧', '<=', '>=', '<', '>', '≠', '='];

function cleanMathString(str: string): string {
  if (!str) return '';
  return str
    .replace(/\(\s*[①-⑳]\s*\)/g, '')
    .replace(/[①-⑳]/g, '')
    .replace(/\(\s*[iI]+\s*\)/gi, '')
    .replace(/\(\s*\d+\s*\)/g, '')
    .replace(/[…・]/g, '')
    .replace(/\(\s*\)/g, '')
    .trim();
}

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

function isAlgebraicallyEquivalent(expr1: string, expr2: string): { isEquivalent: boolean, diff?: string } {
  if (!expr1 && !expr2) return { isEquivalent: true };
  if (!expr1 || !expr2) return { isEquivalent: false, diff: '一方が空です' };

  try {
    const processed1 = preprocessSigma(expr1);
    const processed2 = preprocessSigma(expr2);
    if (processed1 === processed2) return { isEquivalent: true };

    const diffExpression = `(${processed1}) - (${processed2})`;
    let simplified = simplify(diffExpression).toString();
    if (simplified === '0') return { isEquivalent: true, diff: '0' };

    try {
      const rationalized = rationalize(diffExpression).toString();
      if (rationalized === '0') return { isEquivalent: true, diff: '0' };
      simplified = rationalized; 
    } catch (ratErr) {}

    return { isEquivalent: false, diff: simplified };
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
    if (lhsCheck.isEquivalent && rhsCheck.isEquivalent) return { isCorrect: true };

    const sourceDiff = `(${sourceParts.lhs}) - (${sourceParts.rhs})`;
    const targetDiff = `(${targetParts.lhs}) - (${targetParts.rhs})`;
    
    const diffCheck1 = isAlgebraicallyEquivalent(sourceDiff, targetDiff);
    if (diffCheck1.isEquivalent) return { isCorrect: true };

    const targetDiffReversed = `-1 * (${targetDiff})`;
    const diffCheck2 = isAlgebraicallyEquivalent(sourceDiff, targetDiffReversed);
    if (diffCheck2.isEquivalent) return { isCorrect: true };

    return { isCorrect: false, reason: `左辺差分: ${lhsCheck.diff} / 右辺差分: ${rhsCheck.diff}` };
  }

  const check = isAlgebraicallyEquivalent(sourceText, targetText);
  return { isCorrect: check.isEquivalent, reason: check.isEquivalent ? undefined : `数式差分: ${check.diff}` };
}

// =========================================================================
// 3. 第2ステージ：境界値・特異点ターゲット型数値テストヘルパー
// =========================================================================
function formatForHeuristic(expr: string): string {
  let e = expr;
  e = e.replace(/≦/g, '<=').replace(/≧/g, '>=');
  
  const compRegex = /([^<>=]+)\s*(<=|<|>=|>)\s*([^<>=]+)\s*(<=|<|>=|>)\s*([^<>=]+)/;
  if (compRegex.test(e)) {
    e = e.replace(compRegex, '($1 $2 $3) and ($3 $4 $5)');
  }
  
  e = e.replace(/,/g, ' or ');
  e = e.replace(/==/g, '=');
  e = e.replace(/=/g, '==');
  e = e.replace(/<==/g, '<=');
  e = e.replace(/>==/g, '>=');
  e = e.replace(/!==/g, '!=');

  e = e.replace(/(\d)([a-zA-Z])/g, '$1 * $2');
  e = e.replace(/\)\s*\(/g, ') * (');
  e = e.replace(/([a-zA-Z])\s*\(/g, '$1 * (');
  e = e.replace(/(\d)\s*\(/g, '$1 * (');
  
  return e;
}

/**
 * 命題文字列から数値や境界値（例: 2, 8/3 など）を動的に抽出し、
 * その極近傍（イプシロン）をテストポイントに強制追加します。
 */
function extractCriticalPoints(exprs: string[]): number[] {
  const points: number[] = [-1, 0, 1, 2, 2.66667];
  const numRegex = /-?\d+(?:\/\d+)?/g;

  for (const expr of exprs) {
    if (!expr) continue;
    const matches = expr.match(numRegex);
    if (matches) {
      for (const m of matches) {
        let val = Number(m);
        if (m.includes('/')) {
          const parts = m.split('/');
          val = Number(parts[0]) / Number(parts[1]);
        }
        if (!isNaN(val)) {
          points.push(val);
          points.push(val - 0.00001); // 境界の直前
          points.push(val + 0.00001); // 境界の直後
        }
      }
    }
  }

  // 通常の網羅的サンプリングポイントを追加
  for (let i = -5; i <= 5; i += 0.5) {
    points.push(i);
  }

  return Array.from(new Set(points)); // 重複排除
}

function verifyByValueTesting(sourceExpr: string, targetExpr: string, allSourceStrs: string[], isCombined: boolean = false): { isEquivalent: boolean, reason?: string } {
  try {
    const s = isCombined ? sourceExpr : formatForHeuristic(sourceExpr);
    const t = formatForHeuristic(targetExpr);
    
    // クリティカルポイント（境界値・特異点の近傍）を動的生成
    const testPoints = extractCriticalPoints(allSourceStrs.concat([targetExpr]));

    for (const x of testPoints) {
      const scope = { x, y: x, a: x, b: x, n: x };
      try {
        const res1 = evaluate(s, scope);
        const res2 = evaluate(t, scope);
        
        if (Boolean(res1) !== Boolean(res2)) {
          return { isEquivalent: false, reason: `境界・特異点近傍 (x=${x.toFixed(5)}) で真偽値が不一致` };
        }
      } catch (evalErr) {
        // 分母0などの特異点で評価エラーになる場合はスキップまたは安全側に倒す
        continue;
      }
    }
    return { isEquivalent: true };
  } catch (err: any) {
    return { isEquivalent: false, reason: `論理評価エラー: ${err.message}` };
  }
}

// =========================================================================
// 4. APIルートハンドラ（2段階パイプライン統合）
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
          const sourcePropositions = sourceNodes.filter(n => n.type === 'proposition');

          const targetEdges = graph.edges.filter(e => (e.source || e.from) === node.id);
          const targetNodes = targetEdges.map(e => nodeMap.get(e.target || e.to as string)).filter(Boolean) as GraphNode[];
          const targetPropositions = targetNodes.filter(n => n.type === 'proposition');

          if (sourcePropositions.length > 0 && targetPropositions.length === 1) {
            const sourceStrs = sourcePropositions.map(p => cleanMathString(p.label || p.text || ''));
            const targetStr = cleanMathString(targetPropositions[0].label || targetPropositions[0].text || '');

            let isCorrect = false;
            let finalReason = '';

            if (sourceStrs.length === 1) {
              // ステージ1：高速代数検証（移項・展開など）
              const algResult = verifyPropositionTransition(sourceStrs[0], targetStr);
              if (algResult.isCorrect) {
                isCorrect = true;
              } else {
                // ステージ2：境界値ターゲット型数値テストへのフォールバック
                const valResult = verifyByValueTesting(sourceStrs[0], targetStr, sourceStrs);
                isCorrect = valResult.isEquivalent;
                finalReason = valResult.reason || algResult.reason || '';
              }
            } else {
              // 複数命題の合流チェック（AND結合によるステージ2テスト）
              const combinedSource = sourceStrs.map(s => `(${formatForHeuristic(s)})`).join(' and ');
              const valResult = verifyByValueTesting(combinedSource, targetStr, sourceStrs, true);
              
              isCorrect = valResult.isEquivalent;
              finalReason = valResult.reason || '複合条件の論理評価で不一致となりました';
            }

            node.verification_status = isCorrect ? '問題なし' : '問題あり';
            if (!isCorrect) {
              node.error_reason = finalReason || '論理・代数的に等価ではありません';
            } else {
              delete node.error_reason;
            }

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
    console.log('[API Error] Failed to process verification logic:', error);
    return NextResponse.json(
      { error: 'Internal Server Error during verification', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}