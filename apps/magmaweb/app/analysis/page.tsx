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
  TrendingUp,
  Trophy,
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

  const checkAnswer = () => {
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

  const isCorrect = answer.trim() === correctAnswer

  return (
    <main style={styles.page}>
      <div style={styles.container}>

        {/* HEADER */}
        <header style={styles.header}>
          <div style={styles.logo}>MAGMATHE</div>
          <h1 style={styles.title}>誤り分析</h1>
          <p style={styles.subtitle}>
            あなたの「間違い方」を分析します
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
              次の式を整理しなさい。
            </p>

            <div style={styles.mathBox}>
              <span>2a + 3 = 9</span>
            </div>

            {!checked ? (
              <>
                <label style={styles.inputLabel}>
                  答えを入力
                </label>

                <input
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="答えを入力してください"
                  style={styles.answerInput}
                />

                <button
                  type="button"
                  onClick={checkAnswer}
                  disabled={!answer.trim()}
                  style={{
                    ...styles.primaryButton,
                    opacity: answer.trim() ? 1 : 0.55,
                    cursor: answer.trim() ? 'pointer' : 'default',
                  }}
                >
                  答えを確認
                  <ArrowRight size={17} />
                </button>
              </>
            ) : (
              <div>
                {isCorrect ? (
                  <div style={styles.correctBox}>
                    <CheckCircle2 size={24} />
                    <div>
                      <strong>正解！🎉</strong>
                      <p>
                        「式の整理」を1問クリアしました！
                      </p>
                    </div>
                  </div>
                ) : (
                  <div style={styles.incorrectBox}>
                    <XCircle size={24} />
                    <div>
                      <strong>もう一度！</strong>
                      <p>
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
              これまでの解答から、間違いが多かったポイントを
              集計しています。
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
                <div>
                  <strong>解と係数の関係</strong>
                  <span>正しく利用できています</span>
                </div>
              </div>

              <div style={styles.pathLine} />

              <div style={styles.pathItem}>
                <div style={styles.pathNumber}>2</div>
                <div>
                  <strong>式を立てる</strong>
                  <span>ここも正しくできています</span>
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
                <div>
                  <strong>式を整理する</strong>
                  <span>今回つまずいたポイント</span>
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
              title="二次方程式"
              reason="式の整理を重点的に"
              stars="★★★★★"
              onClick={() => goToQuestion(1)}
            />

            <TopicCard
              title="二次関数"
              reason="最近の正答率が高め"
              stars="★★★★☆"
              onClick={() => goToQuestion(2)}
            />

            <TopicCard
              title="三角関数"
              reason="少し久しぶりの単元"
              stars="★★★☆☆"
              onClick={() => goToQuestion(3)}
            />

            <TopicCard
              title="微分"
              reason="次に挑戦したい単元"
              stars="★★☆☆☆"
              onClick={() => goToQuestion(4)}
            />

          </div>
        </section>

        {/* ================================================== */}
        {/* 最近の成長 */}
        {/* ================================================== */}

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.sectionEyebrow}>
                <TrendingUp size={16} />
                PROGRESS
              </div>

              <h2 style={styles.sectionTitle}>
                最近の成長
              </h2>
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.progressHeader}>
              <div>
                <p style={styles.smallLabel}>
                  最近の正答率
                </p>

                <div style={styles.progressNumbers}>
                  <span>72%</span>
                  <ArrowRight size={20} />
                  <strong>81%</strong>
                </div>
              </div>

              <div style={styles.upBadge}>
                +9pt
              </div>
            </div>

            <div style={styles.progressTrack}>
              <div
                style={{
                  ...styles.progressFill,
                  width: '81%',
                }}
              />
            </div>

            <p style={styles.progressComment}>
              前よりも正しく解ける問題が増えています。
            </p>
          </div>
        </section>

        {/* ================================================== */}
        {/* できるようになったこと */}
        {/* ================================================== */}

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.sectionEyebrow}>
                <Trophy size={16} />
                ACHIEVEMENT
              </div>

              <h2 style={styles.sectionTitle}>
                できるようになったこと
              </h2>
            </div>
          </div>

          <div style={styles.achievementList}>

            <div style={styles.achievement}>
              <div style={styles.achievementIcon}>
                <CheckCircle2 size={21} />
              </div>

              <div>
                <strong>二次方程式の基本的な立式</strong>
                <p>
                  問題文から必要な式を立てられるようになりました。
                </p>
              </div>
            </div>

            <div style={styles.achievement}>
              <div style={styles.achievementIcon}>
                <CheckCircle2 size={21} />
              </div>

              <div>
                <strong>解と係数の関係</strong>
                <p>
                  α＋β、αβの関係を正しく利用できています。
                </p>
              </div>
            </div>

          </div>
        </section>

        {/* ================================================== */}
        {/* みんなの学習 */}
        {/* ================================================== */}

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.sectionEyebrow}>
                <Users size={16} />
                EVERYONE'S LEARNING
              </div>

              <h2 style={styles.sectionTitle}>
                みんなの学習
              </h2>
            </div>
          </div>

          <p style={styles.sectionDescription}>
            みんなの投稿データから、人気の問題や
            みんなが苦戦している問題を紹介します。
          </p>

          {/* 人気問題 */}
          <ChallengeCard
            icon={<Flame size={21} />}
            badge="今週人気"
            title="二次関数の最大・最小"
            description="たくさんの人が挑戦している問題です。"
            stats="128件の解答が投稿されています"
            buttonText="この問題に挑戦"
            onClick={() => goToQuestion(5)}
          />

          {/* 低正答率 */}
          <ChallengeCard
            icon={<AlertTriangle size={21} />}
            badge="みんなが苦戦中"
            title="因数分解を利用した二次方程式"
            description="正答率32%。みんなが苦戦している問題です。"
            stats="84件の解答 ・ 正答率32%"
            buttonText="この問題に挑戦"
            onClick={() => goToQuestion(6)}
          />

          {/* 正解者ゼロ */}
          <ChallengeCard
            icon={<Trophy size={21} />}
            badge="正解者募集中！"
            title="チャレンジ問題 #204"
            description="まだ正解者はいません。あなたが最初の正解者になるかも！"
            stats="17件の解答 ・ 正解者0人"
            buttonText="挑戦する"
            onClick={() => goToQuestion(7)}
          />

          <div style={styles.anonymousNote}>
            <Users size={15} />
            <span>
              みんなの学習では、個人が特定されない形で集計しています。
            </span>
          </div>
        </section>

        {/* FOOTER */}

        <p style={styles.footerText}>
          ※ 現在表示されている分析値・おすすめはUI確認用の仮データです。
          実装時にはSupabaseの解答データから自動生成します。
        </p>

      </div>
    </main>
  )
}


