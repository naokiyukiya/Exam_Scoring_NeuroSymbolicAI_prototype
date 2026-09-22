'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import AnswerCard from '../../../components/AnswerCard'
import DagVisualizer from '../../../components/DagVisualizer'
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
  Code2,
  Flame,
  CheckCircle2,
  FileCode,
  Compass
} from 'lucide-react'

type Node = {
  id: string
  label: string
  type: 'proposition' | 'inference' | 'theorem'
  sub_question?: string
  is_final_answer?: boolean
  inputs_used?: Record<string, string>
  outputs_derived?: Record<string, string>
  verification_status?: string
}

type Edge = {
  from: string
  to: string
}

type GraphData = {
  nodes: Array<Node>
  edges: Array<Edge>
}

export default function AnalysisPhysicsPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [answerData, setAnswerData] = useState<any>(null)
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [rawGraphData, setRawGraphData] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [isVerifying, setIsVerifying] = useState(false)

  // 一歩ごとの解説モード用のステート
  const [isStepViewerOpen, setIsStepViewerOpen] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  // 定理解説モーダル用のステート
  const [selectedTheorem, setSelectedTheorem] = useState<string | null>(null)

  // デバッグ用ステート
  const [debugError, setDebugError] = useState<string | null>(null)
  const [debugDetails, setDebugDetails] = useState<string | null>(null)
  const [debugRawText, setDebugRawText] = useState<string | null>(null)

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
          setGraphData(json.graph)
          
          const formattedJson = JSON.stringify({
            graph: json.graph,
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

  const inferenceNodes = graphData?.nodes.filter(n => n.type === 'inference') || []
  const currentInference = inferenceNodes[currentStepIndex]

  const inputNodeIds = graphData?.edges.filter(e => e.to === currentInference?.id).map(e => e.from) || []
  const outputNodeIds = graphData?.edges.filter(e => e.from === currentInference?.id).map(e => e.to) || []

  const inputNodes = graphData?.nodes.filter(n => inputNodeIds.includes(n.id)) || []
  const outputNodes = graphData?.nodes.filter(n => outputNodeIds.includes(n.id)) || []

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
              <DagVisualizer graphData={graphData} />
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
                <Footprints size={20} color="#818cf8" />
                <span style={styles.modalHeaderTitle}>一歩ごとの論理検証モード</span>
                <span style={styles.stepBadge}>
                  Step {currentStepIndex + 1} / {inferenceNodes.length}
                </span>
                {currentInference.sub_question && (
                  <span style={styles.subQuestionBadge}>
                    問 {currentInference.sub_question}
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
                  <Compass size={16} color="#94a3b8" />
                  <h3 style={styles.stepCardTitle}>このステップで行われている変形・推論</h3>
                </div>
                
                <div style={styles.stepGrid}>
                  {/* 前の式（Inputs） */}
                  <div style={styles.stepBox}>
                    <span style={styles.inputBadge}>使う前提・根拠</span>
                    {inputNodes.length > 0 ? (
                      inputNodes.map(node => (
                        <div key={node.id} style={styles.nodeItemText}>
                          • {node.label}
                        </div>
                      ))
                    ) : (
                      <div style={styles.nodeItemTextEmpty}>（問題設定または直前の条件）</div>
                    )}
                  </div>

                  {/* 変形・適用定理 */}
                  <div style={styles.stepCenterBox}>
                    <span style={styles.inferenceBadge}>適用した考え方・定理</span>
                    <p style={styles.inferenceText}>
                      {currentInference.label}
                    </p>
                  </div>

                  {/* 次の式（Outputs） */}
                  <div style={styles.stepBox}>
                    <span style={styles.outputBadge}>導かれる結果</span>
                    {outputNodes.length > 0 ? (
                      outputNodes.map(node => (
                        <div key={node.id} style={styles.nodeItemText}>
                          • {node.label}
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
                    <BookOpen size={18} color="#a5b4fc" />
                    <span>この思考ステップに不安はありますか？</span>
                  </div>
                  <p style={styles.theoremBannerSub}>
                    「なぜこの式変形になるのか」「なぜこの定理が使えるのか」を根底から徹底解説します。
                  </p>
                </div>
                <button
                  onClick={() => setSelectedTheorem(currentInference.label)}
                  style={styles.theoremButton}
                >
                  <span>定理の解説を見る</span>
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
      {/* 定理解説モーダル */}
      {/* ========================================================================= */}
      {selectedTheorem && (
        <div style={styles.theoremModalOverlay}>
          <div style={styles.theoremModalContainer}>
            <div style={styles.theoremModalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <BookOpen size={20} color="#4f46e5" />
                <h2 style={styles.theoremModalTitle}>
                  解説: {selectedTheorem}
                </h2>
              </div>
              <button
                onClick={() => setSelectedTheorem(null)}
                style={styles.closeButtonLight}
                aria-label="閉じる"
              >
                <X size={20} />
              </button>
            </div>
            
            <div style={styles.theoremModalBody}>
              <div style={styles.authorMessage}>
                <Flame size={18} color="#059669" />
                <span>解説ノート</span>
              </div>
              <p style={styles.theoremTextBody}>
                ここでは <strong>{selectedTheorem}</strong> についての本質的な物理的意味、よくあるミスの罠、式の導出イメージなどを解説するコンテンツを展開します。
              </p>
              <div style={styles.placeholderBox}>
                <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>
                  ※ 定理解説コンテンツは現在制作・拡充中です。お楽しみに！
                </p>
              </div>
            </div>

            <div style={styles.theoremModalFooter}>
              <button
                onClick={() => setSelectedTheorem(null)}
                style={styles.closeModalButton}
              >
                <CheckCircle2 size={16} />
                <span>理解できたのでステップに戻る</span>
              </button>
            </div>
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
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '40px 20px',
    color: '#e11d48',
    fontSize: '15px',
    fontWeight: 600,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
  },
  backButton: {
    background: 'none',
    border: 'none',
    color: '#475569',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    padding: '4px',
    borderRadius: '8px',
    transition: 'background-color 0.2s',
  },
  title: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#0f172a',
    margin: 0,
    letterSpacing: '-0.02em',
  },
  mainGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  cardSection: {
    width: '100%',
  },
  analysisSection: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
  },
  analysisHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #f1f5f9',
    paddingBottom: '12px',
    marginBottom: '16px',
    gap: '12px',
    flexWrap: 'wrap',
  },
  analysisHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  analysisTitle: {
    fontWeight: '600',
    fontSize: '15px',
    color: '#1e293b',
  },
  verifyButton: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },

  stepLauncherBanner: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    backgroundColor: '#f5f3ff',
    border: '1px solid #ddd6fe',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  stepLauncherTextGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: '1 1 280px',
  },
  stepLauncherTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: '600',
    fontSize: '14px',
    color: '#4338ca',
  },
  stepLauncherSub: {
    margin: 0,
    fontSize: '12px',
    color: '#6366f1',
    lineHeight: 1.4,
  },
  stepLauncherButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    backgroundColor: '#4f46e5',
    color: '#ffffff',
    border: 'none',
    padding: '10px 18px',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(79, 70, 229, 0.15)',
    whiteSpace: 'nowrap',
  },

  analysisBody: {
    width: '100%',
  },
  errorText: {
    color: '#e11d48',
    fontSize: '14px',
    textAlign: 'center',
    padding: '24px 0',
  },
  debugBox: {
    backgroundColor: '#fff1f2',
    border: '1px solid #fecdd3',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '20px',
  },
  debugHeader: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '8px', 
    marginBottom: '8px' 
  },
  debugTitle: { 
    fontWeight: '600', 
    color: '#e11d48', 
    fontSize: '14px' 
  },
  debugItem: { 
    fontSize: '12px', 
    color: '#334155', 
    marginBottom: '8px' 
  },
  debugPre: { 
    backgroundColor: '#ffffff', 
    padding: '8px', 
    borderRadius: '6px', 
    overflowX: 'auto', 
    marginTop: '4px', 
    fontFamily: 'monospace',
    border: '1px solid #ffe4e6',
  },
  debugRawPre: { 
    backgroundColor: '#0f172a', 
    color: '#38bdf8', 
    padding: '12px', 
    borderRadius: '8px', 
    overflowX: 'auto', 
    marginTop: '4px', 
    fontFamily: 'monospace', 
    fontSize: '11px', 
    lineHeight: 1.5 
  },

  codeContainer: {
    marginTop: '24px',
    padding: '16px',
    backgroundColor: '#0f172a',
    borderRadius: '12px',
    border: '1px solid #1e293b',
  },
  codeHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
  },
  codeTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#94a3b8',
    margin: 0,
  },
  codeBlock: {
    color: '#e2e8f0',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: '12px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    maxHeight: '400px',
    overflowY: 'auto',
    margin: 0,
    lineHeight: 1.5,
  },

  // モーダル全般のスタイル
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    backdropFilter: 'blur(4px)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px',
  },
  modalContainer: {
    width: '100%',
    maxWidth: '800px',
    backgroundColor: '#0f172a',
    borderRadius: '16px',
    border: '1px solid #1e293b',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '90vh',
    overflow: 'hidden',
    color: '#f8fafc',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #1e293b',
  },
  modalHeaderTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  modalHeaderTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#f8fafc',
  },
  stepBadge: {
    backgroundColor: '#1e1b4b',
    color: '#a5b4fc',
    fontSize: '11px',
    fontWeight: '600',
    padding: '2px 8px',
    borderRadius: '12px',
    border: '1px solid #3730a3',
  },
  subQuestionBadge: {
    backgroundColor: '#1e293b',
    color: '#94a3b8',
    fontSize: '11px',
    padding: '2px 8px',
    borderRadius: '6px',
    border: '1px solid #334155',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
  },
  closeButtonLight: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
  },
  modalBody: {
    padding: '20px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  stepCard: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid #334155',
  },
  stepCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '12px',
  },
  stepCardTitle: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#94a3b8',
    margin: 0,
  },
  stepGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '12px',
    alignItems: 'stretch',
  },
  stepBox: {
    backgroundColor: '#0f172a',
    borderRadius: '8px',
    padding: '12px',
    border: '1px solid #334155',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  stepCenterBox: {
    backgroundColor: 'rgba(30, 27, 75, 0.5)',
    borderRadius: '8px',
    padding: '12px',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  inputBadge: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#38bdf8',
  },
  outputBadge: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#4ade80',
  },
  inferenceBadge: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#a5b4fc',
    marginBottom: '4px',
  },
  nodeItemText: {
    fontSize: '12px',
    color: '#cbd5e1',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    lineHeight: 1.4,
  },
  nodeItemTextEmpty: {
    fontSize: '11px',
    color: '#64748b',
    fontStyle: 'italic',
  },
  inferenceText: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#f1f5f9',
    margin: 0,
    lineHeight: 1.4,
  },

  theoremBanner: {
    backgroundColor: '#1e1b4b',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid #312e81',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
  },
  theoremBannerText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: '1 1 240px',
  },
  theoremBannerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    fontWeight: '600',
    color: '#f8fafc',
  },
  theoremBannerSub: {
    margin: 0,
    fontSize: '12px',
    color: '#94a3b8',
    lineHeight: 1.4,
  },
  theoremButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#4f46e5',
    color: '#ffffff',
    border: 'none',
    padding: '8px 14px',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  modalFooter: {
    padding: '12px 20px',
    borderTop: '1px solid #1e293b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    gap: '8px',
  },
  navButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    border: '1px solid #334155',
    padding: '8px 12px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  navButtonPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    backgroundColor: '#4f46e5',
    color: '#ffffff',
    border: 'none',
    padding: '8px 12px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
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
    padding: '4px 0',
  },
  stepDot: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: '#1e293b',
    color: '#94a3b8',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepDotActive: {
    backgroundColor: '#4f46e5',
    color: '#ffffff',
  },

  // 定理解説モーダル専用
  theoremModalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    backdropFilter: 'blur(4px)',
    zIndex: 1100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px',
  },
  theoremModalContainer: {
    width: '100%',
    maxWidth: '560px',
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
  },
  theoremModalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #f1f5f9',
  },
  theoremModalTitle: {
    fontSize: '16px',
    fontWeight: '700',
    margin: 0,
    color: '#0f172a',
  },
  theoremModalBody: {
    padding: '20px',
  },
  authorMessage: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#ecfdf5',
    border: '1px solid #a7f3d0',
    color: '#047857',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    marginBottom: '16px',
  },
  theoremTextBody: {
    lineHeight: 1.6,
    color: '#334155',
    fontSize: '14px',
    margin: '0 0 16px 0',
  },
  placeholderBox: {
    padding: '16px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    border: '1px dashed #cbd5e1',
    textAlign: 'center',
  },
  theoremModalFooter: {
    padding: '12px 20px',
    backgroundColor: '#f8fafc',
    borderTop: '1px solid #f1f5f9',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  closeModalButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
  }
}