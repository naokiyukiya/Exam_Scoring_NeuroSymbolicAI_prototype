'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  Lightbulb,
  RotateCcw,
  Zap,
} from 'lucide-react'

// stumblesテーブルのレコード型定義
type StumbleRecord = {
  id: string
  user_id: string
  post_id: string
  theorem_id: string | null
  step_index: number
  created_at: string
  input_nodes: string[] // 使う前提・根拠
  inference_label: string // 適用した考え方・定理
  output_nodes: string[] // 導かれる結果
}

// サンプルデータ（実際はSupabaseから取得）
const SAMPLE_STUMBLES: StumbleRecord[] = [
  {
    id: 'stumble-1',
    user_id: 'user-123',
    post_id: 'post-456',
    theorem_id: 'simple_harmonic_motion_period',
    step_index: 7,
    created_at: '2026-05-10T10:00:00Z',
    input_nodes: ['全質量 M = 2/3 HS', '復元力定数 K = Sg', '単振動の周期の公式'],
    inference_label: 'M と K を周期の公式に代入して計算する',
    output_nodes: ['周期 T = 2π√(M/K) = 2π√(2H / 3g)'],
  },
  {
    id: 'stumble-2',
    user_id: 'user-123',
    post_id: 'post-789',
    theorem_id: 'equation_of_motion',
    step_index: 3,
    created_at: '2026-05-11T14:30:00Z',
    input_nodes: ['小物体に働く鉛直方向の力 Ma', '重力 Mg', '浮力 ρdVg'],
    inference_label: '鉛直上向きを正として運動方程式を立てる',
    output_nodes: ['Ma = ρdVg - Mg'],
  },
]