/* ================================================== */
/* ミスの棒グラフ */
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
        <span style={styles.errorLabel}>
          {label}
        </span>

        <span style={styles.errorCount}>
          {count}回
        </span>
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


/* ================================================== */
/* 単元カード */
/* ================================================== */

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

      <h3 style={styles.topicTitle}>
        {title}
      </h3>

      <p style={styles.topicReason}>
        {reason}
      </p>

      <div style={styles.stars}>
        {stars}
      </div>

      <button
        type="button"
        onClick={onClick}
        style={styles.topicButton}
      >
        問題を見る
        <ChevronRight size={15} />
      </button>
    </div>
  )
}


/* ================================================== */
/* みんなの挑戦カード */
/* ================================================== */

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
        <div style={styles.challengeIcon}>
          {icon}
        </div>

        <span style={styles.challengeBadge}>
          {badge}
        </span>
      </div>

      <h3 style={styles.challengeTitle}>
        {title}
      </h3>

      <p style={styles.challengeDescription}>
        {description}
      </p>

      <p style={styles.challengeStats}>
        {stats}
      </p>

      <button
        type="button"
        onClick={onClick}
        style={styles.challengeButton}
      >
        {buttonText}
        <ArrowRight size={17} />
      </button>

    </div>
  )
}


/* ================================================== */
/* STYLE */
/* ================================================== */

