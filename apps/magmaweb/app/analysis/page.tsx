'use client'

import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Flame,
  Lightbulb,
  MessageCircle,
  Target,
  TrendingUp,
  Trophy,
  Users,
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
            あなたの「間違い方」と成長を分析します
          </p>
        </div>
      </header>

      <div style={styles.container}>

        {/* =========================
            今日の伸びしろ
        ========================= */}
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
            あなたの最近の答案では、
            <br />
            「式の整理」のミスが一番多く見られます。
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

        {/* =========================
            ミスのクセ
        ========================= */}
        <section style={styles.card}>
          <div style={styles.sectionTitleArea}>
            <div style={styles.iconPurple}>
              <AlertTriangle size={19} />
            </div>

            <div>
              <h2 style={styles.sectionTitle}>
                あなたのミスのクセ
              </h2>

              <p style={styles.sectionSub}>
                最近の答案から分析
              </p>
            </div>
          </div>

          <div style={styles.barList}>
            <ErrorBar
              name="式の整理"
              count={6}
              width="100%"
              comment="一番多い"
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

          <div style={styles.analysisHint}>
            <Lightbulb size={16} />
            <span>
              「式の整理」が現在の一番の伸びしろです
            </span>
          </div>
        </section>

        {/* =========================
            ここまで合っていました
        ========================= */}
        <section style={styles.successCard}>
          <div style={styles.successHeader}>
            <div style={styles.iconGreen}>
              <CheckCircle2 size={19} />
            </div>

            <div>
              <h2 style={styles.sectionTitle}>
                ここまで合っていました！
              </h2>

              <p style={styles.sectionSub}>
                間違いだけでなく、正しく考えられた部分も確認
              </p>
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
            <b>「どこから間違ったか」</b>
            を確認してみよう！
          </p>

          <button style={styles.secondaryButton}>
            間違いを詳しく見る
            <ChevronRight size={17} />
          </button>
        </section>

        {/* =========================
            単元別おすすめ問題
        ========================= */}
        <section style={styles.card}>
          <div style={styles.sectionTitleArea}>
            <div style={styles.iconBlueLight}>
              <BookOpen size={19} />
            </div>

            <div>
              <h2 style={styles.sectionTitle}>
                単元別おすすめ問題
              </h2>

              <p style={styles.sectionSub}>
                自分で好きな単元を選んで練習
              </p>
            </div>
          </div>

          <div style={styles.recommendBox}>
            <div>
              <p style={styles.recommendLabel}>
                ✨ あなたへのおすすめ
              </p>

              <h3 style={styles.recommendTitle}>
                二次方程式
              </h3>

              <p style={styles.recommendText}>
                「式の整理」の問題から
                <br />
                練習してみませんか？
              </p>
            </div>

            <button style={styles.smallActionButton}>
              挑戦する
              <ArrowRight size={15} />
            </button>
          </div>

          <div style={styles.unitGrid}>
            <UnitButton name="二次方程式" />
            <UnitButton name="二次関数" />
            <UnitButton name="図形と方程式" />
            <UnitButton name="三角関数" />
            <UnitButton name="微分" />
            <UnitButton name="積分" />
          </div>
        </section>

        {/* =========================
            最近の成長
        ========================= */}
        <section style={styles.card}>
          <div style={styles.sectionTitleArea}>
            <div style={styles.iconOrange}>
              <TrendingUp size={19} />
            </div>

            <div>
              <h2 style={styles.sectionTitle}>
                最近の成長
              </h2>

              <p style={styles.sectionSub}>
                前回と比べてどうなった？
              </p>
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

        {/* =========================
            できるようになったこと
        ========================= */}
        <section style={styles.card}>
          <div style={styles.sectionTitleArea}>
            <div style={styles.iconYellow}>
              <Trophy size={19} />
            </div>

            <div>
              <h2 style={styles.sectionTitle}>
                できるようになったこと
              </h2>

              <p style={styles.sectionSub}>
                あなたの成長記録
              </p>
            </div>
          </div>

          <Achievement
            title="二次方程式の基本的な立式"
            text="以前より安定してできています！"
          />

          <Achievement
            title="解と係数の関係"
            text="正しく使える問題が増えました！"
          />

          <Achievement
            title="途中式を書く習慣"
            text="考え方が以前より分かりやすくなっています！"
          />
        </section>

        {/* =========================
            みんなの学習
        ========================= */}
        <section style={styles.card}>
          <div style={styles.sectionTitleArea}>
            <div style={styles.iconPeople}>
              <Users size={19} />
            </div>

            <div>
              <h2 style={styles.sectionTitle}>
                みんなの学習
              </h2>

              <p style={styles.sectionSub}>
                投稿された解答から見る、みんなの数学
              </p>
            </div>
          </div>

          {/* 人気の問題 */}
          <div style={styles.communitySection}>
            <div style={styles.communityHeading}>
              <Flame size={17} />
              <span>最近よく投稿されている問題</span>
            </div>

            <CommunityProblem
              title="二次関数の最大・最小"
              detail="128件の解答が投稿されています"
              badge="人気"
            />

            <CommunityProblem
              title="因数分解"
              detail="96件の解答が投稿されています"
              badge="注目"
            />

            <CommunityProblem
              title="三角関数のグラフ"
              detail="74件の解答が投稿されています"
              badge="注目"
            />
          </div>

          {/* つまずき問題 */}
          <div style={styles.communitySection}>
            <div style={styles.communityHeading}>
              <AlertTriangle size={17} />
              <span>みんながつまずいている問題</span>
            </div>

            <div style={styles.difficultProblem}>
              <div>
                <span style={styles.difficultBadge}>
                  正答率 32%
                </span>

                <h3 style={styles.difficultTitle}>
                  二次方程式の応用問題
                </h3>

                <p style={styles.difficultText}>
                  みんなもこの問題で苦戦しているみたい
                </p>
              </div>

              <ChevronRight
                size={20}
                color="#8995a1"
              />
            </div>
          </div>
        </section>

        {/* =========================
            CM風・みんなからの挑戦状
        ========================= */}
        <section style={styles.challengeCard}>
          <div style={styles.challengeTop}>
            <div style={styles.challengeIcon}>
              <MessageCircle size={21} />
            </div>

            <span style={styles.challengeLabel}>
              CHALLENGE
            </span>
          </div>

          <p style={styles.challengeSmall}>
            📣 みんなからの挑戦状
          </p>

          <h2 style={styles.challengeTitle}>
            まだ正解者がいません！
          </h2>

          <p style={styles.challengeText}>
            18人が挑戦したこの問題。
            <br />
            あなたが最初の正解者になるかも？
          </p>

          <div style={styles.challengeStats}>
            <div>
              <strong>18</strong>
              <span>人が挑戦</span>
            </div>

            <div>
              <strong>0</strong>
              <span>人が正解</span>
            </div>

            <div>
              <strong>0%</strong>
              <span>正答率</span>
            </div>
          </div>

          <button style={styles.challengeButton}>
            問題を見てみる
            <ArrowRight size={18} />
          </button>
        </section>

        {/* =========================
            フッター
        ========================= */}
        <p style={styles.footerText}>
          ※ 現在表示されている数値はUI試作用の仮データです
        </p>

      </div>
    </main>
  )
}


