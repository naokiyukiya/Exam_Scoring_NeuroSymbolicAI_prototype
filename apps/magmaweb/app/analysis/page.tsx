'use client'

import { useState } from 'react'
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
  X,
  Zap,
} from 'lucide-react'

type ModalType = 'revenge' | 'detail' | 'recommended' | 'challenge' | null

export default function AnalysisPage() {
  const [modal, setModal] = useState<ModalType>(null)

  return (
    <main style={styles.page}>
      <div style={styles.container}>

        {/* Header */}
        <header style={styles.header}>
          <div>
            <div style={styles.logo}>MAGMATHE</div>
            <h1 style={styles.title}>誤り分析</h1>
            <p style={styles.subtitle}>
              あなたの「間違い方」を分析します
            </p>
          </div>

          <div style={styles.studentBadge}>STUDENT</div>
        </header>

        {/* 今日の伸びしろ */}
        <section style={styles.growthCard}>
          <div style={styles.growthTop}>
            <div>
              <div style={styles.smallWhite}>
                ✨ 今日の伸びしろ
              </div>

              <div style={styles.growthTitle}>
                式の整理
              </div>

              <div style={styles.growthCount}>
                6回
              </div>
            </div>

            <div style={styles.growthIcon}>
              <Target size={28} />
            </div>
          </div>

          <p style={styles.growthDescription}>
            最近の答案で一番多かったミスです。
            <br />
            今日は「式の整理」を練習してみよう！
          </p>

          <button
            type="button"
            style={styles.whiteButton}
            onClick={() => setModal('revenge')}
          >
            <Flame size={18} />
            リベンジ問題に挑戦
            <ArrowRight size={17} />
          </button>
        </section>

        {/* ミスのクセ */}
        <section style={styles.card}>
          <SectionTitle
            icon={<AlertTriangle size={19} />}
            title="あなたのミスのクセ"
            description="これまでの答案から見つかった傾向"
          />

          <div style={styles.errorList}>
            <ErrorBar label="式の整理" count={6} percent={100} first />
            <ErrorBar label="符号のミス" count={4} percent={67} />
            <ErrorBar label="代入のミス" count={2} percent={34} />
            <ErrorBar label="計算ミス" count={1} percent={17} />
          </div>

          <div style={styles.infoBox}>
            <Lightbulb size={17} />
            <span>
              「式の整理」が今いちばんの伸びしろです！
            </span>
          </div>
        </section>

        {/* ここまで合っていました */}
        <section style={styles.card}>
          <SectionTitle
            icon={<CheckCircle2 size={19} />}
            title="ここまで合っていました！"
            description="今回の答案では、ここから間違いが始まりました"
          />

          <div style={styles.stepBox}>
            <Step number="1" text="解と係数の関係" correct />
            <div style={styles.stepLine} />

            <Step number="2" text="式を立てる" correct />
            <div style={styles.stepLine} />

            <Step number="3" text="式を整理する" error />
          </div>

          <button
            type="button"
            style={styles.outlineButton}
            onClick={() => setModal('detail')}
          >
            間違いを詳しく見る
            <ChevronRight size={17} />
          </button>
        </section>

        {/* 単元別おすすめ問題 */}
        <section style={styles.card}>
          <SectionTitle
            icon={<BookOpen size={19} />}
            title="単元別おすすめ問題"
            description="自分で単元を選んで練習できます"
          />

          <div style={styles.topicGrid}>
            <TopicButton
              title="二次方程式"
              level="おすすめ ★★★★★"
              active
              onClick={() => setModal('recommended')}
            />

            <TopicButton
              title="二次関数"
              level="おすすめ ★★★★☆"
              onClick={() => setModal('recommended')}
            />

            <TopicButton
              title="三角関数"
              level="おすすめ ★★★☆☆"
              onClick={() => setModal('recommended')}
            />

            <TopicButton
              title="微分"
              level="おすすめ ★★☆☆☆"
              onClick={() => setModal('recommended')}
            />
          </div>
        </section>

        {/* 最近の成長 */}
        <section style={styles.card}>
          <SectionTitle
            icon={<TrendingUp size={19} />}
            title="最近の成長"
            description="最近の答案から見た変化"
          />

          <div style={styles.progressArea}>
            <div style={styles.progressNumber}>
              <span>72%</span>
              <ArrowRight size={20} />
              <strong>81%</strong>
            </div>

            <div style={styles.progressUp}>
              +9ポイント
            </div>
          </div>

          <div style={styles.progressTrack}>
            <div style={styles.progressFill} />
          </div>

          <p style={styles.mutedText}>
            前回より正しく解ける問題が増えています！
          </p>
        </section>

        {/* できるようになったこと */}
        <section style={styles.card}>
          <SectionTitle
            icon={<Trophy size={19} />}
            title="できるようになったこと"
            description="最近の答案から見つかった成長"
          />

          <Achievement
            title="二次方程式の基本的な立式"
            text="問題文から条件を読み取り、式を立てられるようになりました。"
          />

          <Achievement
            title="解と係数の関係"
            text="α＋β、αβの関係を使って式を作れるようになりました。"
          />
        </section>

        {/* みんなの学習 */}
        <section style={styles.card}>
          <SectionTitle
            icon={<Users size={19} />}
            title="みんなの学習"
            description="みんなの投稿・答案から集計しています"
          />

          <div style={styles.communityNote}>
            <Users size={17} />
            <span>
              個人名は表示せず、みんなの学習データを集計しています。
            </span>
          </div>

          <CommunityCard
            icon={<TrendingUp size={19} />}
            tag="今週人気"
            title="二次関数の最大・最小"
            text="128件の答案が集まっています"
            button="問題を見る"
            onClick={() => setModal('challenge')}
          />

          <CommunityCard
            icon={<AlertTriangle size={19} />}
            tag="みんなが苦戦中"
            title="因数分解を利用した二次方程式"
            text="正答率 32%｜84件の答案"
            button="挑戦する"
            onClick={() => setModal('challenge')}
          />

          <CommunityCard
            icon={<Zap size={19} />}
            tag="正解者募集中！"
            title="チャレンジ問題 #204"
            text="17人が挑戦中｜まだ正解者なし"
            button="挑戦する"
            onClick={() => setModal('challenge')}
            special
          />
        </section>

        {/* Footer */}
        <p style={styles.footer}>
          ※ 現在はUI確認用のサンプルデータを表示しています
        </p>
      </div>

      {/* Modal */}
      {modal && (
        <Modal modal={modal} onClose={() => setModal(null)} />
      )}
    </main>
  )
}


