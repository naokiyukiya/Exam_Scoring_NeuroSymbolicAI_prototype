'use client'

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Lightbulb,
  Target,
  TrendingUp,
  Trophy,
} from 'lucide-react'

export default function AnalysisPage() {
  return (
    <main style={styles.page}>
      {/* ヘッダー */}
      <header style={styles.header}>
        <div>
          <p style={styles.smallLabel}>MAGMATHE</p>
          <h1 style={styles.title}>誤り分析</h1>
          <p style={styles.subtitle}>
            あなたの「間違い方」を分析します
          </p>
        </div>
      </header>

      <div style={styles.container}>

        {/* 今日の伸びしろ */}
        <section style={styles.mainCard}>
          <div style={styles.cardTop}>
            <div style={styles.iconBlue}>
              <Target size={21} />
            </div>
            <span style={styles.tagBlue}>TODAY</span>
          </div>

          <p style={styles.cardLabel}>✨ 今日の伸びしろ</p>

          <h2 style={styles.mainCardTitle}>
            「式の整理」を
            <br />
            もう少し練習してみよう！
          </h2>

          <p style={styles.mainCardText}>
            最近の答案を見ると、式を変形するときに
            間違えることが多いみたいです。
          </p>

          <div style={styles.numberBox}>
            <div>
              <span style={styles.bigNumber}>6</span>
              <span style={styles.numberUnit}>回</span>
            </div>
            <span style={styles.numberText}>
              最近の「式の整理」のミス
            </span>
          </div>

          <button style={styles.primaryButton}>
            <span>リベンジ問題に挑戦</span>
            <ArrowRight size={18} />
          </button>
        </section>

        {/* ミスのクセ */}
        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <div style={styles.sectionTitleArea}>
              <div style={styles.iconPurple}>
                <AlertTriangle size={19} />
              </div>
              <div>
                <h2 style={styles.sectionTitle}>あなたのミスのクセ</h2>
                <p style={styles.sectionSub}>最近の答案から分析</p>
              </div>
            </div>
          </div>

          <div style={styles.barList}>
            <ErrorBar
              name="式の整理"
              count={6}
              width="100%"
              comment="一番多いミス"
            />
            <ErrorBar
              name="符号のミス"
              count={4}
              width="67%"
              comment=""
            />
            <ErrorBar
              name="代入のミス"
              count={2}
              width="34%"
              comment=""
            />
            <ErrorBar
              name="計算ミス"
              count={1}
              width="17%"
              comment=""
            />
          </div>
        </section>

        {/* ここまで合っていました */}
        <section style={styles.successCard}>
          <div style={styles.successHeader}>
            <div style={styles.iconGreen}>
              <CheckCircle2 size={19} />
            </div>
            <div>
              <h2 style={styles.sectionTitle}>ここまで合っていました！</h2>
              <p style={styles.sectionSub}>間違いだけを見るのではなく…</p>
            </div>
          </div>

          <div style={styles.stepBox}>
            <div style={styles.stepDone}>
              <span>✓</span>
            </div>

            <div style={styles.stepLine} />

            <div style={styles.stepDone}>
              <span>✓</span>
            </div>

            <div style={styles.stepLine} />

            <div style={styles.stepError}>
              <span>!</span>
            </div>
          </div>

          <div style={styles.stepLabels}>
            <span>解と係数の関係</span>
            <span>式を立てる</span>
            <span>式を整理する</span>
          </div>

          <p style={styles.successText}>
            実は、途中までは正しく考えられています。
            <br />
            <b>「どこから間違ったか」</b>を確認してみよう！
          </p>

          <button style={styles.secondaryButton}>
            間違いを詳しく見る
            <ChevronRight size={17} />
          </button>
        </section>

        {/* 最近の成長 */}
        <section style={styles.card}>
          <div style={styles.sectionTitleArea}>
            <div style={styles.iconOrange}>
              <TrendingUp size={19} />
            </div>
            <div>
              <h2 style={styles.sectionTitle}>最近の成長</h2>
              <p style={styles.sectionSub}>前回と比べてどうなった？</p>
            </div>
          </div>

          <div style={styles.growthBox}>
            <div style={styles.growthNumber}>
              <span>72</span>
              <small>%</small>
            </div>

            <div style={styles.growthArrow}>→</div>

            <div style={styles.growthNumberAfter}>
              <span>81</span>
              <small>%</small>
            </div>
          </div>

          <div style={styles.growthMessage}>
            <TrendingUp size={17} />
            <span>
              正答率が <b>9ポイントアップ！</b>
            </span>
          </div>
        </section>

        {/* 今週できるようになったこと */}
        <section style={styles.card}>
          <div style={styles.sectionTitleArea}>
            <div style={styles.iconYellow}>
              <Trophy size={19} />
            </div>
            <div>
              <h2 style={styles.sectionTitle}>できるようになったこと</h2>
              <p style={styles.sectionSub}>あなたの成長記録</p>
            </div>
          </div>

          <div style={styles.achievement}>
            <CheckCircle2 size={20} />
            <div>
              <b>二次方程式の基本的な立式</b>
              <p>以前より安定してできています！</p>
            </div>
          </div>

          <div style={styles.achievement}>
            <CheckCircle2 size={20} />
            <div>
              <b>解と係数の関係</b>
              <p>正しく使える問題が増えました！</p>
            </div>
          </div>
        </section>

        {/* 次にやること */}
        <section style={styles.nextCard}>
          <div style={styles.nextIcon}>
            <Lightbulb size={22} />
          </div>

          <div style={{ flex: 1 }}>
            <p style={styles.nextLabel}>NEXT STEP</p>
            <h2 style={styles.nextTitle}>次は「式の整理」を攻略しよう</h2>
            <p style={styles.nextText}>
              あなたの間違いから選んだ問題を用意しています。
            </p>
          </div>

          <ChevronRight size={21} />
        </section>

        <p style={styles.footerText}>
          ※ 現在表示されている数値はUI試作用の仮データです
        </p>

      </div>
    </main>
  )
}