/* =========================
   ミスの棒グラフ
========================= */

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
            <span style={styles.barComment}>
              {' '}
              {comment}
            </span>
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


/* =========================
   成長記録
========================= */

function Achievement({
  title,
  text,
}: {
  title: string
  text: string
}) {
  return (
    <div style={styles.achievement}>
      <CheckCircle2 size={20} />

      <div>
        <b style={styles.achievementTitle}>
          {title}
        </b>

        <p style={styles.achievementText}>
          {text}
        </p>
      </div>
    </div>
  )
}


/* =========================
   単元ボタン
========================= */

function UnitButton({
  name,
}: {
  name: string
}) {
  return (
    <button style={styles.unitButton}>
      <span>{name}</span>
      <ChevronRight size={15} />
    </button>
  )
}


/* =========================
   みんなの問題
========================= */

function CommunityProblem({
  title,
  detail,
  badge,
}: {
  title: string
  detail: string
  badge: string
}) {
  return (
    <div style={styles.communityProblem}>
      <div style={styles.communityProblemMain}>
        <div style={styles.communityBadge}>
          {badge}
        </div>

        <div>
          <b style={styles.communityTitle}>
            {title}
          </b>

          <p style={styles.communityDetail}>
            {detail}
          </p>
        </div>
      </div>

      <ChevronRight
        size={18}
        color="#8995a1"
      />
    </div>
  )
}


/* =========================
   スタイル
========================= */