/* ---------- Components ---------- */

function SectionTitle({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div style={styles.sectionTitle}>
      <div style={styles.sectionTitleRow}>
        <span style={styles.sectionIcon}>{icon}</span>
        <h2 style={styles.sectionHeading}>{title}</h2>
      </div>

      <p style={styles.sectionDescription}>
        {description}
      </p>
    </div>
  )
}


function ErrorBar({
  label,
  count,
  percent,
  first = false,
}: {
  label: string
  count: number
  percent: number
  first?: boolean
}) {
  return (
    <div style={styles.errorItem}>
      <div style={styles.errorHeader}>
        <span style={styles.errorLabel}>
          {label}
          {first && (
            <span style={styles.firstBadge}>
              一番多い
            </span>
          )}
        </span>

        <span style={styles.errorCount}>
          {count}回
        </span>
      </div>

      <div style={styles.barTrack}>
        <div
          style={{
            ...styles.barFill,
            width: `${percent}%`,
          }}
        />
      </div>
    </div>
  )
}


function Step({
  number,
  text,
  correct = false,
  error = false,
}: {
  number: string
  text: string
  correct?: boolean
  error?: boolean
}) {
  return (
    <div style={styles.step}>
      <div
        style={{
          ...styles.stepNumber,
          ...(error ? styles.stepNumberError : {}),
        }}
      >
        {error ? '!' : number}
      </div>

      <div>
        <div style={styles.stepText}>{text}</div>

        <div
          style={{
            ...styles.stepStatus,
            ...(error ? styles.stepStatusError : {}),
          }}
        >
          {error ? 'ここでミス' : '正しくできています'}
        </div>
      </div>
    </div>
  )
}


function TopicButton({
  title,
  level,
  active = false,
  onClick,
}: {
  title: string
  level: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...styles.topicButton,
        ...(active ? styles.topicButtonActive : {}),
      }}
    >
      <div style={styles.topicTitle}>{title}</div>
      <div style={styles.topicLevel}>{level}</div>
      <ChevronRight size={16} />
    </button>
  )
}


