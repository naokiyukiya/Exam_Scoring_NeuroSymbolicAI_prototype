'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Compass,
  Eye,
  HelpCircle,
  Lightbulb,
  RotateCcw,
  Zap,
  XCircle,
  Loader2,
} from 'lucide-react'
import FormattedText from '../../components/FormattedText'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

type GraphNode = {
  id: string
  label: string
}

type StumbleRecord = {
  id: string
  user_id: string | null
  post_id: string | null
  theorem_id: string | null
  step_index: number | null
  created_at: string
  input_nodes: GraphNode[] | null
  inference_label: string | null
  output_nodes: GraphNode[] | null
}

// パターン集計用の型定義
type PatternStat = {
  label: string
  count: number
  percent: number
}

function StumbleAnalysisContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const stumbleId = searchParams.get('id')

  const [stumble, setStumble] = useState<StumbleRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [checked, setChecked] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [quizSelected, setQuizSelected] = useState<number | null>(null)

  // 動的取得用データ
  const [patterns, setPatterns] = useState<PatternStat[]>([])
  const [commonStumbles, setCommonStumbles] = useState<StumbleRecord[]>([])

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        // 1. 対象のつまずきレコード取得
        let query = supabase.from('stumbles').select('*')
        if (stumbleId) {
          query = query.eq('id', stumbleId)
        } else {
          query = query.order('created_at', { ascending: false }).limit(1)
        }

        const { data: stumbleData, error: stumbleError } = await query
        if (stumbleError) console.error('Error fetching stumble:', stumbleError)
        if (stumbleData && stumbleData.length > 0) {
          setStumble(stumbleData[0] as StumbleRecord)
        }

        // 2. 全つまずきデータを取得して「STUMBLE PATTERNS」を集計
        const { data: allStumbles, error: allError } = await supabase
          .from('stumbles')
          .select('inference_label')

        if (!allError && allStumbles) {
          const counts: Record<string, number> = {}
          allStumbles.forEach((s) => {
            const lbl = s.inference_label || '名称なしのステップ'
            counts[lbl] = (counts[lbl] || 0) + 1
          })

          const sorted = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5) // 上位5件

          const maxCount = sorted[0]?.[1] || 1
          const calculatedPatterns: PatternStat[] = sorted.map(([label, count]) => ({
            label,
            count,
            percent: Math.round((count / maxCount) * 100),
          }))

          setPatterns(calculatedPatterns)
        }

        // 3. 「COMMON PITFALLS」用に最新のつまずきリストを取得 (最大5件)
        const { data: recentStumbles, error: recentError } = await supabase
          .from('stumbles')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5)

        if (!recentError && recentStumbles) {
          setCommonStumbles(recentStumbles as StumbleRecord[])
        }
      } catch (err) {
        console.error('Unexpected error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [stumbleId])

  const goToPost = (postId: string | null, stepIndex: number | null) => {
    if (!postId) return
    router.push(`/post/${postId}${stepIndex !== null ? `?step=${stepIndex}` : ''}`)
  }

  const handleTheoremClick = (theoremId: string) => {
    router.push(`/theorems/${theoremId}`)
  }

  const quizOptions = [
    { id: 0, text: '$F = \\rho_1 V_1 g$', isCorrect: false },
    { id: 1, text: '$F = \\rho V_1 g$', isCorrect: false },
    { id: 2, text: '$F = \\rho_1 V_2 g$', isCorrect: false },
    { id: 3, text: '$F = \\rho V_2 g$', isCorrect: true },
  ]

  if (loading) {
    return (
      <div style={{ ...styles.container, alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#2563eb' }} />
        <p style={{ color: '#64748b', fontSize: '14px', marginTop: '12px' }}>つまずきデータを読み込み中...</p>
      </div>
    )
  }

  if (!stumble) {
    return (
      <div style={styles.container}>
        <div style={styles.mainCard}>
          <p style={{ color: '#64748b', textAlign: 'center', padding: '24px 0' }}>
            該当するつまずき記録が見つかりませんでした。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>つまずき分析</h1>
        <p style={styles.subtitle}>
          あなたが「つまづいた！」を押した思考ステップの記録と構造分析です
        </p>
      </header>

      {/* メインカード */}
      <section style={styles.mainCard}>
        <div style={styles.cardHeader}>
          <div style={styles.eyebrowGroup}>
            <span style={styles.stepBadge}>
              <Zap size={13} />
              要復習ステップ
            </span>
          </div>
        </div>

        <h2 style={styles.cardTitle}>
          <FormattedText
            text={stumble.inference_label || '名称なしのステップ'}
            onTheoremClick={handleTheoremClick}
          />
        </h2>

        {/* クイズカード */}
        <div style={styles.quizCard}>
          <div style={styles.quizHeader}>
            <BookOpen size={16} color="#2563eb" />
            <span style={styles.quizTitle}>まず「定理・定義」の前提チェック！</span>
          </div>

          <p style={styles.quizQuestion}>
            <FormattedText
              text="密度 $\rho_1$、体積 $V_1$ の物体を、水（密度 $\rho$）に浮かべると体積 $V_2$ 部分が水につかった。物体に働く浮力 $F$ の大きさは？（重力加速度を $g$ とする）"
              onTheoremClick={handleTheoremClick}
            />
          </p>

          <div style={styles.quizGrid}>
            {quizOptions.map((opt) => {
              const isSelected = quizSelected === opt.id
              let btnStyle = styles.quizOptionBtn
              if (isSelected) {
                btnStyle = opt.isCorrect
                  ? { ...styles.quizOptionBtn, ...styles.quizOptionCorrect }
                  : { ...styles.quizOptionBtn, ...styles.quizOptionIncorrect }
              }

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setQuizSelected(opt.id)}
                  style={btnStyle}
                >
                  <FormattedText text={opt.text} onTheoremClick={handleTheoremClick} />
                </button>
              )
            })}
          </div>

          {quizSelected !== null && (
            <div
              style={{
                ...styles.quizFeedback,
                backgroundColor: quizOptions[quizSelected].isCorrect ? '#f0fdf4' : '#fff1f2',
                borderColor: quizOptions[quizSelected].isCorrect ? '#bbf7d0' : '#fecdd3',
              }}
            >
              {quizOptions[quizSelected].isCorrect ? (
                <div style={styles.feedbackTitleCorrect}>
                  <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                  <div>
                    <FormattedText
                      text="正解！ 浮力は「押しのけた水（流体）の質量 $\rho V_2$ に働く重力」です。"
                      onTheoremClick={handleTheoremClick}
                    />
                  </div>
                </div>
              ) : (
                <div style={styles.feedbackTitleIncorrect}>
                  <XCircle size={16} style={{ flexShrink: 0 }} />
                  <div>
                    <FormattedText
                      text="残念！ 浮力で使う密度は「物体の密度 $\rho_1$」ではなく「水の密度 $\rho$」で、体積は「水没部 $V_2$」です。"
                      onTheoremClick={handleTheoremClick}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 思考ステップ構造 */}
        <div style={styles.stepCardInner}>
          <div style={styles.stepCardTitleHeader}>
            <Compass size={15} color="#64748b" />
            <span style={styles.stepCardTitle}>このステップで使われている考え方</span>
          </div>

          <div style={styles.stepGrid}>
            <div style={styles.stepBox}>
              <span style={styles.inputBadge}>使う前提・根拠</span>
              <div style={styles.nodeList}>
                {stumble.input_nodes && stumble.input_nodes.length > 0 ? (
                  stumble.input_nodes.map((node) => (
                    <div key={node.id} style={styles.nodeItem}>
                      • <FormattedText text={node.label} onTheoremClick={handleTheoremClick} />
                    </div>
                  ))
                ) : (
                  <span style={{ color: '#94a3b8' }}>前提なし</span>
                )}
              </div>
            </div>

            <div style={styles.stepCenterBox}>
              <span style={styles.inferenceBadge}>適用した考え方・定理</span>
              <p style={styles.inferenceText}>
                <FormattedText
                  text={stumble.inference_label || 'なし'}
                  onTheoremClick={handleTheoremClick}
                />
              </p>
            </div>

            <div style={styles.stepBox}>
              <span style={styles.outputBadge}>導かれる結果</span>
              {!showResult ? (
                <button
                  type="button"
                  onClick={() => setShowResult(true)}
                  style={styles.revealButton}
                >
                  <Eye size={14} />
                  タップして結果を表示
                </button>
              ) : (
                <div style={styles.nodeList}>
                  {stumble.output_nodes && stumble.output_nodes.length > 0 ? (
                    stumble.output_nodes.map((node) => (
                      <div key={node.id} style={styles.nodeItem}>
                        • <FormattedText text={node.label} onTheoremClick={handleTheoremClick} />
                      </div>
                    ))
                  ) : (
                    <span style={{ color: '#94a3b8' }}>結果なし</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          {!checked ? (
            <button
              type="button"
              onClick={() => setChecked(true)}
              style={styles.primaryButton}
            >
              <span>このステップの根拠・成り立ちを確認した</span>
              <CheckCircle2 size={16} />
            </button>
          ) : (
            <div style={styles.clearedBox}>
              <CheckCircle2 size={18} color="#16a34a" />
              <span>復習完了！次の演習時にも意識してみましょう。</span>
              <button
                type="button"
                onClick={() => {
                  setChecked(false)
                  setShowResult(false)
                }}
                style={styles.retryTextBtn}
              >
                <RotateCcw size={13} />
                戻す
              </button>
            </div>
          )}
        </div>

        {stumble.post_id && (
          <div style={styles.cardFooterAction}>
            <button
              type="button"
              style={styles.linkButton}
              onClick={() => goToPost(stumble.post_id, stumble.step_index)}
            >
              元の答案解説を見る
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </section>

      {/* STUMBLE PATTERNS (動的集計) */}
      <section style={styles.section}>
        <div style={styles.sectionEyebrow}>
          <Lightbulb size={15} />
          STUMBLE PATTERNS
        </div>
        <h3 style={styles.sectionTitle}>よくつまずく思考・定理の傾向</h3>

        <div style={styles.whiteCard}>
          <p style={styles.cardDesc}>
            つまずきデータから抽出された、特に確認が多いステップパターンです。
          </p>

          {patterns.length > 0 ? (
            patterns.map((pt, idx) => (
              <StumbleBar
                key={idx}
                label={pt.label}
                count={pt.count}
                percent={pt.percent}
                active={idx === 0}
              />
            ))
          ) : (
            <p style={{ color: '#94a3b8', fontSize: '13px' }}>集計データがまだありません。</p>
          )}
        </div>
      </section>

      {/* COMMON PITFALLS (動的取得) */}
      <section style={styles.section}>
        <div style={styles.sectionEyebrow}>
          <HelpCircle size={15} />
          COMMON PITFALLS
        </div>
        <h3 style={styles.sectionTitle}>みんながつまずきやすい思考ステップ</h3>

        <div style={styles.challengeGrid}>
          {commonStumbles.length > 0 ? (
            commonStumbles.map((item) => (
              <CommunityStumbleCard
                key={item.id}
                theorem={item.theorem_id || '定理・法則'}
                inference={item.inference_label || '思考ステップ'}
                inputs={item.input_nodes?.map((n) => n.label) || []}
                outputs={item.output_nodes?.map((n) => n.label) || []}
                count={1} // 個別つまずき件数（集計がある場合はそちらを表示）
                onClick={() => goToPost(item.post_id, item.step_index)}
                onTheoremClick={handleTheoremClick}
              />
            ))
          ) : (
            <div style={styles.whiteCard}>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
                つまずき記録がありません。
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default function StumbleAnalysisPage() {
  return (
    <main style={styles.page}>
      <Suspense
        fallback={
          <div style={{ ...styles.container, alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#2563eb' }} />
            <p style={{ color: '#64748b', fontSize: '14px', marginTop: '12px' }}>読み込み中...</p>
          </div>
        }
      >
        <StumbleAnalysisContent />
      </Suspense>
    </main>
  )
}

function StumbleBar({
  label,
  count,
  percent,
  active = false,
}: {
  label: string
  count: number
  percent: number
  active?: boolean
}) {
  return (
    <div style={styles.barRow}>
      <div style={styles.barTop}>
        <span style={styles.barLabel}>{label}</span>
        <span style={styles.barCount}>{count} 回</span>
      </div>
      <div style={styles.barTrack}>
        <div
          style={{
            ...styles.barFill,
            width: `${percent}%`,
            backgroundColor: active ? '#2563eb' : '#94a3b8',
          }}
        />
      </div>
    </div>
  )
}

function CommunityStumbleCard({
  theorem,
  inference,
  inputs,
  outputs,
  count,
  onClick,
  onTheoremClick,
}: {
  theorem: string
  inference: string
  inputs: string[]
  outputs: string[]
  count: number
  onClick: () => void
  onTheoremClick: (theoremId: string) => void
}) {
  return (
    <div style={styles.whiteCard}>
      <div style={styles.communityCardHeader}>
        <span style={styles.theoremTag}>
          <BookOpen size={13} />
          {theorem}
        </span>
        <span style={styles.countText}>{count} 人がつまずき</span>
      </div>

      <div style={styles.miniStepGrid}>
        <div style={styles.miniStepBox}>
          <span style={styles.inputBadgeMini}>前提</span>
          <div style={styles.miniText}>
            {inputs.length > 0 ? (
              inputs.map((inp, idx) => (
                <span key={idx}>
                  {idx > 0 && ' / '}
                  <FormattedText text={inp} onTheoremClick={onTheoremClick} />
                </span>
              ))
            ) : (
              <span style={{ color: '#94a3b8' }}>なし</span>
            )}
          </div>
        </div>
        <div style={styles.miniCenterBox}>
          <span style={styles.inferenceBadgeMini}>適用</span>
          <div style={styles.miniTextBold}>
            <FormattedText text={inference} onTheoremClick={onTheoremClick} />
          </div>
        </div>
        <div style={styles.miniStepBox}>
          <span style={styles.outputBadgeMini}>結果</span>
          <div style={styles.miniText}>
            {outputs.length > 0 ? (
              outputs.map((out, idx) => (
                <span key={idx}>
                  {idx > 0 && ' / '}
                  <FormattedText text={out} onTheoremClick={onTheoremClick} />
                </span>
              ))
            ) : (
              <span style={{ color: '#94a3b8' }}>なし</span>
            )}
          </div>
        </div>
      </div>

      <button type="button" onClick={onClick} style={styles.darkButton}>
        このステップを含む答案を見る
        <ArrowRight size={15} />
      </button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: '24px 16px',
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  container: {
    maxWidth: '680px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  header: {
    marginBottom: '0px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#0f172a',
    margin: '0 0 4px 0',
  },
  subtitle: {
    fontSize: '13px',
    color: '#64748b',
    margin: 0,
  },
  mainCard: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '20px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  eyebrowGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  stepBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#2563eb',
    backgroundColor: '#eff6ff',
    padding: '4px 10px',
    borderRadius: '20px',
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    margin: '0 0 16px 0',
    color: '#0f172a',
    lineHeight: 1.4,
  },
  quizCard: {
    backgroundColor: '#f8fafc',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid #e2e8f0',
    marginBottom: '16px',
  },
  quizHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '8px',
  },
  quizTitle: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#1e40af',
  },
  quizQuestion: {
    fontSize: '13px',
    color: '#334155',
    lineHeight: 1.5,
    margin: '0 0 12px 0',
  },
  quizGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: '8px',
  },
  quizOptionBtn: {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#1e293b',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'center',
  },
  quizOptionCorrect: {
    backgroundColor: '#dcfce7',
    borderColor: '#4ade80',
    color: '#15803d',
    fontWeight: 'bold',
  },
  quizOptionIncorrect: {
    backgroundColor: '#ffe4e6',
    borderColor: '#fb7185',
    color: '#be123c',
  },
  quizFeedback: {
    marginTop: '12px',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid',
    fontSize: '12px',
    lineHeight: 1.4,
  },
  feedbackTitleCorrect: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '6px',
    color: '#15803d',
    fontWeight: 'bold',
  },
  feedbackTitleIncorrect: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '6px',
    color: '#be123c',
    fontWeight: 'bold',
  },
  stepCardInner: {
    backgroundColor: '#f8fafc',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid #e2e8f0',
  },
  stepCardTitleHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '12px',
  },
  stepCardTitle: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#475569',
  },
  stepGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px',
  },
  stepBox: {
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    padding: '12px',
    border: '1px solid #cbd5e1',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  stepCenterBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: '10px',
    padding: '12px',
    border: '1px solid #86efac',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  inputBadge: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#1d4ed8',
    backgroundColor: '#eff6ff',
    padding: '2px 6px',
    borderRadius: '4px',
    alignSelf: 'flex-start',
  },
  inferenceBadge: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#15803d',
    backgroundColor: '#dcfce7',
    padding: '2px 6px',
    borderRadius: '4px',
    alignSelf: 'flex-start',
  },
  outputBadge: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#047857',
    backgroundColor: '#ecfdf5',
    padding: '2px 6px',
    borderRadius: '4px',
    alignSelf: 'flex-start',
  },
  nodeList: {
    fontSize: '12px',
    color: '#334155',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    lineHeight: 1.4,
  },
  nodeItem: {
    wordBreak: 'break-word',
  },
  inferenceText: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#166534',
    margin: 0,
    lineHeight: 1.4,
  },
  revealButton: {
    backgroundColor: '#f1f5f9',
    border: '1px dashed #94a3b8',
    borderRadius: '6px',
    padding: '10px',
    color: '#475569',
    fontSize: '12px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    cursor: 'pointer',
    width: '100%',
  },
  primaryButton: {
    width: '100%',
    padding: '12px',
    borderRadius: '10px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    fontWeight: 'bold',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    cursor: 'pointer',
  },
  clearedBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#f0fdf4',
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1px solid #bbf7d0',
    color: '#166534',
    fontSize: '13px',
    fontWeight: 500,
  },
  retryTextBtn: {
    marginLeft: 'auto',
    background: 'none',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
  },
  cardFooterAction: {
    marginTop: '12px',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  linkButton: {
    background: 'none',
    border: 'none',
    color: '#2563eb',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sectionEyebrow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#2563eb',
    letterSpacing: '0.05em',
  },
  sectionTitle: {
    fontSize: '17px',
    fontWeight: 'bold',
    color: '#0f172a',
    margin: '0 0 4px 0',
  },
  whiteCard: {
    backgroundColor: '#ffffff',
    borderRadius: '14px',
    padding: '18px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
  },
  cardDesc: {
    fontSize: '13px',
    color: '#64748b',
    margin: '0 0 16px 0',
  },
  barRow: {
    marginBottom: '12px',
  },
  barTop: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    marginBottom: '4px',
  },
  barLabel: {
    color: '#1e293b',
    fontWeight: 500,
  },
  barCount: {
    color: '#64748b',
    fontSize: '12px',
  },
  barTrack: {
    height: '8px',
    backgroundColor: '#f1f5f9',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: '4px',
  },
  challengeGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  communityCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  theoremTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#1d4ed8',
    backgroundColor: '#eff6ff',
    padding: '3px 8px',
    borderRadius: '6px',
  },
  countText: {
    fontSize: '12px',
    color: '#d97706',
    fontWeight: 'bold',
  },
  miniStepGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '8px',
    backgroundColor: '#f8fafc',
    padding: '10px',
    borderRadius: '10px',
    marginBottom: '12px',
  },
  miniStepBox: {
    backgroundColor: '#ffffff',
    padding: '8px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
  },
  miniCenterBox: {
    backgroundColor: '#f0fdf4',
    padding: '8px',
    borderRadius: '6px',
    border: '1px solid #bbf7d0',
  },
  inputBadgeMini: {
    fontSize: '10px',
    fontWeight: 'bold',
    color: '#2563eb',
  },
  inferenceBadgeMini: {
    fontSize: '10px',
    fontWeight: 'bold',
    color: '#16a34a',
  },
  outputBadgeMini: {
    fontSize: '10px',
    fontWeight: 'bold',
    color: '#059669',
  },
  miniText: {
    fontSize: '11px',
    color: '#475569',
    marginTop: '2px',
  },
  miniTextBold: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#15803d',
    marginTop: '2px',
  },
  darkButton: {
    width: '100%',
    padding: '10px',
    borderRadius: '8px',
    backgroundColor: '#0f172a',
    color: '#ffffff',
    border: 'none',
    fontSize: '13px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    cursor: 'pointer',
  },
}