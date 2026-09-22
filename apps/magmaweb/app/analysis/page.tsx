'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Flame,
  Lightbulb,
  Target,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'

export default function AnalysisPage() {
  const router = useRouter()

  // 今日の伸びしろのミニ問題
  const [answer, setAnswer] = useState('')
  const [checked, setChecked] = useState(false)

  const correctAnswer = '3'

  const checkAnswer = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!answer.trim()) return
    setChecked(true)
  }

  const resetAnswer = () => {
    setAnswer('')
    setChecked(false)
  }

  // 実際の問題ページへ移動
  const goToQuestion = (id: number) => {
    router.push(`/question/${id}`)
  }

  // 全角数字を半角数字に変換して判定
  const normalizedAnswer = answer
    .trim()
    .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
  const isCorrect = normalizedAnswer === correctAnswer

  return (
    <main style={styles.page}>
      <div style={styles.container}>

        {/* HEADER */}
        <header style={styles.header}>
          <h1 style={styles.title}>誤り分析</h1>
          <p style={styles.subtitle}>
            あなたの「つまずき・思考のパターン」を分析します
          </p>
        </header>

        {/* ================================================== */}
        {/* 今日の伸びしろ */}
        {/* ================================================== */}

        <section style={styles.growthCard}>
          <div style={styles.growthHeader}>
            <div>
              <div style={styles.eyebrowWhite}>
                <Zap size={15} />
                今日の伸びしろ
              </div>

              <h2 style={styles.growthTitle}>式の整理</h2>

              <p style={styles.growthDescription}>
                最近の誤答の中で、
                <strong>「式の整理」</strong>
                が一番多く見られました。
              </p>
            </div>

            <div style={styles.countCircle}>
              <strong>6</strong>
              <span>回</span>
            </div>
          </div>

          {/* ミニ問題 */}
          <div style={styles.miniProblem}>
            <div style={styles.miniProblemLabel}>
              🔥 リベンジ問題
            </div>

            <p style={styles.problemText}>
              次の式を整理し、$a$ の値を求めなさい。
            </p>

            <div style={styles.mathBox}>
              <span>2a + 3 = 9</span>
            </div>

            {!checked ? (
              <form onSubmit={checkAnswer}>
                <label htmlFor="answer-input" style={styles.inputLabel}>
                  答えを入力
                </label>

                <input
                  id="answer-input"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="例: 3"
                  style={styles.answerInput}
                />

                <button
                  type="submit"
                  disabled={!answer.trim()}
                  style={{
                    ...styles.primaryButton,
                    opacity: answer.trim() ? 1 : 0.55,
                    cursor: answer.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  答えを確認
                  <ArrowRight size={17} />
                </button>
              </form>
            ) : (
              <div>
                {isCorrect ? (
                  <div style={styles.correctBox}>
                    <CheckCircle2 size={24} style={{ flexShrink: 0 }} />
                    <div>
                      <strong>正解！🎉</strong>
                      <p style={{ margin: '2px 0 0 0', fontSize: '13px' }}>
                        「式の整理」を1問クリアしました！
                      </p>
                    </div>
                  </div>
                ) : (
                  <div style={styles.incorrectBox}>
                    <XCircle size={24} style={{ flexShrink: 0 }} />
                    <div>
                      <strong>もう一度！</strong>
                      <p style={{ margin: '2px 0 0 0', fontSize: '13px' }}>
                        今回も式の整理でつまずいているようです。
                      </p>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={resetAnswer}
                  style={styles.retryButton}
                >
                  もう一度答える
                </button>
              </div>
            )}
          </div>

          <p style={styles.growthNote}>
            ※ リベンジ問題は、最近の誤りをもとにした練習問題です。
          </p>
        </section>

        {/* ================================================== */}
        {/* ミスのクセ */}
        {/* ================================================== */}

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.sectionEyebrow}>
                <Target size={16} />
                ERROR PATTERN
              </div>
              <h2 style={styles.sectionTitle}>
                あなたのミスのクセ
              </h2>
            </div>
          </div>

          <div style={styles.card}>
            <p style={styles.cardDescription}>
              これまでの解答から、間違いが多かったポイントを集計しています。
            </p>

            <ErrorBar
              label="式の整理"
              count={6}
              percent={100}
              active
            />

            <ErrorBar
              label="符号のミス"
              count={4}
              percent={67}
            />

            <ErrorBar
              label="代入のミス"
              count={2}
              percent={34}
            />

            <ErrorBar
              label="計算ミス"
              count={1}
              percent={17}
            />
          </div>
        </section>

        {/* ================================================== */}
        {/* ここまで合っていました */}
        {/* ================================================== */}

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.sectionEyebrow}>
                <Lightbulb size={16} />
                THINKING PATH
              </div>
              <h2 style={styles.sectionTitle}>
                ここまで合っていました！
              </h2>
            </div>
          </div>

          <div style={styles.pathCard}>
            <p style={styles.pathDescription}>
              この問題では、ここまでは正しく考えられていました。
            </p>

            <div style={styles.path}>
              <div style={styles.pathItem}>
                <div style={styles.pathNumber}>1</div>
                <div style={styles.pathTextGroup}>
                  <strong>前提条件の整理</strong>
                  <span style={styles.pathSubText}>正しく把握できています</span>
                </div>
              </div>

              <div style={styles.pathLine} />

              <div style={styles.pathItem}>
                <div style={styles.pathNumber}>2</div>
                <div style={styles.pathTextGroup}>
                  <strong>式を立てる</strong>
                  <span style={styles.pathSubText}>ここも正しくできています</span>
                </div>
              </div>

              <div style={styles.pathLine} />

              <div
                style={{
                  ...styles.pathItem,
                  ...styles.pathError,
                }}
              >
                <div style={styles.pathErrorNumber}>!</div>
                <div style={styles.pathTextGroup}>
                  <strong>式を整理する</strong>
                  <span style={styles.pathSubTextError}>今回つまずいたポイント</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              style={styles.outlineButton}
              onClick={() => goToQuestion(1)}
            >
              この問題を詳しく見る
              <ChevronRight size={17} />
            </button>
          </div>
        </section>

        {/* ================================================== */}
        {/* 単元別おすすめ */}
        {/* ================================================== */}

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.sectionEyebrow}>
                <BookOpen size={16} />
                RECOMMENDED
              </div>

              <h2 style={styles.sectionTitle}>
                単元別おすすめ問題
              </h2>
            </div>
          </div>

          <p style={styles.sectionDescription}>
            自分で単元を選んで、実際の問題に挑戦できます。
          </p>

          <div style={styles.topicGrid}>
            <TopicCard
              title="力学"
              reason="式の整理・立式を重点的に"
              stars="★★★★★"
              onClick={() => goToQuestion(1)}
            />

            <TopicCard
              title="熱力学"
              reason="最近の正答率が高め"
              stars="★★★★☆"
              onClick={() => goToQuestion(2)}
            />

            <TopicCard
              title="波動"
              reason="少し久しぶりの単元"
              stars="★★★☆☆"
              onClick={() => goToQuestion(3)}
            />

            <TopicCard
              title="電磁気"
              reason="次に挑戦したい単元"
              stars="★★☆☆☆"
              onClick={() => goToQuestion(4)}
            />
          </div>
        </section>

        {/* ================================================== */}
        {/* みんなのつまずき傾向 */}
        {/* ================================================== */}

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.sectionEyebrow}>
                <Users size={16} />
                COMMON PITFALLS
              </div>

              <h2 style={styles.sectionTitle}>
                みんなが苦戦したポイント
              </h2>
            </div>
          </div>

          <p style={styles.sectionDescription}>
            他のユーザーが論理展開や整理でつまずきやすかったステップです。
          </p>

          <div style={styles.challengeGrid}>
            <ChallengeCard
              icon={<AlertTriangle size={20} />}
              badge="多くの人がつまずくステップ"
              title="文字式の置き換えに伴う範囲制限"
              description="t = sinθ + cosθ と置いた際の t の取り得る値の範囲設定で誤りが多発しています。"
              stats="直近の誤答率 42%"
              buttonText="類似の思考ステップに挑戦"
              onClick={() => goToQuestion(5)}
            />

            <ChallengeCard
              icon={<Flame size={20} />}
              badge="正解率の低い思考ノード"
              title="極限における不等式の挟み込み"
              description="直接極限を求められない場合の評価式の構築で評価が不十分になりがちです。"
              stats="直近の誤答率 58%"
              buttonText="このノードを検証する"
              onClick={() => goToQuestion(6)}
            />
          </div>

          <div style={styles.anonymousNote}>
            <Users size={14} style={{ flexShrink: 0 }} />
            <span>
              ※ 投稿された証明ステップの構造分析データから匿名で自動抽出しています。
            </span>
          </div>
        </section>

        {/* FOOTER */}
        <p style={styles.footerText}>
          ※ 現在表示されている分析・ピックアップデータはUI確認用のプロトタイプ表示です。
        </p>

      </div>
    </main>
  )
}