/* ミスの棒グラフ */
function ErrorBar({
  name,
  count,
  width,
  comment,
}: {
  name: string
  count: number
  width: string
  comment: string
}) {
  return (
    <div style={styles.barItem}>
      <div style={styles.barTop}>
        <span style={styles.barName}>{name}</span>
        <span style={styles.barCount}>
          {count}回
          {comment && (
            <span style={styles.barComment}> {comment}</span>
          )}
        </span>
      </div>

      <div style={styles.barBackground}>
        <div
          style={{
            ...styles.bar,
            width,
          }}
        />
      </div>
    </div>
  )
}


const styles: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: '100dvh',
    background: '#f5f7fb',
    color: '#263238',
    paddingBottom: '40px',
  },

  header: {
    background: '#ffffff',
    padding: '24px 20px 20px',
    borderBottom: '1px solid #e9edf3',
  },

  smallLabel: {
    margin: 0,
    fontSize: '10px',
    fontWeight: 800,
    color: '#4D96FF',
    letterSpacing: '0.14em',
  },

  title: {
    margin: '4px 0 2px',
    fontSize: '27px',
    fontWeight: 800,
    letterSpacing: '-0.04em',
  },

  subtitle: {
    margin: 0,
    fontSize: '13px',
    color: '#7b8794',
  },

  container: {
    width: '100%',
    maxWidth: '600px',
    margin: '0 auto',
    padding: '16px',
    boxSizing: 'border-box',
  },

  mainCard: {
    background: 'linear-gradient(145deg, #4D96FF, #397de0)',
    borderRadius: '24px',
    padding: '22px',
    color: '#ffffff',
    boxShadow: '0 8px 24px rgba(77, 150, 255, 0.20)',
    marginBottom: '14px',
  },

  cardTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  iconBlue: {
    width: '40px',
    height: '40px',
    borderRadius: '13px',
    background: 'rgba(255,255,255,0.18)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  tagBlue: {
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '0.12em',
    background: 'rgba(255,255,255,0.16)',
    padding: '6px 9px',
    borderRadius: '999px',
  },

  cardLabel: {
    fontSize: '13px',
    fontWeight: 700,
    margin: '20px 0 8px',
    opacity: 0.9,
  },

  mainCardTitle: {
    fontSize: '23px',
    lineHeight: 1.45,
    margin: 0,
    fontWeight: 800,
    letterSpacing: '-0.03em',
  },

  mainCardText: {
    fontSize: '13px',
    lineHeight: 1.7,
    opacity: 0.88,
    margin: '12px 0 16px',
  },

  numberBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 14px',
    background: 'rgba(255,255,255,0.13)',
    borderRadius: '15px',
    marginBottom: '14px',
  },

  bigNumber: {
    fontSize: '28px',
    fontWeight: 900,
  },

  numberUnit: {
    fontSize: '12px',
    fontWeight: 700,
    marginLeft: '2px',
  },

  numberText: {
    fontSize: '12px',
    opacity: 0.9,
  },

  primaryButton: {
    width: '100%',
    border: 'none',
    borderRadius: '14px',
    background: '#ffffff',
    color: '#397de0',
    padding: '13px 16px',
    fontSize: '14px',
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    cursor: 'pointer',
  },

  card: {
    background: '#ffffff',
    borderRadius: '21px',
    padding: '20px',
    marginBottom: '14px',
    boxShadow: '0 2px 10px rgba(30, 50, 70, 0.05)',
    border: '1px solid #edf0f5',
  },

  sectionTitleArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '11px',
  },

  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
  },

  sectionTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 800,
  },

  sectionSub: {
    margin: '3px 0 0',
    fontSize: '11px',
    color: '#929eaa',
  },

  iconPurple: {
    width: '39px',
    height: '39px',
    borderRadius: '12px',
    background: '#f1edff',
    color: '#7b61d9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  iconGreen: {
    width: '39px',
    height: '39px',
    borderRadius: '12px',
    background: '#e8f8ef',
    color: '#31a866',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  iconOrange: {
    width: '39px',
    height: '39px',
    borderRadius: '12px',
    background: '#fff2e5',
    color: '#e8943c',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  iconYellow: {
    width: '39px',
    height: '39px',
    borderRadius: '12px',
    background: '#fff8db',
    color: '#d6a514',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  barList: {
    marginTop: '22px',
  },

  barItem: {
    marginBottom: '17px',
  },

  barTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '7px',
  },

  barName: {
    fontSize: '13px',
    fontWeight: 700,
  },

  barCount: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#66727e',
  },

  barComment: {
    fontSize: '10px',
    color: '#4D96FF',
  },

  barBackground: {
    height: '8px',
    background: '#edf1f6',
    borderRadius: '999px',
    overflow: 'hidden',
  },

  bar: {
    height: '100%',
    background: '#4D96FF',
    borderRadius: '999px',
  },

  successCard: {
    background: '#f3fbf6',
    borderRadius: '21px',
    padding: '20px',
    marginBottom: '14px',
    border: '1px solid #dcefe4',
  },

  successHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '11px',
  },

  stepBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '24px',
    padding: '0 10px',
  },

  stepDone: {
    width: '31px',
    height: '31px',
    borderRadius: '50%',
    background: '#43b978',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '14px',
  },

  stepError: {
    width: '31px',
    height: '31px',
    borderRadius: '50%',
    background: '#ffb15c',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '14px',
  },

  stepLine: {
    height: '3px',
    background: '#9ed8b6',
    flex: 1,
  },

  stepLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '9px',
    color: '#708078',
    marginTop: '8px',
    textAlign: 'center',
  },

  successText: {
    fontSize: '12px',
    lineHeight: 1.7,
    color: '#627069',
    margin: '18px 0 14px',
  },

  secondaryButton: {
    width: '100%',
    padding: '11px',
    borderRadius: '12px',
    border: '1px solid #bfe4cc',
    background: '#ffffff',
    color: '#31955d',
    fontSize: '12px',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    cursor: 'pointer',
  },

  growthBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '18px',
    margin: '22px 0 15px',
  },

  growthNumber: {
    fontSize: '31px',
    fontWeight: 900,
    color: '#9ba5af',
  },

  growthNumberAfter: {
    fontSize: '36px',
    fontWeight: 900,
    color: '#4D96FF',
  },

  growthArrow: {
    fontSize: '24px',
    color: '#b7c0c9',
  },

  growthMessage: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '7px',
    fontSize: '12px',
    color: '#4b8f68',
    background: '#eff9f2',
    borderRadius: '12px',
    padding: '10px',
  },

  achievement: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    marginTop: '17px',
    padding: '12px',
    background: '#f8fafc',
    borderRadius: '13px',
    color: '#36a568',
  },

  achievementText: {
    color: '#263238',
  },

  nextCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '13px',
    background: '#263746',
    color: '#ffffff',
    borderRadius: '21px',
    padding: '18px',
    marginBottom: '14px',
  },

  nextIcon: {
    width: '42px',
    height: '42px',
    borderRadius: '13px',
    background: 'rgba(255,255,255,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffd66b',
    flexShrink: 0,
  },

  nextLabel: {
    fontSize: '9px',
    fontWeight: 800,
    letterSpacing: '0.13em',
    margin: 0,
    opacity: 0.6,
  },

  nextTitle: {
    fontSize: '14px',
    margin: '4px 0',
    fontWeight: 800,
  },

  nextText: {
    fontSize: '10px',
    margin: 0,
    opacity: 0.65,
    lineHeight: 1.5,
  },

  footerText: {
    textAlign: 'center',
    color: '#a0a9b2',
    fontSize: '9px',
    margin: '20px 0',
  },
}