function Achievement({
  title,
  text,
}: {
  title: string
  text: string
}) {
  return (
    <div style={styles.achievement}>
      <div style={styles.achievementIcon}>
        <CheckCircle2 size={18} />
      </div>

      <div>
        <div style={styles.achievementTitle}>
          {title}
        </div>

        <div style={styles.achievementText}>
          {text}
        </div>
      </div>
    </div>
  )
}


function CommunityCard({
  icon,
  tag,
  title,
  text,
  button,
  onClick,
  special = false,
}: {
  icon: React.ReactNode
  tag: string
  title: string
  text: string
  button: string
  onClick: () => void
  special?: boolean
}) {
  return (
    <div
      style={{
        ...styles.communityCard,
        ...(special ? styles.communityCardSpecial : {}),
      }}
    >
      <div style={styles.communityTop}>
        <span style={styles.communityIcon}>
          {icon}
        </span>

        <span style={styles.communityTag}>
          {tag}
        </span>
      </div>

      <div style={styles.communityTitle}>
        {title}
      </div>

      <div style={styles.communityText}>
        {text}
      </div>

      <button
        type="button"
        style={styles.communityButton}
        onClick={onClick}
      >
        {button}
        <ArrowRight size={16} />
      </button>
    </div>
  )
}


/* ---------- Modal ---------- */