/* ================================================== */
/* サブコンポーネント */
/* ================================================== */

function ErrorBar({
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
    <div style={styles.errorRow}>
      <div style={styles.errorTop}>
        <span style={styles.errorLabel}>{label}</span>
        <span style={styles.errorCount}>{count}回</span>
      </div>
      <div style={styles.errorTrack}>
        <div
          style={{
            ...styles.errorFill,
            width: `${percent}%`,
            opacity: active ? 1 : 0.7,
          }}
        />
      </div>
    </div>
  )
}

function TopicCard({
  title,
  reason,
  stars,
  onClick,
}: {
  title: string
  reason: string
  stars: string
  onClick: () => void
}) {
  return (
    <div style={styles.topicCard}>
      <div style={styles.topicIcon}>
        <BookOpen size={18} />
      </div>
      <h3 style={styles.topicTitle}>{title}</h3>
      <p style={styles.topicReason}>{reason}</p>
      <div style={styles.stars}>{stars}</div>
      <button type="button" onClick={onClick} style={styles.topicButton}>
        問題を見る
        <ChevronRight size={15} />
      </button>
    </div>
  )
}

function ChallengeCard({
  icon,
  badge,
  title,
  description,
  stats,
  buttonText,
  onClick,
}: {
  icon: React.ReactNode
  badge: string
  title: string
  description: string
  stats: string
  buttonText: string
  onClick: () => void
}) {
  return (
    <div style={styles.challengeCard}>
      <div style={styles.challengeTop}>
        <div style={styles.challengeIcon}>{icon}</div>
        <span style={styles.challengeBadge}>{badge}</span>
      </div>

      <h3 style={styles.challengeTitle}>{title}</h3>
      <p style={styles.challengeDescription}>{description}</p>
      <p style={styles.challengeStats}>{stats}</p>

      <button type="button" onClick={onClick} style={styles.challengeButton}>
        {buttonText}
        <ArrowRight size={16} />
      </button>
    </div>
  )
}