const styles: Record<string, React.CSSProperties> = {

  page: {
    minHeight: '100vh',
    background: '#f5f7fb',
    padding: '24px 16px 40px',
    color: '#263746',
  },

  container: {
    width: '100%',
    maxWidth: '600px',
    margin: '0 auto',
  },

  header: {
    marginBottom: '22px',
  },

  logo: {
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '2px',
    color: '#4D96FF',
    marginBottom: '6px',
  },

  title: {
    fontSize: '26px',
    fontWeight: 800,
    margin: 0,
    color: '#263746',
  },

  subtitle: {
    margin: '7px 0 0',
    fontSize: '13px',
    color: '#7b8794',
  },

  /* 今日の伸びしろ */

  growthCard: {
    background: '#4D96FF',
    borderRadius: '22px',
    padding: '22px',
    color: '#ffffff',
    marginBottom: '22px',
    boxShadow: '0 10px 30px rgba(77,150,255,0.18)',
  },

  growthHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
  },

  eyebrowWhite: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.5px',
    opacity: 0.9,
    marginBottom: '7px',
  },

  growthTitle: {
    fontSize: '24px',
    margin: 0,
    fontWeight: 800,
  },

  growthDescription: {
    fontSize: '13px',
    lineHeight: 1.7,
    margin: '8px 0 0',
    opacity: 0.95,
  },

  countCircle: {
    width: '52px',
    height: '52px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.2)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  /* ミニ問題 */

  miniProblem: {
    marginTop: '18px',
    background: '#ffffff',
    color: '#263746',
    borderRadius: '17px',
    padding: '18px',
  },

  miniProblemLabel: {
    fontSize: '12px',
    fontWeight: 800,
    color: '#4D96FF',
    marginBottom: '10px',
  },

  problemText: {
    fontSize: '13px',
    margin: '0 0 10px',
    color: '#586675',
  },

  mathBox: {
    background: '#f5f7fb',
    borderRadius: '11px',
    padding: '16px',
    textAlign: 'center',
    fontSize: '20px',
    fontWeight: 700,
    marginBottom: '15px',
  },

  inputLabel: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 700,
    marginBottom: '6px',
    color: '#596775',
  },

  answerInput: {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid #dce3eb',
    borderRadius: '10px',
    padding: '12px',
    fontSize: '15px',
    outline: 'none',
    marginBottom: '10px',
  },

  primaryButton: {
    width: '100%',
    border: 'none',
    borderRadius: '11px',
    background: '#263746',
    color: '#ffffff',
    padding: '12px',
    fontSize: '13px',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '7px',
  },

  correctBox: {
    display: 'flex',
    gap: '11px',
    alignItems: 'flex-start',
    background: '#eaf8ef',
    color: '#25804a',
    padding: '13px',
    borderRadius: '11px',
  },

  incorrectBox: {
    display: 'flex',
    gap: '11px',
    alignItems: 'flex-start',
    background: '#fff0f0',
    color: '#c44949',
    padding: '13px',
    borderRadius: '11px',
  },

  retryButton: {
    width: '100%',
    border: '1px solid #dce3eb',
    background: '#ffffff',
    color: '#263746',
    borderRadius: '10px',
    padding: '10px',
    marginTop: '9px',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
  },

  growthNote: {
    fontSize: '10px',
    margin: '10px 2px 0',
    opacity: 0.8,
  },

  /* 共通 */

  section: {
    marginBottom: '22px',
  },

  sectionHeader: {
    marginBottom: '10px',
  },

  sectionEyebrow: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    color: '#4D96FF',
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '1px',
    marginBottom: '4px',
  },

  sectionTitle: {
    fontSize: '19px',
    margin: 0,
    fontWeight: 800,
  },

  sectionDescription: {
    color: '#7b8794',
    fontSize: '12px',
    lineHeight: 1.6,
    margin: '0 0 10px',
  },

  card: {
    background: '#ffffff',
    borderRadius: '17px',
    padding: '18px',
    boxShadow: '0 3px 15px rgba(40,60,80,0.05)',
  },

  cardDescription: {
    fontSize: '12px',
    color: '#7b8794',
    lineHeight: 1.6,
    margin: '0 0 17px',
  },

  /* エラーバー */

  errorRow: {
    marginBottom: '16px',
  },

  errorTop: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '6px',
  },

  errorLabel: {
    fontSize: '13px',
    fontWeight: 700,
  },

  errorCount: {
    fontSize: '12px',
    color: '#7b8794',
  },

  errorTrack: {
    height: '8px',
    background: '#edf1f5',
    borderRadius: '999px',
    overflow: 'hidden',
  },

  errorFill: {
    height: '100%',
    background: '#4D96FF',
    borderRadius: '999px',
  },

  /* 思考経路 */

  pathCard: {
    background: '#ffffff',
    borderRadius: '17px',
    padding: '18px',
    boxShadow: '0 3px 15px rgba(40,60,80,0.05)',
  },

  pathDescription: {
    fontSize: '12px',
    color: '#7b8794',
    margin: '0 0 15px',
  },

  path: {
    marginBottom: '15px',
  },

  pathItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '11px',
    padding: '10px',
    borderRadius: '11px',
    background: '#f7fbff',
  },

  pathNumber: {
    width: '27px',
    height: '27px',
    borderRadius: '50%',
    background: '#4D96FF',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 800,
    flexShrink: 0,
  },

  pathError: {
    background: '#fff7f0',
  },

  pathErrorNumber: {
    width: '27px',
    height: '27px',
    borderRadius: '50%',
    background: '#f09b4d',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 800,
    flexShrink: 0,
  },

  pathItemStrong: {
    fontSize: '13px',
  },

  pathLine: {
    width: '2px',
    height: '12px',
    background: '#dce5ee',
    marginLeft: '22px',
  },

  outlineButton: {
    width: '100%',
    border: '1px solid #dce3eb',
    borderRadius: '11px',
    background: '#ffffff',
    color: '#263746',
    padding: '11px',
    fontSize: '12px',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    cursor: 'pointer',
  },

  /* 単元 */

  topicGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },

  topicCard: {
    background: '#ffffff',
    borderRadius: '16px',
    padding: '15px',
    boxShadow: '0 3px 15px rgba(40,60,80,0.05)',
  },

  topicIcon: {
    width: '31px',
    height: '31px',
    borderRadius: '9px',
    background: '#edf5ff',
    color: '#4D96FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '10px',
  },

  topicTitle: {
    fontSize: '14px',
    margin: 0,
    fontWeight: 800,
  },

  topicReason: {
    fontSize: '10px',
    color: '#7b8794',
    margin: '5px 0',
    lineHeight: 1.5,
  },

  stars: {
    fontSize: '10px',
    letterSpacing: '1px',
    marginBottom: '10px',
  },

  topicButton: {
    width: '100%',
    border: 'none',
    borderRadius: '9px',
    background: '#f1f6fb',
    color: '#263746',
    padding: '9px 5px',
    fontSize: '11px',
    fontWeight: 700,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '3px',
    cursor: 'pointer',
  },

  /* 成長 */

  progressHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  smallLabel: {
    margin: 0,
    fontSize: '11px',
    color: '#7b8794',
  },

  progressNumbers: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '21px',
    marginTop: '5px',
  },

  upBadge: {
    background: '#eaf8ef',
    color: '#2b8b52',
    borderRadius: '999px',
    padding: '6px 10px',
    fontSize: '12px',
    fontWeight: 800,
  },

  progressTrack: {
    height: '9px',
    background: '#edf1f5',
    borderRadius: '999px',
    marginTop: '18px',
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    background: '#4D96FF',
    borderRadius: '999px',
  },

  progressComment: {
    fontSize: '11px',
    color: '#7b8794',
    margin: '10px 0 0',
  },

  /* できるようになったこと */

  achievementList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '9px',
  },

  achievement: {
    background: '#ffffff',
    borderRadius: '15px',
    padding: '15px',
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
    boxShadow: '0 3px 15px rgba(40,60,80,0.05)',
  },

  achievementIcon: {
    width: '31px',
    height: '31px',
    borderRadius: '50%',
    background: '#eaf8ef',
    color: '#32a35e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  /* みんなの学習 */

  challengeCard: {
    background: '#ffffff',
    borderRadius: '17px',
    padding: '17px',
    marginBottom: '10px',
    boxShadow: '0 3px 15px rgba(40,60,80,0.05)',
  },

  challengeTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '9px',
  },

  challengeIcon: {
    width: '34px',
    height: '34px',
    borderRadius: '10px',
    background: '#edf5ff',
    color: '#4D96FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  challengeBadge: {
    background: '#f1f5f9',
    color: '#526170',
    borderRadius: '999px',
    padding: '5px 9px',
    fontSize: '10px',
    fontWeight: 800,
  },

  challengeTitle: {
    fontSize: '15px',
    margin: 0,
    fontWeight: 800,
  },

  challengeDescription: {
    fontSize: '12px',
    color: '#6e7c89',
    lineHeight: 1.6,
    margin: '6px 0',
  },

  challengeStats: {
    fontSize: '10px',
    color: '#9aa5af',
    margin: '0 0 12px',
  },

  challengeButton: {
    width: '100%',
    border: 'none',
    borderRadius: '10px',
    background: '#263746',
    color: '#ffffff',
    padding: '11px',
    fontSize: '12px',
    fontWeight: 700,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
  },

  anonymousNote: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#9aa5af',
    fontSize: '10px',
    lineHeight: 1.5,
    marginTop: '13px',
    padding: '0 3px',
  },

  footerText: {
    textAlign: 'center',
    color: '#a0a9b2',
    fontSize: '9px',
    lineHeight: 1.5,
    margin: '24px 0 0',
  },
}