export default function AnalysisPage() {
  const router = useRouter()

  // 今日の伸びしろ（最新のつまづきステップ）の回答状態
  const [checked, setChecked] = useState(false)
  const currentStumble = SAMPLE_STUMBLES[0]

  const goToPost = (postId: string, stepIndex: number) => {
    router.push(`/post/${postId}?step=${stepIndex}`)
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>

        {/* HEADER */}
        <header style={styles.header}>
          <h1 style={styles.title}>つまずき分析</h1>
          <p style={styles.subtitle}>
            あなたが「つまづいた！」を押した思考ステップの記録と構造分析です
          </p>
        </header>

        {/* ================================================== */}
        {/* 直近のつまずきステップ（ピックアップ・リベンジ） */}
        {/* ================================================== */}
        <section style={styles.growthCard}>
          <div style={styles.growthHeader}>
            <div>
              <div style={styles.eyebrowBadge}>
                <Zap size={14} />
                要復習ステップ (Step {currentStumble.step_index})
              </div>
              <h2 style={styles.growthTitle}>
                {currentStumble.inference_label}
              </h2>
            </div>
            <div style={styles.stumbleBadge}>
              <AlertTriangle size={16} />
              つまずき記録
            </div>
          </div>

          {/* つまずいた推論ステップの3ブロック構造復元 */}
          <div style={styles.stepFlowBox}>
            <div style={styles.nodeBlock}>
              <span style={styles.nodeLabelBlue}>使う前提・根拠</span>
              <ul style={styles.nodeList}>
                {currentStumble.input_nodes.map((node, idx) => (
                  <li key={idx}>{node}</li>
                ))}
              </ul>
            </div>

            <div style={styles.nodeBlockHighlight}>
              <span style={styles.nodeLabelPurple}>適用した考え方・定理</span>
              <p style={styles.inferenceText}>
                {currentStumble.inference_label}
              </p>
            </div>

            <div style={styles.nodeBlock}>
              <span style={styles.nodeLabelGreen}>導かれる結果</span>
              <ul style={styles.nodeList}>
                {currentStumble.output_nodes.map((node, idx) => (
                  <li key={idx}>{node}</li>
                ))}
              </ul>
            </div>
          </div>

          {!checked ? (
            <button
              type="button"
              onClick={() => setChecked(true)}
              style={styles.primaryButton}
            >
              このステップの根拠・成り立ちを確認した
              <CheckCircle2 size={16} />
            </button>
          ) : (
            <div style={styles.clearedBox}>
              <CheckCircle2 size={20} color="#16a34a" />
              <span>復習完了！次の演習時にも意識してみましょう。</span>
              <button
                type="button"
                onClick={() => setChecked(false)}
                style={styles.retryTextBtn}
              >
                <RotateCcw size={14} />
                戻す
              </button>
            </div>
          )}

          <div style={styles.cardFooterAction}>
            <button
              type="button"
              style={styles.linkButton}
              onClick={() => goToPost(currentStumble.post_id, currentStumble.step_index)}
            >
              元の答案解説を見る
              <ChevronRight size={16} />
            </button>
          </div>
        </section>

        {/* ================================================== */}
        {/* つまずきの傾向分析 (定理・適用パターン別) */}
        {/* ================================================== */}
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.sectionEyebrow}>
                <Lightbulb size={15} />
                STUMBLE PATTERNS
              </div>
              <h2 style={styles.sectionTitle}>
                よくつまずく思考・定理の傾向
              </h2>
            </div>
          </div>

          <div style={styles.card}>
            <p style={styles.cardDescription}>
              `stumbles` に記録されたステップから、特に確認ボタンが多く押された思考パターンです。
            </p>

            <StumbleBar
              label="単振動の周期の公式の適用・代入"
              count={5}
              percent={100}
              active
            />
            <StumbleBar
              label="運動方程式の立式と符号の設定"
              count={3}
              percent={60}
            />
            <StumbleBar
              label="状態方程式による未知数の整理"
              count={2}
              percent={40}
            />
          </div>
        </section>

        {/* ================================================== */}
        {/* みんなの「つmost/つまずき」ノード（他ユーザーのstumbles集計） */}
        {/* ================================================== */}
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.sectionEyebrow}>
                <HelpCircle size={15} />
                COMMON PITFALLS
              </div>
              <h2 style={styles.sectionTitle}>
                みんながつまずきやすい思考ステップ
              </h2>
            </div>
          </div>

          <p style={styles.sectionDescription}>
            他のユーザーの答案分析で「つまずいた！」が多く押されているステップです。
          </p>

          <div style={styles.challengeGrid}>
            <StumbleChallengeCard
              theorem="単振動の周期公式"
              inference="M と K を周期の公式 T = 2π√(M/K) に代入して計算する"
              inputNodes={['全質量 M = 2/3 HS', '復元力定数 K = Sg']}
              stumbleCount={42}
              onClick={() => goToPost('sample-1', 7)}
            />

            <StumbleChallengeCard
              theorem="浮力と運動方程式"
              inference="鉛直上向きを正として浮力を含めた運動方程式を立てる"
              inputNodes={['質量 M', '浮力 ρdVg', '重力 Mg']}
              stumbleCount={28}
              onClick={() => goToPost('sample-2', 3)}
            />
          </div>
        </section>

        {/* FOOTER */}
        <p style={styles.footerText}>
          ※ stumbles テーブルに記録された `input_nodes` / `inference_label` / `output_nodes` を基に動的描画しています。
        </p>

      </div>
    </main>
  )
}

/* ================================================== */
/* サブコンポーネント */
/* ================================================== */

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
    <div style={styles.errorRow}>
      <div style={styles.errorTop}>
        <span style={styles.errorLabel}>{label}</span>
        <span style={styles.errorCount}>{count} 回つまずき</span>
      </div>
      <div style={styles.errorTrack}>
        <div
          style={{
            ...styles.errorFill,
            width: `${percent}%`,
            backgroundColor: active ? '#2563eb' : '#94a3b8',
          }}
        />
      </div>
    </div>
  )
}