function Modal({
  modal,
  onClose,
}: {
  modal: ModalType
  onClose: () => void
}) {
  if (!modal) return null

  let content = {
    title: '',
    icon: <Target size={22} />,
    text: '',
    problem: '',
    answer: '',
  }

  if (modal === 'revenge') {
    content = {
      title: '🔥 リベンジ問題',
      icon: <Flame size={22} />,
      text: '最近あなたが一番多く間違えていた「式の整理」の問題です。',
      problem:
        'a² - 8a + 36 = 21 を整理して、aの値を求めなさい。',
      answer:
        'a² - 8a + 15 = 0 → (a - 3)(a - 5) = 0',
    }
  }

  if (modal === 'detail') {
    content = {
      title: '🔎 間違いの詳細',
      icon: <AlertTriangle size={22} />,
      text: '今回の答案では、ここで誤りが発生しています。',
      problem:
        'α + β = -a としていました。',
      answer:
        '正しくは α + β = a です。最高次係数が -1 であることによる符号に注意しましょう。',
    }
  }

  if (modal === 'recommended') {
    content = {
      title: '📚 おすすめ問題',
      icon: <BookOpen size={22} />,
      text: 'あなたの学習状況から、この問題がおすすめです。',
      problem:
        'x² - 7x + 12 = 0 の2解を求めなさい。',
      answer:
        '(x - 3)(x - 4) = 0 より、x = 3, 4',
    }
  }

  if (modal === 'challenge') {
    content = {
      title: '🌏 みんなの挑戦状',
      icon: <Users size={22} />,
      text: 'みんなが挑戦している問題です。あなたも挑戦してみよう！',
      problem:
        'x² - 6x + 8 = 0 の2解を求めなさい。',
      answer:
        'x = 2, 4',
    }
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        style={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={styles.modalHeader}>
          <div style={styles.modalTitleRow}>
            <span style={styles.modalIcon}>
              {content.icon}
            </span>

            <h3 style={styles.modalTitle}>
              {content.title}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={styles.closeButton}
          >
            <X size={20} />
          </button>
        </div>

        <p style={styles.modalText}>
          {content.text}
        </p>

        <div style={styles.problemBox}>
          <div style={styles.problemLabel}>
            問題
          </div>

          <div style={styles.problemText}>
            {content.problem}
          </div>
        </div>

        <details style={styles.answerDetails}>
          <summary style={styles.answerSummary}>
            答え・ポイントを見る
          </summary>

          <div style={styles.answerText}>
            {content.answer}
          </div>
        </details>

        <button
          type="button"
          style={styles.startButton}
          onClick={onClose}
        >
          <CheckCircle2 size={18} />
          この問題に挑戦する
        </button>
      </div>
    </div>
  )
}


/* ---------- Styles ---------- */

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#f5f7fb',
    padding: '24px 14px 40px',
    color: '#263746',
  },

  container: {
    width: '100%',
    maxWidth: '600px',
    margin: '0 auto',
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
  },

  logo: {
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '2px',
    color: '#4D96FF',
    marginBottom: '5px',
  },

  title: {
    fontSize: '24px',
    fontWeight: 800,
    margin: 0,
  },

  subtitle: {
    margin: '5px 0 0',
    color: '#7c8794',
    fontSize: '13px',
  },

  studentBadge: {
    fontSize: '9px',
    fontWeight: 800,
    letterSpacing: '1px',
    background: '#e9f2ff',
    color: '#4D96FF',
    padding: '7px 9px',
    borderRadius: '999px',
  },

  growthCard: {
    background: '#4D96FF',
    borderRadius: '22px',
    padding: '22px',
    color: '#fff',
    marginBottom: '14px',
    boxShadow: '0 8px 24px rgba(77, 150, 255, 0.18)',
  },

  growthTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  smallWhite: {
    fontSize: '12px',
    fontWeight: 700,
    opacity: 0.9,
  },

  growthTitle: {
    fontSize: '27px',
    fontWeight: 800,
    marginTop: '6px',
  },

  growthCount: {
    fontSize: '13px',
    marginTop: '2px',
    opacity: 0.9,
  },

  growthIcon: {
    width: '50px',
    height: '50px',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.16)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  growthDescription: {
    fontSize: '12px',
    lineHeight: 1.8,
    margin: '16px 0',
    opacity: 0.94,
  },

  whiteButton: {
    width: '100%',
    border: 'none',
    borderRadius: '13px',
    background: '#fff',
    color: '#263746',
    padding: '13px',
    fontSize: '13px',
    fontWeight: 800,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '7px',
    cursor: 'pointer',
  },

  card: {
    background: '#fff',
    borderRadius: '20px',
    padding: '20px',
    marginBottom: '14px',
    boxShadow: '0 2px 10px rgba(30,50,70,0.04)',
  },

  sectionTitle: {
    marginBottom: '18px',
  },

  sectionTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },

  sectionIcon: {
    color: '#4D96FF',
    display: 'flex',
  },

  sectionHeading: {
    margin: 0,
    fontSize: '17px',
    fontWeight: 800,
  },

  sectionDescription: {
    margin: '5px 0 0',
    fontSize: '11px',
    color: '#8a95a1',
  },

  errorList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },

  errorItem: {
    width: '100%',
  },

  errorHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
  },

  errorLabel: {
    fontSize: '12px',
    fontWeight: 700,
  },

  firstBadge: {
    marginLeft: '7px',
    fontSize: '9px',
    color: '#4D96FF',
    background: '#edf5ff',
    padding: '3px 6px',
    borderRadius: '999px',
  },

  errorCount: {
    fontSize: '11px',
    color: '#7c8794',
  },

  barTrack: {
    height: '7px',
    background: '#edf0f4',
    borderRadius: '999px',
    overflow: 'hidden',
  },

  barFill: {
    height: '100%',
    background: '#4D96FF',
    borderRadius: '999px',
  },

  infoBox: {
    marginTop: '17px',
    padding: '11px',
    background: '#f5f9ff',
    borderRadius: '12px',
    color: '#4D96FF',
    fontSize: '11px',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
  },

  stepBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },

  step: {
    display: 'flex',
    alignItems: 'center',
    gap: '11px',
  },

  stepNumber: {
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    background: '#eaf3ff',
    color: '#4D96FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '12px',
    flexShrink: 0,
  },

  stepNumberError: {
    background: '#fff0ed',
    color: '#e86b55',
  },

  stepText: {
    fontSize: '12px',
    fontWeight: 700,
  },

  stepStatus: {
    fontSize: '10px',
    color: '#45a878',
    marginTop: '2px',
  },

  stepStatusError: {
    color: '#e86b55',
  },

  stepLine: {
    width: '2px',
    height: '20px',
    background: '#e5e9ee',
    marginLeft: '14px',
  },

  outlineButton: {
    marginTop: '18px',
    width: '100%',
    background: '#fff',
    border: '1px solid #e1e6ec',
    borderRadius: '12px',
    padding: '11px',
    color: '#4D96FF',
    fontWeight: 700,
    fontSize: '12px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '5px',
    cursor: 'pointer',
  },

  topicGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '9px',
  },

  topicButton: {
    border: '1px solid #e4e8ee',
    background: '#fff',
    borderRadius: '14px',
    padding: '13px',
    textAlign: 'left',
    cursor: 'pointer',
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    alignItems: 'center',
  },

  topicButtonActive: {
    border: '1px solid #4D96FF',
    background: '#f5f9ff',
  },

  topicTitle: {
    fontSize: '12px',
    fontWeight: 800,
    gridColumn: '1 / 2',
  },

  topicLevel: {
    fontSize: '9px',
    color: '#4D96FF',
    marginTop: '4px',
    gridColumn: '1 / 2',
  },

  progressArea: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  progressNumber: {
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    color: '#7c8794',
    fontSize: '18px',
    fontWeight: 700,
  },

  progressUp: {
    color: '#45a878',
    background: '#edf9f3',
    padding: '6px 9px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 800,
  },

  progressTrack: {
    marginTop: '14px',
    height: '10px',
    background: '#edf0f4',
    borderRadius: '999px',
    overflow: 'hidden',
  },

  progressFill: {
    width: '81%',
    height: '100%',
    background: '#4D96FF',
    borderRadius: '999px',
  },

  mutedText: {
    margin: '9px 0 0',
    color: '#8a95a1',
    fontSize: '11px',
  },

  achievement: {
    display: 'flex',
    gap: '11px',
    padding: '13px',
    borderRadius: '13px',
    background: '#f7f9fc',
    marginBottom: '9px',
  },

  achievementIcon: {
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    background: '#eaf8f1',
    color: '#45a878',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  achievementTitle: {
    fontSize: '12px',
    fontWeight: 800,
  },

  achievementText: {
    marginTop: '4px',
    color: '#7c8794',
    fontSize: '10px',
    lineHeight: 1.6,
  },

  communityNote: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    padding: '10px',
    background: '#f7f9fc',
    borderRadius: '11px',
    color: '#7c8794',
    fontSize: '10px',
    marginBottom: '12px',
  },

  communityCard: {
    border: '1px solid #e7ebf0',
    borderRadius: '15px',
    padding: '14px',
    marginBottom: '9px',
  },

  communityCardSpecial: {
    background: '#f5f9ff',
    border: '1px solid #dceaff',
  },

  communityTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
  },

  communityIcon: {
    color: '#4D96FF',
    display: 'flex',
  },

  communityTag: {
    fontSize: '9px',
    fontWeight: 800,
    color: '#4D96FF',
    background: '#edf5ff',
    padding: '4px 7px',
    borderRadius: '999px',
  },

  communityTitle: {
    fontSize: '13px',
    fontWeight: 800,
    marginTop: '9px',
  },

  communityText: {
    color: '#7c8794',
    fontSize: '10px',
    marginTop: '4px',
  },

  communityButton: {
    marginTop: '11px',
    border: 'none',
    background: 'transparent',
    color: '#4D96FF',
    fontWeight: 800,
    fontSize: '11px',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    cursor: 'pointer',
  },

  footer: {
    textAlign: 'center',
    color: '#a0a9b2',
    fontSize: '9px',
    margin: '20px 0 0',
  },

  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(20, 30, 40, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '18px',
    zIndex: 100,
  },

  modal: {
    width: '100%',
    maxWidth: '500px',
    background: '#fff',
    borderRadius: '22px',
    padding: '20px',
    boxShadow: '0 15px 50px rgba(0,0,0,0.2)',
  },

  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  modalTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },

  modalIcon: {
    color: '#4D96FF',
    display: 'flex',
  },

  modalTitle: {
    margin: 0,
    fontSize: '17px',
    fontWeight: 800,
  },

  closeButton: {
    border: 'none',
    background: '#f2f4f7',
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#6f7a86',
  },

  modalText: {
    fontSize: '11px',
    color: '#7c8794',
    lineHeight: 1.7,
    margin: '15px 0',
  },

  problemBox: {
    background: '#f6f8fb',
    borderRadius: '14px',
    padding: '16px',
  },

  problemLabel: {
    color: '#4D96FF',
    fontSize: '10px',
    fontWeight: 800,
    marginBottom: '8px',
  },

  problemText: {
    fontSize: '14px',
    fontWeight: 700,
    lineHeight: 1.7,
  },

  answerDetails: {
    marginTop: '11px',
    background: '#f5f9ff',
    borderRadius: '12px',
    padding: '11px',
  },

  answerSummary: {
    cursor: 'pointer',
    color: '#4D96FF',
    fontSize: '11px',
    fontWeight: 800,
  },

  answerText: {
    marginTop: '10px',
    fontSize: '11px',
    color: '#52606d',
    lineHeight: 1.7,
  },

  startButton: {
    width: '100%',
    marginTop: '15px',
    border: 'none',
    borderRadius: '13px',
    background: '#4D96FF',
    color: '#fff',
    padding: '13px',
    fontSize: '12px',
    fontWeight: 800,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '7px',
    cursor: 'pointer',
  },
}