const styles: {
  [key: string]: React.CSSProperties
} = {

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

  /* メインカード */

  mainCard: {
    background:
      'linear-gradient(145deg, #4D96FF, #397de0)',
    borderRadius: '24px',
    padding: '22px',
    color: '#ffffff',
    boxShadow:
      '0 8px 24px rgba(77, 150, 255, 0.20)',
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

  /* 共通カード */

  card: {
    background: '#ffffff',
    borderRadius: '21px',
    padding: '20px',
    marginBottom: '14px',
    boxShadow:
      '0 2px 10px rgba(30, 50, 70, 0.05)',
    border: '1px solid #edf0f5',
  },

  sectionTitleArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '11px',
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

  /* アイコン */

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

  iconBlueLight: {
    width: '39px',
    height: '39px',
    borderRadius: '12px',
    background: '#eaf3ff',
    color: '#4D96FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  iconPeople: {
    width: '39px',
    height: '39px',
    borderRadius: '12px',
    background: '#edf1ff',
    color: '#6377d8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  /* ミス棒グラフ */

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

  analysisHint: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    marginTop: '4px',
    padding: '10px 12px',
    background: '#f4f8ff',
    borderRadius: '12px',
    color: '#4D96FF',
    fontSize: '11px',
    fontWeight: 700,
  },

  /* 正しい部分 */

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

  /* 単元おすすめ */

  recommendBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginTop: '18px',
    padding: '15px',
    background: '#f4f8ff',
    borderRadius: '15px',
    border: '1px solid #e2edff',
  },

  recommendLabel: {
    margin: 0,
    fontSize: '10px',
    fontWeight: 800,
    color: '#4D96FF',
  },

  recommendTitle: {
    margin: '4px 0 2px',
    fontSize: '17px',
    fontWeight: 800,
  },

  recommendText: {
    margin: 0,
    fontSize: '10px',
    lineHeight: 1.5,
    color: '#7d8995',
  },

  smallActionButton: {
    border: 'none',
    borderRadius: '11px',
    background: '#4D96FF',
    color: '#ffffff',
    padding: '10px 11px',
    fontSize: '11px',
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    cursor: 'pointer',
    flexShrink: 0,
  },

  unitGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '9px',
    marginTop: '12px',
  },

  unitButton: {
    border: '1px solid #e7ebf0',
    background: '#ffffff',
    borderRadius: '12px',
    padding: '11px 10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    color: '#4b5965',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
  },

  /* 成長 */

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

  /* できるようになったこと */

  achievement: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    marginTop: '13px',
    padding: '12px',
    background: '#f8fafc',
    borderRadius: '13px',
    color: '#36a568',
  },

  achievementTitle: {
    color: '#263238',
    fontSize: '12px',
  },

  achievementText: {
    color: '#78848e',
    fontSize: '10px',
    margin: '4px 0 0',
    lineHeight: 1.5,
  },

  /* みんなの学習 */

  communitySection: {
    marginTop: '20px',
  },

  communityHeading: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    fontWeight: 800,
    color: '#53616e',
    marginBottom: '9px',
  },

  communityProblem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px',
    borderRadius: '13px',
    background: '#f8fafc',
    marginBottom: '8px',
  },

  communityProblemMain: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },

  communityBadge: {
    fontSize: '9px',
    fontWeight: 800,
    color: '#4D96FF',
    background: '#eaf3ff',
    borderRadius: '999px',
    padding: '5px 7px',
  },

  communityTitle: {
    fontSize: '12px',
    color: '#263238',
  },

  communityDetail: {
    margin: '3px 0 0',
    fontSize: '9px',
    color: '#929eaa',
  },

  difficultProblem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px',
    borderRadius: '14px',
    background: '#fff8ef',
    border: '1px solid #f6e5cf',
  },

  difficultBadge: {
    display: 'inline-block',
    fontSize: '9px',
    fontWeight: 800,
    color: '#d77d22',
    background: '#fff0dc',
    borderRadius: '999px',
    padding: '5px 7px',
  },

  difficultTitle: {
    margin: '7px 0 2px',
    fontSize: '12px',
  },

  difficultText: {
    margin: 0,
    fontSize: '9px',
    color: '#8c8175',
  },

  /* CM風カード */

  challengeCard: {
    background:
      'linear-gradient(145deg, #263746, #344b5d)',
    color: '#ffffff',
    borderRadius: '22px',
    padding: '21px',
    marginBottom: '14px',
    boxShadow:
      '0 8px 20px rgba(38, 55, 70, 0.15)',
  },

  challengeTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  challengeIcon: {
    width: '41px',
    height: '41px',
    borderRadius: '13px',
    background: 'rgba(255,255,255,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  challengeLabel: {
    fontSize: '9px',
    fontWeight: 800,
    letterSpacing: '0.15em',
    opacity: 0.55,
  },

  challengeSmall: {
    margin: '19px 0 5px',
    fontSize: '12px',
    fontWeight: 700,
    opacity: 0.8,
  },

  challengeTitle: {
    margin: 0,
    fontSize: '23px',
    fontWeight: 900,
    letterSpacing: '-0.03em',
  },

  challengeText: {
    margin: '10px 0 17px',
    fontSize: '12px',
    lineHeight: 1.7,
    opacity: 0.72,
  },

  challengeStats: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '8px',
    marginBottom: '14px',
  },

  challengeStat: {
    display: 'flex',
    flexDirection: 'column' as const,
  },

  challengeButton: {
    width: '100%',
    border: 'none',
    borderRadius: '13px',
    background: '#ffffff',
    color: '#263746',
    padding: '13px',
    fontSize: '13px',
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '7px',
    cursor: 'pointer',
  },

  footerText: {
    textAlign: 'center',
    color: '#a0a9b2',
    fontSize: '9px',
    margin: '20px 0',
  },
}