function StumbleChallengeCard({
  theorem,
  inference,
  inputNodes,
  stumbleCount,
  onClick,
}: {
  theorem: string
  inference: string
  inputNodes: string[]
  stumbleCount: number
  onClick: () => void
}) {
  return (
    <div style={styles.challengeCard}>
      <div style={styles.challengeTop}>
        <span style={styles.theoremTag}>
          <BookOpen size={12} />
          {theorem}
        </span>
        <span style={styles.countBadge}>{stumbleCount} 人がつまずき</span>
      </div>

      <div style={styles.miniNodeBox}>
        <div style={styles.miniInference}>
          <strong>適用ステップ:</strong> {inference}
        </div>
        <div style={styles.miniInputs}>
          前提: {inputNodes.join(' / ')}
        </div>
      </div>

      <button type="button" onClick={onClick} style={styles.challengeButton}>
        このステップを含む答案を見る
        <ArrowRight size={15} />
      </button>
    </div>
  )
}

/* ================================================== */
/* スタイル定義 (Light Background / 白ベース) */
/* ================================================== */

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: '32px 16px',
    backgroundColor: '#f8fafc', // 白〜明るいライトグレー背景
    color: '#0f172a',
    minHeight: '100vh',
    fontFamily: 'sans-serif',
  },
  container: {
    maxWidth: '720px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '28px',
  },
  header: {
    marginBottom: '4px',
  },
  title: {
    fontSize: '26px',
    fontWeight: 'bold',
    color: '#0f172a',
    margin: '0 0 6px 0',
  },
  subtitle: {
    fontSize: '14px',
    color: '#475569',
    margin: 0,
  },
  growthCard: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '24px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
  },
  growthHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
  },
  eyebrowBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#2563eb',
    backgroundColor: '#eff6ff',
    padding: '4px 10px',
    borderRadius: '20px',
    marginBottom: '8px',
  },
  growthTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    margin: 0,
    color: '#0f172a',
  },
  stumbleBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#d97706',
    backgroundColor: '#fffbeb',
    border: '1px solid #fef3c7',
    padding: '4px 10px',
    borderRadius: '8px',
  },
  stepFlowBox: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '10px',
    backgroundColor: '#f8fafc',
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    marginBottom: '16px',
  },
  nodeBlock: {
    backgroundColor: '#ffffff',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '12px',
  },
  nodeBlockHighlight: {
    backgroundColor: '#f0fdf4',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #86efac',
    fontSize: '12px',
  },
  nodeLabelBlue: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#2563eb',
    display: 'block',
    marginBottom: '4px',
  },
  nodeLabelPurple: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#16a34a',
    display: 'block',
    marginBottom: '4px',
  },
  nodeLabelGreen: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#059669',
    display: 'block',
    marginBottom: '4px',
  },
  nodeList: {
    margin: 0,
    paddingLeft: '14px',
    color: '#334155',
  },
  inferenceText: {
    margin: 0,
    fontWeight: 'bold',
    color: '#15803d',
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
    padding: '12px',
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
    color: '#2563eb',
    marginBottom: '2px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#0f172a',
    margin: 0,
  },
  sectionDescription: {
    fontSize: '13px',
    color: '#64748b',
    margin: 0,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '14px',
    padding: '20px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  },
  cardDescription: {
    fontSize: '13px',
    color: '#64748b',
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
    color: '#1e293b',
    fontWeight: 500,
  },
  errorCount: {
    color: '#64748b',
    fontSize: '12px',
  },
  errorTrack: {
    height: '8px',
    backgroundColor: '#f1f5f9',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  errorFill: {
    height: '100%',
    borderRadius: '4px',
  },
  challengeGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '4px',
  },
  challengeCard: {
    backgroundColor: '#ffffff',
    borderRadius: '14px',
    padding: '16px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
  },
  challengeTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  theoremTag: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#1d4ed8',
    backgroundColor: '#eff6ff',
    padding: '2px 8px',
    borderRadius: '6px',
  },
  countBadge: {
    fontSize: '11px',
    color: '#d97706',
    fontWeight: 'bold',
  },
  miniNodeBox: {
    backgroundColor: '#f8fafc',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #f1f5f9',
    marginBottom: '12px',
  },
  miniInference: {
    fontSize: '13px',
    color: '#0f172a',
    marginBottom: '4px',
  },
  miniInputs: {
    fontSize: '11px',
    color: '#64748b',
  },
  challengeButton: {
    width: '100%',
    padding: '9px',
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
  footerText: {
    fontSize: '11px',
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: '12px',
  },
}