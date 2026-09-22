'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import AnswerCard from '../../../components/AnswerCard'
// import DagVisualizer from '../../../components/DagVisualizer'
import { 
  CircleArrowLeft, 
  Layers, 
  AlertTriangle, 
  Footprints, 
  X, 
  ArrowLeft, 
  ArrowRight, 
  BookOpen, 
  Sparkles 
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

  const [isStepViewerOpen, setIsStepViewerOpen] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [selectedTheorem, setSelectedTheorem] = useState<string | null>(null)

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
          setDebugError(`APIエラー (${res.status})`)
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
        setDebugError('例外が発生しました')
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
        throw new Error(json.error || '検証エラー')
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
    return <div style={{ padding: 20, textAlign: 'center', color: '#666', fontSize: '14px' }}>解析中...</div>
  }

  if (!answerData) {
    return <div style={{ padding: 20, textAlign: 'center', color: '#666', fontSize: '14px' }}>答案が見つかりませんでした</div>
  }

  return (
    <div style={styles.container}>
      {/* ヘッダー */}
      <div style={styles.header}>
        <button onClick={() => router.back()} style={styles.backButton}>
          <CircleArrowLeft size={24} />
        </button>
        <h1 style={styles.title}>物理推論 診断書</h1>
      </div>

      {/* デバッグモニター */}
      {(debugError || debugDetails || debugRawText) && (
        <div style={styles.debugBox}>
          <div style={styles.debugHeader}>
            <AlertTriangle size={18} color="#dc2626" />
            <span style={styles.debugTitle}>デバッグモニター</span>
          </div>
          {debugError && <p style={styles.debugItem}><strong>Error:</strong> {debugError}</p>}
          {debugDetails && (
            <div style={styles.debugItem}>
              <pre style={styles.debugPre}>{debugDetails}</pre>
            </div>
          )}
          {debugRawText && (
            <div style={styles.debugItem}>
              <pre style={styles.debugRawPre}>{debugRawText}</pre>
            </div>
          )}
        </div>
      )}

      <div style={styles.mainGrid}>
        {/* 答案カード */}
        <div style={styles.cardSection}>
          <AnswerCard
            image={answerData.image_url}
            answerId={answerData.id}
            rootId={answerData.parent_id || answerData.id}
            username={answerData.profiles?.handle || 'unknown'}
            createdAt={answerData.created_at}
            anonymous={answerData.anonymous}
          />
        </div>

        {/* 物理推論エリア */}
        <div style={styles.analysisSection}>
          <div style={styles.analysisHeaderRow}>
            <div style={styles.analysisHeader}>
              <Layers size={18} color="#2563eb" />
              <span style={styles.analysisTitle}>物理推論構造</span>
            </div>
            <button 
              onClick={handleVerify} 
              disabled={isVerifying || !graphData}
              style={styles.verifyButton}
            >
              {isVerifying ? '検証中' : '検証'}
            </button>
          </div>

          {/* 解説モード起動ボタン */}
          {graphData && inferenceNodes.length > 0 && (
            <div style={styles.stepLauncherBanner}>
              <div style={styles.stepLauncherTextGroup}>
                <div style={styles.stepLauncherTitle}>
                  <Sparkles size={16} color="#4f46e5" />
                  <span>ステップ別の推論確認</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setCurrentStepIndex(0)
                  setIsStepViewerOpen(true)
                }}
                style={styles.stepLauncherButton}
              >
                <Footprints size={16} />
                順にたどる
              </button>
            </div>
          )}

          <div style={styles.analysisBody}>
            {/* ★ グラフ描画はスマホクラッシュ防止のため一時停止中 */}
            {/* {graphData ? (
              <DagVisualizer graphData={graphData} />
            ) : (
              <div style={styles.errorText}>グラフデータを読み込めませんでした</div>
            )} */}
          </div>

          {/* JSON表示エリア */}
          {rawGraphData && (
            <div style={styles.codeContainer}>
              <h3 style={styles.codeTitle}>グラフJSON</h3>
              <pre style={styles.codeBlock}>
                {rawGraphData}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* ステップ別確認モーダル */}
      {isStepViewerOpen && currentInference && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContainer}>
            <div style={styles.modalHeader}>
              <div style={styles.modalHeaderTitleGroup}>
                <Footprints size={18} color="#4f46e5" />
                <span style={styles.modalHeaderTitle}>ステップ確認</span>
                <span style={styles.stepBadge}>
                  {currentStepIndex + 1} / {inferenceNodes.length}
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
              >
                <X size={20} />
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.stepCard}>
                <div style={styles.stepGrid}>
                  {/* Inputs */}
                  <div style={styles.stepBox}>
                    <span style={styles.inputBadge}>前提</span>
                    {inputNodes.length > 0 ? (
                      inputNodes.map(node => (
                        <div key={node.id} style={styles.nodeItemText}>
                          • {node.label}
                        </div>
                      ))
                    ) : (
                      <div style={styles.nodeItemTextEmpty}>-</div>
                    )}
                  </div>

                  {/* Inference */}
                  <div style={styles.stepCenterBox}>
                    <span style={styles.inferenceBadge}>適用定理</span>
                    <p style={styles.inferenceText}>
                      {currentInference.label}
                    </p>
                  </div>

                  {/* Outputs */}
                  <div style={styles.stepBox}>
                    <span style={styles.outputBadge}>導出結果</span>
                    {outputNodes.length > 0 ? (
                      outputNodes.map(node => (
                        <div key={node.id} style={styles.nodeItemText}>
                          • {node.label}
                        </div>
                      ))
                    ) : (
                      <div style={styles.nodeItemTextEmpty}>-</div>
                    )}
                  </div>
                </div>
              </div>

              {/* 定理解説への導線 */}
              <div style={styles.theoremBanner}>
                <div style={styles.theoremBannerText}>
                  <div style={styles.theoremBannerTitle}>
                    <BookOpen size={16} color="#6366f1" />
                    <span>定理の理解を深める</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTheorem(currentInference.label)}
                  style={styles.theoremButton}
                >
                  解説を見る
                </button>
              </div>
            </div>

            {/* ナビゲーション */}
            <div style={styles.modalFooter}>
              <button
                disabled={currentStepIndex === 0}
                onClick={() => setCurrentStepIndex(prev => prev - 1)}
                style={{
                  ...styles.navButton,
                  ...(currentStepIndex === 0 ? styles.navButtonDisabled : {})
                }}
              >
                <ArrowLeft size={14} /> 前へ
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
                次へ <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 定理解説モーダル */}
      {selectedTheorem && (
        <div style={styles.theoremModalOverlay}>
          <div style={styles.theoremModalContainer}>
            <div style={styles.theoremModalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <BookOpen size={18} color="#2563eb" />
                <h2 style={{ fontSize: '15px', fontWeight: 'bold', margin: 0, color: '#0f172a' }}>
                  {selectedTheorem}
                </h2>
              </div>
              <button
                onClick={() => setSelectedTheorem(null)}
                style={styles.closeButton}
              >
                <X size={20} />
              </button>
            </div>
            
            <div style={styles.theoremModalBody}>
              <p style={{ lineHeight: 1.6, color: '#334155', fontSize: '14px', margin: 0 }}>
                {selectedTheorem} に関する本質的解説ページです。
              </p>
              <div style={styles.placeholderBox}>
                <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>
                  解説コンテンツ準備中
                </p>
              </div>
            </div>

            <div style={styles.theoremModalFooter}>
              <button
                onClick={() => setSelectedTheorem(null)}
                style={styles.closeModalButton}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    maxWidth: '640px',
    margin: '0 auto',
    padding: '12px 12px 32px',
    backgroundColor: '#ffffff',
    minHeight: '100vh',
    boxSizing: 'border-box' as const,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  backButton: {
    background: 'none',
    border: 'none',
    color: '#0f172a',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
  },
  title: {
    fontSize: '18px',
    fontWeight: 'bold' as const,
    color: '#0f172a',
    margin: 0,
  },
  mainGrid: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  },
  cardSection: {
    width: '100%',
  },
  analysisSection: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '12px',
  },
  analysisHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  analysisHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  analysisTitle: {
    fontWeight: 'bold' as const,
    fontSize: '14px',
    color: '#0f172a',
  },
  verifyButton: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    padding: '4px 12px',
    borderRadius: '6px',
    fontWeight: 'bold' as const,
    fontSize: '12px',
    cursor: 'pointer',
  },

  stepLauncherBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '8px',
    padding: '8px 12px',
    marginBottom: '12px',
  },
  stepLauncherTextGroup: {
    display: 'flex',
    alignItems: 'center',
  },
  stepLauncherTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontWeight: 'bold' as const,
    fontSize: '13px',
    color: '#1e40af',
  },
  stepLauncherButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '6px',
    fontWeight: 'bold' as const,
    fontSize: '12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },

  analysisBody: {
    width: '100%',
  },
  errorText: {
    color: '#ef4444',
    fontSize: '12px',
    textAlign: 'center' as const,
    padding: '12px 0',
  },
  debugBox: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '16px',
  },
  debugHeader: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: '8px' },
  debugTitle: { fontWeight: 'bold' as const, color: '#dc2626', fontSize: '13px' },
  debugItem: { fontSize: '12px', color: '#334155', marginBottom: '6px' },
  debugPre: { backgroundColor: '#f1f5f9', padding: '6px', borderRadius: '4px', overflowX: 'auto' as const, marginTop: '4px', fontFamily: 'monospace', fontSize: '11px' },
  debugRawPre: { backgroundColor: '#0f172a', color: '#38bdf8', padding: '8px', borderRadius: '6px', overflowX: 'auto' as const, marginTop: '4px', fontFamily: 'monospace', fontSize: '11px', lineHeight: 1.3 },

  codeContainer: {
    marginTop: '12px',
    padding: '12px',
    backgroundColor: '#0f172a',
    borderRadius: '8px',
  },
  codeTitle: {
    fontSize: '12px',
    fontWeight: 'bold' as const,
    color: '#f8fafc',
    marginBottom: '8px',
    marginTop: 0,
  },
  codeBlock: {
    color: '#38bdf8',
    fontFamily: 'Consolas, Monaco, monospace',
    fontSize: '11px',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-all' as const,
    maxHeight: '300px',
    overflowY: 'auto' as const,
    margin: 0,
  },

  modalOverlay: {
    position: 'fixed' as const,
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
    maxWidth: '520px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #cbd5e1',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    display: 'flex',
    flexDirection: 'column' as const,
    maxHeight: '90vh',
    overflow: 'hidden',
    color: '#0f172a',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid #e2e8f0',
  },
  modalHeaderTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  modalHeaderTitle: {
    fontSize: '14px',
    fontWeight: 'bold' as const,
    color: '#0f172a',
  },
  stepBadge: {
    backgroundColor: '#eff6ff',
    color: '#2563eb',
    fontSize: '11px',
    fontWeight: 'bold' as const,
    padding: '2px 6px',
    borderRadius: '4px',
    border: '1px solid #bfdbfe',
  },
  subQuestionBadge: {
    backgroundColor: '#f1f5f9',
    color: '#475569',
    fontSize: '11px',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
  },
  modalBody: {
    padding: '16px',
    overflowY: 'auto' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  stepCard: {
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    padding: '12px',
    border: '1px solid #e2e8f0',
  },
  stepGrid: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  stepBox: {
    backgroundColor: '#ffffff',
    borderRadius: '6px',
    padding: '10px',
    border: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  stepCenterBox: {
    backgroundColor: '#eff6ff',
    borderRadius: '6px',
    padding: '10px',
    border: '1px solid #bfdbfe',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    textAlign: 'center' as const,
  },
  inputBadge: {
    fontSize: '11px',
    fontWeight: 'bold' as const,
    color: '#2563eb',
  },
  outputBadge: {
    fontSize: '11px',
    fontWeight: 'bold' as const,
    color: '#16a34a',
  },
  inferenceBadge: {
    fontSize: '11px',
    fontWeight: 'bold' as const,
    color: '#4f46e5',
    marginBottom: '2px',
  },
  nodeItemText: {
    fontSize: '12px',
    color: '#1e293b',
    fontFamily: 'monospace',
    wordBreak: 'break-all' as const,
    lineHeight: 1.3,
  },
  nodeItemTextEmpty: {
    fontSize: '11px',
    color: '#94a3b8',
  },
  inferenceText: {
    fontSize: '13px',
    fontWeight: 'bold' as const,
    color: '#1e1b4b',
    margin: 0,
    lineHeight: 1.3,
  },

  theoremBanner: {
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    padding: '10px 12px',
    border: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  theoremBannerText: {
    display: 'flex',
    alignItems: 'center',
  },
  theoremBannerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    color: '#0f172a',
  },
  theoremButton: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '6px',
    fontWeight: 'bold' as const,
    fontSize: '12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },

  modalFooter: {
    padding: '12px 16px',
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
  },
  navButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    backgroundColor: '#f1f5f9',
    color: '#0f172a',
    border: '1px solid #cbd5e1',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
  },
  navButtonPrimary: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
  },
  navButtonDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  stepIndicatorList: {
    display: 'flex',
    gap: '4px',
  },
  stepDot: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: '#f1f5f9',
    color: '#64748b',
    fontSize: '11px',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
  },

  theoremModalOverlay: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(2px)',
    zIndex: 1100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px',
  },
  theoremModalContainer: {
    width: '100%',
    maxWidth: '480px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
    overflow: 'hidden',
  },
  theoremModalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid #e2e8f0',
  },
  theoremModalBody: {
    padding: '16px',
  },
  placeholderBox: {
    marginTop: '12px',
    padding: '12px',
    backgroundColor: '#f8fafc',
    borderRadius: '6px',
    border: '1px dashed #cbd5e1',
    textAlign: 'center' as const,
  },
  theoremModalFooter: {
    padding: '12px 16px',
    backgroundColor: '#f8fafc',
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  closeModalButton: {
    backgroundColor: '#0f172a',
    color: '#ffffff',
    border: 'none',
    padding: '6px 14px',
    borderRadius: '6px',
    fontWeight: 'bold' as const,
    fontSize: '12px',
    cursor: 'pointer',
  }
}