/* ================================================== */
/* スタイル定義 (In-line CSS Objects) */
/* ================================================== */

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: '24px 16px',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    minHeight: '100vh',
  },
  container: {
    maxWidth: '768px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '32px',
  },
  header: {
    marginBottom: '8px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#ffffff',
    margin: '0 0 8px 0',
  },
  subtitle: {
    fontSize: '14px',
    color: '#94a3b8',
    margin: 0,
  },
  growthCard: {
    backgroundColor: '#1e293b',
    borderRadius: '16px',
    padding: '20px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
  },
  growthHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
  },
  eyebrowWhite: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#60a5fa',
    marginBottom: '4px',
  },
  growthTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    margin: '0 0 6px 0',
    color: '#ffffff',
  },
  growthDescription: {
    fontSize: '14px',
    color: '#cbd5e1',
    margin: 0,
  },
  countCircle: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '2px',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    padding: '8px 12px',
    borderRadius: '12px',
    color: '#60a5fa',
  },
  miniProblem: {
    backgroundColor: '#0f172a',
    borderRadius: '12px',
    padding: '16px',
    marginTop: '16px',
    border: '1px solid #334155',
  },
  miniProblemLabel: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#f59e0b',
    marginBottom: '8px',
  },
  problemText: {
    fontSize: '14px',
    color: '#e2e8f0',
    margin: '0 0 12px 0',
  },
  mathBox: {
    backgroundColor: '#1e293b',
    padding: '12px',
    borderRadius: '8px',
    textAlign: 'center',
    fontFamily: 'monospace',
    fontSize: '16px',
    color: '#38bdf8',
    marginBottom: '16px',
  },
  inputLabel: {
    display: 'block',
    fontSize: '12px',
    color: '#94a3b8',
    marginBottom: '6px',
  },
  answerInput: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    backgroundColor: '#1e293b',
    border: '1px solid #475569',
    color: '#ffffff',
    fontSize: '14px',
    marginBottom: '12px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  primaryButton: {
    width: '100%',
    padding: '10px',
    borderRadius: '8px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  correctBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    color: '#4ade80',
    padding: '12px',
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    borderRadius: '8px',
    marginBottom: '12px',
  },
  incorrectBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    color: '#f87171',
    padding: '12px',
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    borderRadius: '8px',
    marginBottom: '12px',
  },
  retryButton: {
    width: '100%',
    padding: '8px',
    borderRadius: '8px',
    backgroundColor: '#334155',
    color: '#cbd5e1',
    border: 'none',
    cursor: 'pointer',
  },
  growthNote: {
    fontSize: '11px',
    color: '#64748b',
    marginTop: '12px',
    marginBottom: 0,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionEyebrow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    fontWeight: 'bold',
    letterSpacing: '0.05em',
    color: '#38bdf8',
    marginBottom: '2px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#f8fafc',
    margin: 0,
  },
  sectionDescription: {
    fontSize: '13px',
    color: '#94a3b8',
    margin: 0,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid #334155',
  },
  cardDescription: {
    fontSize: '13px',
    color: '#94a3b8',
    marginTop: 0,
    marginBottom: '16px',
  },
  errorRow: {
    marginBottom: '12px',
  },
  errorTop: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    marginBottom: '4px',
  },
  errorLabel: {
    color: '#e2e8f0',
  },
  errorCount: {
    color: '#94a3b8',
  },
  errorTrack: {
    height: '6px',
    backgroundColor: '#334155',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  errorFill: {
    height: '100%',
    backgroundColor: '#38bdf8',
    borderRadius: '3px',
  },
  pathCard: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid #334155',
  },
  pathDescription: {
    fontSize: '13px',
    color: '#94a3b8',
    margin: '0 0 16px 0',
  },
  path: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '16px',
  },
  pathItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: '#0f172a',
    padding: '10px 12px',
    borderRadius: '8px',
    fontSize: '13px',
  },
  pathTextGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
  pathSubText: {
    fontSize: '12px',
    color: '#94a3b8',
  },
  pathSubTextError: {
    fontSize: '12px',
    color: '#f87171',
  },
  pathNumber: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: '#1e293b',
    color: '#38bdf8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 'bold',
    flexShrink: 0,
  },
  pathLine: {
    width: '2px',
    height: '8px',
    backgroundColor: '#334155',
    marginLeft: '21px',
  },
  pathError: {
    border: '1px solid rgba(248, 113, 113, 0.4)',
    backgroundColor: 'rgba(248, 113, 113, 0.05)',
  },
  pathErrorNumber: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: '#ef4444',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 'bold',
    flexShrink: 0,
  },
  outlineButton: {
    width: '100%',
    padding: '10px',
    borderRadius: '8px',
    backgroundColor: 'transparent',
    border: '1px solid #475569',
    color: '#e2e8f0',
    fontSize: '13px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    cursor: 'pointer',
  },
  topicGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: '12px',
    marginTop: '8px',
  },
  topicCard: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    padding: '14px',
    border: '1px solid #334155',
    display: 'flex',
    flexDirection: 'column',
  },
  topicIcon: {
    color: '#38bdf8',
    marginBottom: '8px',
  },
  topicTitle: {
    fontSize: '15px',
    fontWeight: 'bold',
    margin: '0 0 4px 0',
    color: '#f8fafc',
  },
  topicReason: {
    fontSize: '12px',
    color: '#94a3b8',
    margin: '0 0 8px 0',
    flexGrow: 1,
  },
  stars: {
    color: '#f59e0b',
    fontSize: '11px',
    marginBottom: '12px',
  },
  topicButton: {
    width: '100%',
    padding: '6px',
    borderRadius: '6px',
    backgroundColor: '#334155',
    color: '#f8fafc',
    border: 'none',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  challengeGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '8px',
  },
  challengeCard: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid #334155',
  },
  challengeTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  challengeIcon: {
    color: '#f59e0b',
    display: 'flex',
    alignItems: 'center',
  },
  challengeBadge: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  challengeTitle: {
    fontSize: '15px',
    fontWeight: 'bold',
    margin: '0 0 4px 0',
    color: '#f8fafc',
  },
  challengeDescription: {
    fontSize: '13px',
    color: '#94a3b8',
    margin: '0 0 8px 0',
  },
  challengeStats: {
    fontSize: '11px',
    color: '#64748b',
    margin: '0 0 12px 0',
  },
  challengeButton: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '6px',
    backgroundColor: '#2563eb',
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
  anonymousNote: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    color: '#64748b',
    marginTop: '4px',
  },
  footerText: {
    fontSize: '11px',
    color: '#475569',
    textAlign: 'center',
    marginTop: '16px',
  },
}