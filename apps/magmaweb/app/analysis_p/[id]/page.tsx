'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

// KaTeX の CSS とコンポーネントを読み込み
import 'katex/dist/katex.min.css'
import { InlineMath, BlockMath } from 'react-katex'

import AnswerCard from '../../../components/AnswerCard'
import DagVisualizer from '../../../components/DagVisualizer'
import TheoremDetailRenderer from '../../../components/theorems/TheoremDetailRenderer'

// physics.json を直接インポート
import physicsData from '../../../lib/constants/physics.json'

import { 
  CircleArrowLeft, 
  Layers, 
  AlertTriangle, 
  Footprints, 
  X, 
  ArrowLeft, 
  ArrowRight, 
  BookOpen, 
  Sparkles,
  Flame,
  CheckCircle2,
  FileCode,
  Compass
} from 'lucide-react'

// 数式テキスト（$...$ または $$...$$）が含まれている場合に KaTeX で表示するヘルパーコンポーネント
function FormattedText({ text }: { text: string }) {
  if (!text) return null;

  const parts = text.split(/(\$[^\$]+\$)/g);

  return (
    <span>
      {parts.map((part, index) => {
        if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
          const mathContent = part.slice(1, -1);
          return <InlineMath key={index} math={mathContent} />;
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
}

type Node = {
  id: string
  label: string
  type: 'proposition' | 'inference' | 'theorem'
  sub_question?: string
  is_final_answer?: boolean
  inputs_used?: Record<string, string>
  outputs_derived?: Record<string, string>
  verification_status?: string
  _client_verification_status?: 'unverified' | 'verifying' | 'correct' | 'incorrect' | 'error' | 'skipped'
  _client_debug_info?: string // ★ SymPyがどう判定したかの原因を保持
  math_expr?: string
}

type Edge = {
  from: string
  to: string
}

type GraphData = {
  nodes: Array<Node>
  edges: Array<Edge>
}

// physics.json からノードに該当する定義を検索するヘルパー関数
function findPhysicsTheorem(node: Node) {
  if (!node) return null;
  const list = Array.isArray(physicsData) ? physicsData : (physicsData as any).theorems || [];
  
  return list.find((t: any) => 
    t.id === node.id || 
    t.name === node.label || 
    (node.label && t.name && node.label.includes(t.name)) ||
    (node.label && t.name && t.name.includes(node.label))
  );
}

export default function AnalysisPhysicsPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const [answerData, setAnswerData] = useState<any>(null)
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [rawGraphData, setRawGraphData] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [isVerifying, setIsVerifying] = useState(false)

  // 一歩ごとの解説モード用のステート
  const [isStepViewerOpen, setIsStepViewerOpen] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  // クエリパラメータ ?theorem=xxx から選択中の定理IDを取得
  const selectedTheoremId = searchParams.get('theorem')

  const [selectedTheorem, setSelectedTheorem] = useState<string | null>(null)

  // デバッグ用ステート
  const [debugError, setDebugError] = useState<string | null>(null)
  const [debugDetails, setDebugDetails] = useState<string | null>(null)
  const [debugRawText, setDebugRawText] = useState<string | null>(null)

  //スクロール防止！
  // モーダルが開いているか判定
const isAnyModalOpen = Boolean(isStepViewerOpen || selectedTheoremId || selectedTheorem);

// モーダル表示時に背景（body）のスクロールをロック
useEffect(() => {
  if (isAnyModalOpen) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }

  return () => {
    document.body.style.overflow = '';
  };
}, [isAnyModalOpen]);

  useEffect(() => {
    async function loadAnalysisData() {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        const { data: post, error: pError } = await supabase
          .from('posts')
          .select(`
            id,
            image_url,
            type,
            anonymous,
            created_at,
            user_id,
            parent_id,
            profiles ( handle )
          `)
          .eq('id', params.id)
          .single()

        if (pError) throw pError
        setAnswerData(post)

        const res = await fetch(`/api/analyze/physics?answerId=${params.id}`, {
          method: 'GET',
        })

        const json = await res.json()

        if (!res.ok) {
          setDebugError(`APIがエラーステータス ${res.status} を返しました`)
          setDebugDetails(json.error + (json.details ? `\n${json.details}` : ''))
          return
        }

        if (json.error) {
          setDebugError(json.error)
          if (json.rawText) setDebugRawText(json.rawText)
          return
        }
        
        if (json.graph) {
          const nodesWithClientStatus = json.graph.nodes.map((n: Node) => 
            n.type === 'inference' ? { ...n, _client_verification_status: 'unverified' } : n
          );
          const newGraph = { ...json.graph, nodes: nodesWithClientStatus };

          setGraphData(newGraph)
          
          const formattedJson = JSON.stringify({
            graph: newGraph,
            new_theorems: json.newTheorems || []
          }, null, 2)
          setRawGraphData(formattedJson)
        }

      } catch (e: any) {
        console.error('物理診断書データ同期エラー:', e)
        setDebugError('フロントエンドの処理中に例外が発生しました')
        setDebugDetails(e?.message || String(e))
      } finally {
        setLoading(false)
      }
    }

    loadAnalysisData()
  }, [params.id])

  const handleVerify = async () => {
    if (!graphData) return
    setIsVerifying(true)
    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(graphData),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || '検証に失敗しました')
      }

      if (json.nodes) {
        setGraphData(prev => prev ? { ...prev, nodes: json.nodes } : prev)
        const formattedJson = JSON.stringify({
          graph: { ...graphData, nodes: json.nodes },
        }, null, 2)
        setRawGraphData(formattedJson)
      }
    } catch (e: any) {
      console.error('物理検証エラー:', e)
      alert(e?.message || '検証中にエラーが発生しました')
    } finally {
      setIsVerifying(false)
    }
  }

  // クエリ制御用関数
  const handleOpenTheorem = (theoremId: string) => {
    const p = new URLSearchParams(searchParams.toString())
    p.set('theorem', theoremId)
    router.push(`${pathname}?${p.toString()}`, { scroll: false })
  }

  const handleCloseTheorem = () => {
    const p = new URLSearchParams(searchParams.toString())
    p.delete('theorem')
    router.push(`${pathname}?${p.toString()}`, { scroll: false })
  }

  const inferenceNodes = graphData?.nodes.filter(n => n.type === 'inference') || []
  const currentInference = inferenceNodes[currentStepIndex]

  const inputNodeIds = graphData?.edges.filter(e => e.to === currentInference?.id).map(e => e.from) || []
  const outputNodeIds = graphData?.edges.filter(e => e.from === currentInference?.id).map(e => e.to) || []

  const inputNodes = graphData?.nodes.filter(n => inputNodeIds.includes(n.id)) || []
  const outputNodes = graphData?.nodes.filter(n => outputNodeIds.includes(n.id)) || []

  // 現在のステップで physics.json に登録されている定理・法則を抽出
  const currentStepTheoremMatch = inputNodes
    .map(node => ({ node, theorem: findPhysicsTheorem(node) }))
    .find(item => item.theorem !== null)

  const primaryTheorem = currentStepTheoremMatch?.theorem

  // ------------------------------------------------------------------------
  // 🐾 「代数計算・連立方程式の消去」を検知して自動検証を走らせる useEffect
  // ------------------------------------------------------------------------
  useEffect(() => {
    if (!isStepViewerOpen || !currentInference) return;

    // 「代数計算・連立方程式の消去」という定理がこの推論に繋がっているか確認
    const hasAlgebra = inputNodes.some(n => n.label.includes('代数計算・連立方程式の消去'));

    // まだ検証されていない場合のみ自動実行する
    if (hasAlgebra && currentInference._client_verification_status === 'unverified') {
      const runVerification = async () => {
        // UIを「検証中」にする
        setGraphData(prev => {
          if (!prev) return prev;
          const newNodes = prev.nodes.map(n => 
            n.id === currentInference.id ? { ...n, _client_verification_status: 'verifying' } as Node : n
          );
          return { ...prev, nodes: newNodes };
        });

        // ==========================================
        // 🚀 SymPy用の最強サニタイズ処理
        // ==========================================
        const extractAndFormatMath = (text: string) => {
          if (!text) return '';
          
          let expr = text;
          
          // 1. $ で囲まれた部分があればそれを抽出
          const mathMatch = text.match(/\$([^\$]+)\$/);
          if (mathMatch) {
            expr = mathMatch[1];
          } else {
            // $がない場合、日本語を削除して数式っぽく見える部分だけ残す
            expr = expr.replace(/[^\x00-\x7F]/g, '').trim(); 
          }

          // 2. 比較演算子・四則演算子の正規化
          expr = expr
            .replace(/≧/g, '>=')
            .replace(/≦/g, '<=')
            .replace(/≠/g, '!=')
            .replace(/×/g, '*')
            .replace(/÷/g, '/');

          // 3. LaTeX特有のコマンドを Python の数式表現に置換
          expr = expr
            .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '(($1)/($2))')
            .replace(/\\times/g, '*')
            .replace(/\\div/g, '/')
            .replace(/\\pi/g, 'pi')
            .replace(/\\/g, '');

          // 4. SymPy がクラッシュする原因となる「予約語」や「文字」の置換
          expr = expr.replace(/'/g, '_prime');
          
          expr = expr.replace(/\bS\b/g, 'Area_S')
                     .replace(/\bI\b/g, 'Current_I')
                     .replace(/\bE\b/g, 'Energy_E')
                     .replace(/\bN\b/g, 'Normal_N')
                     .replace(/\bO\b/g, 'Origin_O');

          return expr;
        };

        const inputProps = inputNodes
          .filter(n => n.type === 'proposition')
          .map(n => extractAndFormatMath(n.label))
          .filter(expr => expr.includes('=') || expr.includes('>') || expr.includes('<')); 
          
        const outputProps = outputNodes
          .filter(n => n.type === 'proposition')
          .map(n => extractAndFormatMath(n.label))
          .filter(expr => expr.includes('=') || expr.includes('>') || expr.includes('<'));

        if (inputProps.length === 0 || outputProps.length === 0) {
          setGraphData(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              nodes: prev.nodes.map(n => n.id === currentInference.id ? { 
                ...n, 
                _client_verification_status: 'skipped',
                _client_debug_info: '有効な等式・不等式が見つかりませんでした（前提または結果に数式が含まれていません）。'
              } as Node : n)
            };
          });
          return;
        }

        const expr1 = inputProps.join(' & ');
        const expr2 = outputProps.join(' & ');

        try {
          const res = await fetch('/api/verify', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ expr1, expr2 })
          });
          
          const result = await res.json();
          const isEq = res.ok && result.is_equal;
          
          // ★ SymPyに何を送り、どう判断されたかを詳細に記録
          const debugInfo = `送信前(Inputs): [${expr1}] | 送信後(Outputs): [${expr2}] | 判定結果: ${isEq ? '一致 (Correct)' : '不一致 (Incorrect)'} ${result.error ? `| SymPyエラー: ${result.error}` : ''}`;

          setGraphData(prev => {
            if (!prev) return prev;
            const newNodes = prev.nodes.map(n => {
              if (n.id === currentInference.id) {
                return { 
                  ...n, 
                  _client_verification_status: isEq ? 'correct' : 'incorrect',
                  _client_debug_info: debugInfo
                } as Node;
              }
              return n;
            });
            return { ...prev, nodes: newNodes };
          });
        } catch (err: any) {
          setGraphData(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              nodes: prev.nodes.map(n => n.id === currentInference.id ? { 
                ...n, 
                _client_verification_status: 'error',
                _client_debug_info: `通信例外エラー: ${err?.message || String(err)}`
              } as Node : n)
            };
          });
        }
      };
      
      runVerification();
    }
  }, [currentStepIndex, isStepViewerOpen, currentInference, inputNodes, outputNodes]);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner} />
        <span style={styles.loadingText}>物理構造を解析中...</span>
      </div>
    )
  }

  if (!answerData) {
    return (
      <div style={styles.errorContainer}>
        <AlertTriangle size={32} color="#f43f5e" />
        <span>答案が見つかりませんでした</span>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* ヘッダーエリア */}
      <header style={styles.header}>
        <button onClick={() => router.back()} style={styles.backButton} aria-label="戻る">
          <CircleArrowLeft size={26} />
        </button>
        <h1 style={styles.title}>物理構造・推論 診断書</h1>
      </header>

      {/* デバッグモニター */}
      {(debugError || debugDetails || debugRawText) && (
        <div style={styles.debugBox}>
          <div style={styles.debugHeader}>
            <AlertTriangle size={18} color="#f43f5e" />
            <span style={styles.debugTitle}>デバッグモニター (データ未着の原因)</span>
          </div>
          {debugError && <p style={styles.debugItem}><strong>Error:</strong> {debugError}</p>}
          {debugDetails && (
            <div style={styles.debugItem}>
              <strong>Details:</strong>
              <pre style={styles.debugPre}>{debugDetails}</pre>
            </div>
          )}
          {debugRawText && (
            <div style={styles.debugItem}>
              <strong>Geminiが返してきた生のテキストデータ:</strong>
              <pre style={styles.debugRawPre}>{debugRawText}</pre>
            </div>
          )}
        </div>
      )}

      <div style={styles.mainGrid}>
        {/* 左側：答案カード */}
        <section style={styles.cardSection}>
          <AnswerCard
            image={answerData.image_url}
            answerId={answerData.id}
            rootId={answerData.parent_id || answerData.id}
            username={answerData.profiles?.handle || 'unknown'}
            createdAt={answerData.created_at}
            anonymous={answerData.anonymous}
          />
        </section>

        {/* 右側：解析された物理DAG構造可視化エリア */}
        <section style={styles.analysisSection}>
          <div style={styles.analysisHeaderRow}>
            <div style={styles.analysisHeader}>
              <Layers size={20} color="#3b82f6" />
              <span style={styles.analysisTitle}>解析された物理推論のDAG構造</span>
            </div>
            <button 
              onClick={handleVerify} 
              disabled={isVerifying || !graphData}
              style={{
                ...styles.verifyButton,
                ...(isVerifying || !graphData ? styles.buttonDisabled : {})
              }}
            >
              {isVerifying ? '検証中...' : '物理推論を検証する'}
            </button>
          </div>

          {/* 一歩ごとの解説モード起動アクションエリア */}
          {graphData && inferenceNodes.length > 0 && (
            <div style={styles.stepLauncherBanner}>
              <div style={styles.stepLauncherTextGroup}>
                <div style={styles.stepLauncherTitle}>
                  <Sparkles size={16} color="#6366f1" />
                  <span>思考の変形プロセスを1ステップずつ追う</span>
                </div>
                <p style={styles.stepLauncherSub}>
                  自分がどこでつまずいたのか、式変形と適用定理を順番に確認してみよう！
                </p>
              </div>
              <button
                onClick={() => {
                  setCurrentStepIndex(0)
                  setIsStepViewerOpen(true)
                }}
                style={styles.stepLauncherButton}
              >
                <Footprints size={16} />
                <span>一歩ごとの解説モードをスタート</span>
              </button>
            </div>
          )}

          <div style={styles.analysisBody}>
            {graphData ? (
              /* スマホ表示対応のため一時的に重い描画処理をコメントアウト */
              /* <DagVisualizer graphData={graphData} /> */
              null
            ) : (
              <div style={styles.errorText}>
                物理構造のグラフデータを読み込めませんでした。上のデバッグモニターを確認してください。
              </div>
            )}
          </div>

          {/* グラフ構造プログラム（JSON）表示エリア */}
          {rawGraphData && (
            <div style={styles.codeContainer}>
              <div style={styles.codeHeader}>
                <FileCode size={16} color="#94a3b8" />
                <h3 style={styles.codeTitle}>物理グラフ構築プログラム (JSONデータ)</h3>
              </div>
              <pre style={styles.codeBlock}>
                {rawGraphData}
              </pre>
            </div>
          )}
        </section>
      </div>

      {/* ========================================================================= */}
      {/* 🐾 一歩ごとの解説モード（Step-by-Step Viewer モーダル） */}
      {/* ========================================================================= */}
      {isStepViewerOpen && currentInference && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContainer}>
            {/* モーダルヘッダー */}
            <div style={styles.modalHeader}>
              <div style={styles.modalHeaderTitleGroup}>
                <Footprints size={18} color="#818cf8" />
                <span style={styles.modalHeaderTitle}>一歩ごとの論理検証モード</span>
                <span style={styles.stepBadge}>
                  Step {currentStepIndex + 1} / {inferenceNodes.length}
                </span>
                {currentInference.sub_question && (
                  <span style={styles.subQuestionBadge}>
                    問 ({currentInference.sub_question})
                  </span>
                )}
              </div>
              <button
                onClick={() => setIsStepViewerOpen(false)}
                style={styles.closeButton}
                aria-label="閉じる"
              >
                <X size={20} />
              </button>
            </div>

            {/* モーダルメイン表示部 */}
            <div style={styles.modalBody}>
              <div style={styles.stepCard}>
                <div style={styles.stepCardHeader}>
                  <Compass size={15} color="#94a3b8" />
                  <h3 style={styles.stepCardTitle}>このステップで行われている変形・推論</h3>
                </div>
                
                <div style={styles.stepGrid}>
                  {/* 前の式（Inputs） */}
                  <div style={styles.stepBox}>
                    <span style={styles.inputBadge}>使う前提・根拠</span>
                    {inputNodes.length > 0 ? (
                      inputNodes.map(node => {
                        const matched = findPhysicsTheorem(node);
                        return (
                          <div key={node.id} style={styles.nodeItemText}>
                            •{' '}
                            {matched ? (
                              <button
                                onClick={() => handleOpenTheorem(matched.id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#3b82f6',
                                  textDecoration: 'underline',
                                  cursor: 'pointer',
                                  padding: 0,
                                  font: 'inherit',
                                  textAlign: 'left'
                                }}
                              >
                                <FormattedText text={node.label} />
                              </button>
                            ) : (
                              <FormattedText text={node.label} />
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div style={styles.nodeItemTextEmpty}>（問題設定または直前の条件）</div>
                    )}
                  </div>

                  {/* 変形・適用定理 と ★自動検証ステータス・原因表示★ */}
                  <div style={styles.stepCenterBox}>
                    <span style={styles.inferenceBadge}>適用した考え方・定理</span>
                    <p style={styles.inferenceText}>
                      <FormattedText text={currentInference.label} />
                    </p>

                    {currentInference._client_verification_status && currentInference._client_verification_status !== 'unverified' && (
                      <div style={{ marginTop: '12px', fontSize: '13px', fontWeight: 'bold', width: '100%' }}>
                        {currentInference._client_verification_status === 'verifying' && (
                          <span style={{color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'}}>
                            <div style={styles.spinnerMini}/> 数式検証中...
                          </span>
                        )}
                        {currentInference._client_verification_status === 'correct' && (
                          <span style={{color: '#4ade80'}}>✓ 正しい計算です</span>
                        )}
                        {currentInference._client_verification_status === 'incorrect' && (
                          <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                            <span style={{color: '#f87171'}}>⚠️ 計算に誤りがあります</span>
                            {currentInference._client_debug_info && (
                              <div style={styles.debugInfoBox}>
                                <span style={{fontSize: '10px', color: '#cbd5e1'}}>【SymPy検証・原因解析】</span>
                                <div style={{fontSize: '11px', color: '#fca5a5', wordBreak: 'break-all', fontFamily: 'monospace'}}>
                                  {currentInference._client_debug_info}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        {currentInference._client_verification_status === 'error' && (
                          <span style={{color: '#9ca3af'}}>検証エラー</span>
                        )}
                        {currentInference._client_verification_status === 'skipped' && (
                          <span style={{color: '#9ca3af'}}>検証スキップ(純粋な数式なし)</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 次の式（Outputs） */}
                  <div style={styles.stepBox}>
                    <span style={styles.outputBadge}>導かれる結果</span>
                    {outputNodes.length > 0 ? (
                      outputNodes.map(node => (
                        <div key={node.id} style={styles.nodeItemText}>
                          • <FormattedText text={node.label} />
                        </div>
                      ))
                    ) : (
                      <div style={styles.nodeItemTextEmpty}>（次の結論へ接続）</div>
                    )}
                  </div>
                </div>
              </div>

              {/* 定理解説への導線カード */}
              <div style={styles.theoremBanner}>
                <div style={styles.theoremBannerText}>
                  <div style={styles.theoremBannerTitle}>
                    <BookOpen size={16} color="#a5b4fc" />
                    <span>この思考ステップに不安はありますか？</span>
                  </div>
                  <p style={styles.theoremBannerSub}>
                    「なぜこの式変形になるのか」「なぜこの定理が使えるのか」を根底から徹底解説します。
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (primaryTheorem) {
                      handleOpenTheorem(primaryTheorem.id)
                    } else {
                      setSelectedTheorem(currentInference.label)
                    }
                  }}
                  style={styles.theoremButton}
                >
                  <span>
                    {primaryTheorem
                      ? `「${primaryTheorem.name}」について確認`
                      : '定理の解説を見る'}
                  </span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>

            {/* モーダルフッター（ナビゲーション操作） */}
            <div style={styles.modalFooter}>
              <button
                disabled={currentStepIndex === 0}
                onClick={() => setCurrentStepIndex(prev => prev - 1)}
                style={{
                  ...styles.navButton,
                  ...(currentStepIndex === 0 ? styles.navButtonDisabled : {})
                }}
              >
                <ArrowLeft size={16} />
                <span>前へ</span>
              </button>

              <div style={styles.stepIndicatorList}>
                {inferenceNodes.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentStepIndex(idx)}
                    style={{
                      ...styles.stepDot,
                      ...(idx === currentStepIndex ? styles.stepDotActive : {})
                    }}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>

              <button
                disabled={currentStepIndex === inferenceNodes.length - 1}
                onClick={() => setCurrentStepIndex(prev => prev + 1)}
                style={{
                  ...styles.navButtonPrimary,
                  ...(currentStepIndex === inferenceNodes.length - 1 ? styles.navButtonDisabled : {})
                }}
              >
                <span>次へ</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 定理解説モーダル (?theorem=... リンク時、または未定義時) */}
      {/* ========================================================================= */}
      {(selectedTheoremId || selectedTheorem) && (
        <div style={styles.theoremModalOverlay}>
          <div style={styles.theoremModalContainer}>
            <TheoremDetailRenderer
              theoremId={(selectedTheoremId || selectedTheorem) ?? ''}
              onClose={() => {
                if (selectedTheoremId) handleCloseTheorem()
                if (selectedTheorem) setSelectedTheorem(null)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '16px 12px 64px',
    backgroundColor: '#ffffff',
    minHeight: '100vh',
    boxSizing: 'border-box',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    gap: '12px',
  },
  loadingSpinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #e2e8f0',
    borderTopColor: '#4f46e5',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    color: '#64748b',
    fontSize: '14px',
    fontWeight: 500,
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '50vh',
    gap: '12px',
    color: '#f43f5e',
    fontWeight: 'bold',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  backButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#475569',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  title: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#0f172a',
    margin: 0,
  },
  debugBox: {
    backgroundColor: '#fff1f2',
    border: '1px solid #fecdd3',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '16px',
    fontSize: '13px',
    color: '#be123c',
  },
  debugHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '8px',
  },
  debugTitle: {
    fontWeight: 'bold',
    fontSize: '14px',
  },
  debugItem: {
    margin: '4px 0',
  },
  debugPre: {
    backgroundColor: '#ffe4e6',
    padding: '8px',
    borderRadius: '4px',
    overflowX: 'auto',
    whiteSpace: 'pre-wrap',
    fontSize: '11px',
    margin: '4px 0 0',
  },
  debugRawPre: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    padding: '8px',
    borderRadius: '4px',
    overflowX: 'auto',
    maxHeight: '150px',
    fontSize: '11px',
    margin: '4px 0 0',
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '16px',
  },
  cardSection: {
    width: '100%',
  },
  analysisSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  analysisHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  analysisHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  analysisTitle: {
    fontSize: '15px',
    fontWeight: 'bold',
    color: '#1e293b',
  },
  verifyButton: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  buttonDisabled: {
    backgroundColor: '#94a3b8',
    cursor: 'not-allowed',
  },
  stepLauncherBanner: {
    backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '10px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  stepLauncherTextGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  stepLauncherTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#1e40af',
  },
  stepLauncherSub: {
    fontSize: '12px',
    color: '#3b82f6',
    margin: 0,
  },
  stepLauncherButton: {
    backgroundColor: '#4f46e5',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '13px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    cursor: 'pointer',
  },
  analysisBody: {
    minHeight: '40px',
  },
  errorText: {
    fontSize: '13px',
    color: '#64748b',
    padding: '12px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
  },
  codeContainer: {
    backgroundColor: '#0f172a',
    borderRadius: '8px',
    padding: '12px',
    color: '#f8fafc',
  },
  codeHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '8px',
  },
  codeTitle: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#94a3b8',
    margin: 0,
  },
  codeBlock: {
    fontSize: '11px',
    color: '#38bdf8',
    overflowX: 'auto',
    margin: 0,
    maxHeight: '200px',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    backdropFilter: 'blur(4px)',
    zIndex: 2000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 12px 80px 12px',
    boxSizing: 'border-box',
  },
  modalContainer: {
    width: '100%',
    maxWidth: '800px',
    maxHeight: '100%',
    backgroundColor: '#0f172a',
    borderRadius: '16px',
    border: '1px solid #1e293b',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    color: '#f8fafc',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    borderBottom: '1px solid #1e293b',
    flexShrink: 0,
  },
  modalHeaderTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  modalHeaderTitle: {
    fontSize: '15px',
    fontWeight: 'bold',
  },
  stepBadge: {
    backgroundColor: '#312e81',
    color: '#c7d2fe',
    fontSize: '11px',
    fontWeight: 'bold',
    padding: '2px 8px',
    borderRadius: '12px',
  },
  subQuestionBadge: {
    backgroundColor: '#1e293b',
    color: '#94a3b8',
    fontSize: '11px',
    padding: '2px 6px',
    borderRadius: '4px',
    border: '1px solid #334155',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: '12px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    flex: 1,
  },
  stepCard: {
    backgroundColor: '#1e293b',
    borderRadius: '10px',
    padding: '10px',
    border: '1px solid #334155',
  },
  stepCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '8px',
  },
  stepCardTitle: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#94a3b8',
    margin: 0,
  },
  stepGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '8px',
    alignItems: 'stretch',
  },
  stepBox: {
    backgroundColor: '#0f172a',
    borderRadius: '8px',
    padding: '8px 10px',
    border: '1px solid #334155',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  inputBadge: {
    color: '#38bdf8',
    fontSize: '11px',
    fontWeight: 'bold',
  },
  outputBadge: {
    color: '#4ade80',
    fontSize: '11px',
    fontWeight: 'bold',
  },
  nodeItemText: {
    fontSize: '13px',
    color: '#f1f5f9',
    lineHeight: '1.4',
  },
  nodeItemTextEmpty: {
    fontSize: '12px',
    color: '#64748b',
    fontStyle: 'italic',
  },
  stepCenterBox: {
    backgroundColor: 'rgba(30, 27, 75, 0.5)',
    borderRadius: '8px',
    padding: '8px 10px',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    gap: '4px',
  },
  inferenceBadge: {
    color: '#a5b4fc',
    fontSize: '11px',
    fontWeight: 'bold',
  },
  inferenceText: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#ffffff',
    margin: 0,
  },
  theoremBanner: {
    backgroundColor: '#1e1b4b',
    borderRadius: '10px',
    padding: '10px 12px',
    border: '1px solid #312e81',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    flexWrap: 'wrap',
  },
  theoremBannerText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flex: 1,
    minWidth: '200px',
  },
  theoremBannerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#e0e7ff',
  },
  theoremBannerSub: {
    fontSize: '11px',
    color: '#a5b4fc',
    margin: 0,
  },
  theoremButton: {
    backgroundColor: '#4f46e5',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '12px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  modalFooter: {
    padding: '10px 14px',
    borderTop: '1px solid #1e293b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    gap: '8px',
    flexShrink: 0,
  },
  navButton: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    border: '1px solid #334155',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    cursor: 'pointer',
  },
  navButtonPrimary: {
    backgroundColor: '#4f46e5',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    cursor: 'pointer',
  },
  navButtonDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  stepIndicatorList: {
    display: 'flex',
    gap: '4px',
    overflowX: 'auto',
    padding: '2px 0',
    maxWidth: '45%',
    scrollbarWidth: 'none',
  },
  stepDot: {
    minWidth: '24px',
    height: '24px',
    borderRadius: '12px',
    border: '1px solid #334155',
    backgroundColor: '#1e1b4b',
    color: '#94a3b8',
    fontSize: '11px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
  },
  stepDotActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#6366f1',
    color: '#ffffff',
    fontWeight: 'bold',
  },
  theoremModalOverlay: {
position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 2000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  backdropFilter: 'blur(4px)',
  padding: '16px',
  },
theoremModalContainer: {
  width: '100%',
  maxWidth: '768px',
  maxHeight: '85vh',     // ★画面高さの85%までに制限
  overflowY: 'auto',     // ★中身が溢れたら「この枠の中」でスクロールさせる
  backgroundColor: '#0f172a',
  borderRadius: '16px',
  border: '1px solid #1e293b',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
},
  theoremModalHeader: {
    padding: '14px 16px',
    borderBottom: '1px solid #f1f5f9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  theoremModalTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#0f172a',
    margin: 0,
  },
  closeButtonLight: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  theoremModalBody: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    overflowY: 'auto',
  },
  authorMessage: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#059669',
  },
  theoremTextBody: {
    fontSize: '14px',
    color: '#334155',
    lineHeight: '1.6',
    margin: 0,
  },
  placeholderBox: {
    backgroundColor: '#f8fafc',
    border: '1px dashed #cbd5e1',
    borderRadius: '8px',
    padding: '12px',
    textAlign: 'center',
  },
  theoremModalFooter: {
    padding: '12px 16px',
    backgroundColor: '#f8fafc',
    borderTop: '1px solid #f1f5f9',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  closeModalButton: {
    backgroundColor: '#059669',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
  },
  spinnerMini: {
    width: '12px',
    height: '12px',
    border: '2px solid rgba(251, 191, 36, 0.3)',
    borderTopColor: '#fbbf24',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  debugInfoBox: {
    backgroundColor: '#1e1b4b',
    border: '1px solid #7f1d1d',
    borderRadius: '6px',
    padding: '6px',
    marginTop: '6px',
    textAlign: 'left',
    width: '100%',
    boxSizing: 'border-box'
  }
}