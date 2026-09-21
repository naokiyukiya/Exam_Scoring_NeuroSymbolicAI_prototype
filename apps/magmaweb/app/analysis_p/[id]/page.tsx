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
  Sparkles 
} from 'lucide-react'

// 研究用グラフデータの型宣言
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
  
  // 厳密な構造化DAGデータをステートで持つ
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  
  // AIが生成したグラフ構築用プログラム（JSON文字列）をそのまま保持するステート
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

        // ① posts から該当の答案データを取得
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

        // ② ★物理用API (/api/analyze/physics) を呼び出す
        const res = await fetch(`/api/analyze/physics?answerId=${params.id}`, {
          method: 'GET',
        })

        const json = await res.json()

        // HTTPステータスが200以外のエラーだった場合
        if (!res.ok) {
          setDebugError(`APIがエラーステータス ${res.status} を返しました`)
          setDebugDetails(json.error + (json.details ? `\n${json.details}` : ''))
          return
        }

        // 200が戻ってきたが、APIの内部パースエラーなどで error フラグが入っている場合
        if (json.error) {
          setDebugError(json.error)
          if (json.rawText) setDebugRawText(json.rawText)
          return
        }
        
        // APIから戻ってきた { imageUrl, graph } の構造から graph を抽出
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

  // ★ 物理用論理・数式検証ボタンの処理 ( /api/verify または SymPy検証用 )
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

  // --- 一歩ごとの解説モード関連の計算 ---
  const inferenceNodes = graphData?.nodes.filter(n => n.type === 'inference') || []
  const currentInference = inferenceNodes[currentStepIndex]

  // 現在注目している推論ノードの入力（前段）ノードと出力（後段）ノードを取得
  const inputNodeIds = graphData?.edges.filter(e => e.to === currentInference?.id).map(e => e.from) || []
  const outputNodeIds = graphData?.edges.filter(e => e.from === currentInference?.id).map(e => e.to) || []

  const inputNodes = graphData?.nodes.filter(n => inputNodeIds.includes(n.id)) || []
  const outputNodes = graphData?.nodes.filter(n => outputNodeIds.includes(n.id)) || []

  if (loading) {
    return <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>物理構造の解析中…</div>
  }

  if (!answerData) {
    return <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>答案が見つかりませんでした</div>
  }

  return (
    <div style={styles.container}>
      {/* ヘッダーエリア */}
      <div style={styles.header}>
        <button onClick={() => router.back()} style={styles.backButton}>
          <CircleArrowLeft size={30} />
        </button>
        <h1 style={styles.title}>物理構造・推論 診断書</h1>
      </div>

      {/* デバッグモニター */}
      {(debugError || debugDetails || debugRawText) && (
        <div style={styles.debugBox}>
          <div style={styles.debugHeader}>
            <AlertTriangle size={20} color="#ff4d4d" />
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

        {/* 右側：解析された物理DAG構造可視化エリア */}
        <div style={styles.analysisSection}>
          <div style={styles.analysisHeaderRow}>
            <div style={styles.analysisHeader}>
              <Layers size={20} color="#4D96FF" />
              <span style={styles.analysisTitle}>解析された物理推論のDAG構造</span>
            </div>
            <button 
              onClick={handleVerify} 
              disabled={isVerifying || !graphData}
              style={styles.verifyButton}
            >
              {isVerifying ? '検証中...' : '物理推論を検証する'}
            </button>
          </div>

          {/* ★ 一歩ごとの解説モード起動アクションエリア */}
          {graphData && inferenceNodes.length > 0 && (
            <div style={styles.stepLauncherBanner}>
              <div style={styles.stepLauncherTextGroup}>
                <div style={styles.stepLauncherTitle}>
                  <Sparkles size={18} color="#6366f1" />
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
                <Footprints size={18} />
                一歩ごとの解説モードをスタート
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
              <h3 style={styles.codeTitle}>📝 物理グラフ構築プログラム (JSONデータ)</h3>
              <pre style={styles.codeBlock}>
                {rawGraphData}
              </pre>
            </div>
          )}
        </div>
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
                <Footprints size={22} color="#6366f1" />
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
              >
                <X size={22} />
              </button>
            </div>

            {/* モーダルメイン表示部 */}
            <div style={styles.modalBody}>
              {/* ステップカード */}
              <div style={styles.stepCard}>
                <h3 style={styles.stepCardTitle}>【このステップで行われている変形・推論】</h3>
                
                <div style={styles.stepGrid}>
                  {/* 前の式（Inputs） */}
                  <div style={styles.stepBox}>
                    <span style={styles.inputBadge}>【使う前提・根拠】</span>
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
                    <span style={styles.inferenceBadge}>【適用した考え方・定理】</span>
                    <p style={styles.inferenceText}>
                      {currentInference.label}
                    </p>
                  </div>

                  {/* 次の式（Outputs） */}
                  <div style={styles.stepBox}>
                    <span style={styles.outputBadge}>【導かれる結果】</span>
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

              {/* 熱い定理解説への導線カード💪 */}
              <div style={styles.theoremBanner}>
                <div style={styles.theoremBannerText}>
                  <div style={styles.theoremBannerTitle}>
                    <BookOpen size={20} color="#818cf8" />
                    <span>この思考ステップに不安はありますか？</span>
                  </div>
                  <p style={styles.theoremBannerSub}>
                    「なぜこの式変形になるのか」「なぜこの定理が使えるのか」を根底から徹底解説！
                  </p>
                </div>
                <button
                  onClick={() => setSelectedTheorem(currentInference.label)}
                  style={styles.theoremButton}
                >
                  💪 定理の解説ページを見る
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
                <ArrowLeft size={16} /> 前のステップ
              </button>

              {/* ドット/番号インジケーター */}
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
                次のステップ <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 💪 俺が書く定理解説モーダル */}
      {/* ========================================================================= */}
      {selectedTheorem && (
        <div style={styles.theoremModalOverlay}>
          <div style={styles.theoremModalContainer}>
            <div style={styles.theoremModalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BookOpen size={22} color="#6366f1" />
                <h2 style={{ fontSize: 18, fontWeight: 'bold', margin: 0, color: '#1e293b' }}>
                  【執筆中解説】{selectedTheorem}
                </h2>
              </div>
              <button
                onClick={() => setSelectedTheorem(null)}
                style={styles.closeButton}
              >
                <X size={22} />
              </button>
            </div>
            
            <div style={styles.theoremModalBody}>
              <div style={styles.authorMessage}>
                💪 <strong>熱血定理解説ノート</strong>
              </div>
              <p style={{ lineHeight: 1.7, color: '#334155', fontSize: 15 }}>
                ここに <strong>{selectedTheorem}</strong> についての本質的な物理的意味、よくあるミスの罠、式の導出イメージなどを解説するオリジナルコンテンツが入ります！
              </p>
              <div style={styles.placeholderBox}>
                <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
                  ※ 定理解説コンテンツは現在制作・拡充中です。お楽しみに！
                </p>
              </div>
            </div>

            <div style={styles.theoremModalFooter}>
              <button
                onClick={() => setSelectedTheorem(null)}
                style={styles.closeModalButton}
              >
                理解できた！ステップに戻る
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
    maxWidth: '800px',
    margin: '0 auto',
    padding: '16px 8px 48px',
    backgroundColor: '#fff',
    minHeight: '100vh',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  backButton: {
    background: 'none',
    border: 'none',
    color: '#333',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
  },
  mainGrid: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 20,
  },
  cardSection: {
    width: '100%',
    filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.05))',
  },
  analysisSection: {
    background: '#f9f9fb',
    border: '1px solid #f0f0f4',
    borderRadius: '20px',
    padding: '20px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.01)',
  },
  analysisHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #eee',
    paddingBottom: 10,
    marginBottom: 14,
  },
  analysisHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  analysisTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#333',
  },
  verifyButton: {
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    padding: '6px 14px',
    borderRadius: '8px',
    fontWeight: 'bold' as const,
    fontSize: '13px',
    cursor: 'pointer',
  },

  // ★ 一歩ごとの解説モード起動バナー
  stepLauncherBanner: {
    display: 'flex',
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#eef2ff',
    border: '1px solid #c7d2fe',
    borderRadius: '12px',
    padding: '12px 16px',
    marginBottom: '16px',
    flexWrap: 'wrap' as const,
  },
  stepLauncherTextGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
  },
  stepLauncherTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontWeight: 'bold' as const,
    fontSize: '15px',
    color: '#312e81',
  },
  stepLauncherSub: {
    margin: 0,
    fontSize: '12px',
    color: '#4338ca',
  },
  stepLauncherButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#4f46e5',
    color: '#ffffff',
    border: 'none',
    padding: '10px 18px',
    borderRadius: '10px',
    fontWeight: 'bold' as const,
    fontSize: '14px',
    cursor: 'pointer',
    boxShadow: '0 4px 10px rgba(79, 70, 229, 0.25)',
    transition: 'all 0.2s',
  },

  analysisBody: {
    width: '100%',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: '14px',
    textAlign: 'center' as const,
    padding: '20px 0',
  },
  debugBox: {
    backgroundColor: '#fff5f5',
    border: '2px solid #ffcccc',
    borderRadius: '16px',
    padding: '16px',
    marginBottom: '20px',
  },
  debugHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: '12px' },
  debugTitle: { fontWeight: 'bold' as const, color: '#e53e3e', fontSize: '15px' },
  debugItem: { fontSize: '13px', color: '#2d3748', marginBottom: '8px' },
  debugPre: { backgroundColor: '#edf2f7', padding: '8px', borderRadius: '6px', overflowX: 'auto' as const, marginTop: '4px', fontFamily: 'monospace' },
  debugRawPre: { backgroundColor: '#1a202c', color: '#aeebd0', padding: '12px', borderRadius: '8px', overflowX: 'auto' as const, marginTop: '4px', fontFamily: 'monospace', fontSize: '12px', lineHeight: 1.4 },

  codeContainer: {
    marginTop: '24px',
    padding: '16px',
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    border: '1px solid #334155',
  },
  codeTitle: {
    fontSize: '15px',
    fontWeight: 'bold' as const,
    color: '#f8fafc',
    marginBottom: '12px',
    marginTop: 0,
  },
  codeBlock: {
    color: '#e2e8f0',
    fontFamily: 'Consolas, Monaco, monospace',
    fontSize: '13px',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-all' as const,
    maxHeight: '500px',
    overflowY: 'auto' as const,
    margin: 0,
  },

  // モーダル全般のスタイル
  modalOverlay: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    backdropFilter: 'blur(8px)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
  },
  modalContainer: {
    width: '100%',
    maxWidth: '850px',
    backgroundColor: '#0f172a',
    borderRadius: '20px',
    border: '1px solid #334155',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    display: 'flex',
    flexDirection: 'column' as const,
    maxHeight: '90vh',
    overflow: 'hidden',
    color: '#f8fafc',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
    borderBottom: '1px solid #1e293b',
  },
  modalHeaderTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  modalHeaderTitle: {
    fontSize: '16px',
    fontWeight: 'bold' as const,
    color: '#f8fafc',
  },
  stepBadge: {
    backgroundColor: '#312e81',
    color: '#a5b4fc',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    padding: '2px 10px',
    borderRadius: '20px',
    border: '1px solid #4338ca',
  },
  subQuestionBadge: {
    backgroundColor: '#1e293b',
    color: '#cbd5e1',
    fontSize: '12px',
    padding: '2px 8px',
    borderRadius: '6px',
    border: '1px solid #334155',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
  },
  modalBody: {
    padding: '24px',
    overflowY: 'auto' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  },
  stepCard: {
    backgroundColor: '#1e293b',
    borderRadius: '16px',
    padding: '20px',
    border: '1px solid #334155',
  },
  stepCardTitle: {
    fontSize: '13px',
    fontWeight: 'bold' as const,
    color: '#94a3b8',
    marginTop: 0,
    marginBottom: '16px',
  },
  stepGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '12px',
    alignItems: 'stretch',
  },
  stepBox: {
    backgroundColor: '#0f172a',
    borderRadius: '12px',
    padding: '14px',
    border: '1px solid #334155',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  stepCenterBox: {
    backgroundColor: 'rgba(49, 46, 129, 0.4)',
    borderRadius: '12px',
    padding: '14px',
    border: '1px solid rgba(99, 102, 241, 0.4)',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center' as const,
  },
  inputBadge: {
    fontSize: '11px',
    fontWeight: 'bold' as const,
    color: '#60a5fa',
  },
  outputBadge: {
    fontSize: '11px',
    fontWeight: 'bold' as const,
    color: '#4ade80',
  },
  inferenceBadge: {
    fontSize: '11px',
    fontWeight: 'bold' as const,
    color: '#a5b4fc',
    marginBottom: '6px',
  },
  nodeItemText: {
    fontSize: '13px',
    color: '#e2e8f0',
    fontFamily: 'monospace',
    lineHeight: 1.4,
  },
  nodeItemTextEmpty: {
    fontSize: '12px',
    color: '#64748b',
    fontStyle: 'italic',
  },
  inferenceText: {
    fontSize: '15px',
    fontWeight: 'bold' as const,
    color: '#e0e7ff',
    margin: 0,
    lineHeight: 1.4,
  },

  theoremBanner: {
    background: 'linear-gradient(135deg, rgba(49, 46, 129, 0.6) 0%, rgba(88, 28, 135, 0.6) 100%)',
    borderRadius: '16px',
    padding: '20px',
    border: '1px solid rgba(129, 140, 248, 0.3)',
    display: 'flex',
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap' as const,
  },
  theoremBannerText: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  theoremBannerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '15px',
    fontWeight: 'bold' as const,
    color: '#ffffff',
  },
  theoremBannerSub: {
    margin: 0,
    fontSize: '13px',
    color: '#cbd5e1',
  },
  theoremButton: {
    backgroundColor: '#6366f1',
    color: '#ffffff',
    border: 'none',
    padding: '12px 20px',
    borderRadius: '10px',
    fontWeight: 'bold' as const,
    fontSize: '14px',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
    whiteSpace: 'nowrap' as const,
  },

  modalFooter: {
    padding: '16px 24px',
    borderTop: '1px solid #1e293b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
  },
  navButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    border: '1px solid #334155',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
  },
  navButtonPrimary: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#6366f1',
    color: '#ffffff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
  },
  navButtonDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  stepIndicatorList: {
    display: 'flex',
    gap: '6px',
  },
  stepDot: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: '#1e293b',
    color: '#94a3b8',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: '#6366f1',
    color: '#ffffff',
    boxShadow: '0 0 0 2px #a5b4fc',
  },

  // 定理解説モーダル専用
  theoremModalOverlay: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(4px)',
    zIndex: 1100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
  },
  theoremModalContainer: {
    width: '100%',
    maxWidth: '600px',
    backgroundColor: '#ffffff',
    borderRadius: '20px',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
    overflow: 'hidden',
  },
  theoremModalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 24px',
    borderBottom: '1px solid #f1f5f9',
  },
  theoremModalBody: {
    padding: '24px',
  },
  authorMessage: {
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    color: '#166534',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '14px',
    marginBottom: '16px',
  },
  placeholderBox: {
    marginTop: '20px',
    padding: '16px',
    backgroundColor: '#f8fafc',
    borderRadius: '10px',
    border: '1px dashed #cbd5e1',
    textAlign: 'center' as const,
  },
  theoremModalFooter: {
    padding: '16px 24px',
    backgroundColor: '#f8fafc',
    borderTop: '1px solid #f1f5f9',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  closeModalButton: {
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '8px',
    fontWeight: 'bold' as const,
    fontSize: '14px',
    cursor: 'pointer',
  }
}