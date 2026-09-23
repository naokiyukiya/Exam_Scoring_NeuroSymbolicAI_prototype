'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Compass,
  HelpCircle,
  Lightbulb,
  RotateCcw,
  Zap,
} from 'lucide-react'
import FormattedText from '../components/FormattedText'

// ノード（前提・結果）のオブジェクト型
type GraphNode = {
  id: string
  label: string
}

// データベースの stumbles テーブルの実際のレコード型
type StumbleRecord = {
  id: string
  user_id: string
  post_id: string
  theorem_id: string | null
  step_index: number
  created_at: string
  input_nodes: GraphNode[]     // 使う前提・根拠（オブジェクト配列）
  inference_label: string      // 適用した考え方・定理
  output_nodes: GraphNode[]    // 導かれる結果（オブジェクト配列）
}

// データベースの実データに基づくサンプルデータ
const SAMPLE_STUMBLES: StumbleRecord[] = [
  {
    id: 'stumble-1',
    user_id: 'user-123',
    post_id: 'post-456',
    theorem_id: 'law_buoyancy_archimedes',
    step_index: 7,
    created_at: '2026-05-10T10:00:00Z',
    input_nodes: [
      {
        id: 'p1_1',
        label: '頭部が水面上に $\\frac{1}{3}H$ 出ているとき、水没部の体積 $V = \\frac{2}{3}HS$',
      },
      {
        id: 't1_1',
        label: 'アルキメデスの原理（浮力）',
      },
    ],
    inference_label: '水没部の体積から浮力 $F$ を計算する',
    output_nodes: [
      {
        id: 'p1_2',
        label: '浮力 $F = 1 \\cdot \\frac{2}{3}HS \\cdot g = \\frac{2}{3}HSg$',
      },
    ],
  },
]

export default function StumbleAnalysisPage() {
  const router = useRouter()
  const [checked, setChecked] = useState(false)
  const stumble = SAMPLE_STUMBLES[0]

  // 答案詳細ページへの遷移
  const goToPost = (postId: string, stepIndex: number) => {
    router.push(`/post/${postId}?step=${stepIndex}`)
  }

  // 定理キーワードがクリックされたときの処理
  const handleTheoremClick = (theoremId: string) => {
    router.push(`/theorems/${theoremId}`)
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
        {/* メイン：要復習ステップカード */}
        {/* ================================================== */}
        <section style={styles.mainCard}>
          {/* カードヘッダー */}
          <div style={styles.cardHeader}>
            <div style={styles.eyebrowGroup}>
              <span style={styles.stepBadge}>
                <Zap size={13} />
                要復習ステップ (Step {stumble.step_index})
              </span>
            </div>
            <div style={styles.stumbleTag}>
              <AlertTriangle size={14} />
              つまずき記録
            </div>
          </div>

          <h2 style={styles.cardTitle}>
            <FormattedText
              text={stumble.inference_label}
              onTheoremClick={handleTheoremClick}
            />
          </h2>

          {/* ステップ構造（stepGrid） */}
          <div style={styles.stepCardInner}>
            <div style={styles.stepCardTitleHeader}>
              <Compass size={15} color="#64748b" />
              <span style={styles.stepCardTitle}>このステップで行われている変形・推論</span>
            </div>

            <div style={styles.stepGrid}>
              {/* 1. 使う前提・根拠 (Inputs) */}
              <div style={styles.stepBox}>
                <span style={styles.inputBadge}>使う前提・根拠</span>
                <div style={styles.nodeList}>
                  {stumble.input_nodes.map((node) => (
                    <div key={node.id} style={styles.nodeItem}>
                      • <FormattedText text={node.label} onTheoremClick={handleTheoremClick} />
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. 適用した考え方・定理 (Inference) */}
              <div style={styles.stepCenterBox}>
                <span style={styles.inferenceBadge}>適用した考え方・定理</span>
                <p style={styles.inferenceText}>
                  <FormattedText
                    text={stumble.inference_label}
                    onTheoremClick={handleTheoremClick}
                  />
                </p>
              </div>

              {/* 3. 導かれる結果 (Outputs) */}
              <div style={styles.stepBox}>
                <span style={styles.outputBadge}>導かれる結果</span>
                <div style={styles.nodeList}>
                  {stumble.output_nodes.map((node) => (
                    <div key={node.id} style={styles.nodeItem}>
                      • <FormattedText text={node.label} onTheoremClick={handleTheoremClick} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 復習確認アクション */}
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
                  onClick={() => setChecked(false)}
                  style={styles.retryTextBtn}
                >
                  <RotateCcw size={13} />
                  戻す
                </button>
              </div>
            )}
          </div>

          {/* 答案ページへの導線 */}
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
        </section>

        {/* ================================================== */}
        {/* 集計：よくつまずく傾向 */}
        {/* ================================================== */}
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

            <StumbleBar label="アルキメデスの原理による浮力の計算" count={5} percent={100} active />
            <StumbleBar label="つりあいの式の立式と符号の設定" count={3} percent={60} />
            <StumbleBar label="状態方程式による未知数の整理" count={2} percent={40} />
          </div>
        </section>

        {/* ================================================== */}
        {/* みんなのつまずきポイント */}
        {/* ================================================== */}
        <section style={styles.section}>
          <div style={styles.sectionEyebrow}>
            <HelpCircle size={15} />
            COMMON PITFALLS
          </div>
          <h3 style={styles.sectionTitle}>みんながつまずきやすい思考ステップ</h3>

          <div style={styles.challengeGrid}>
            <CommunityStumbleCard
              theorem="アルキメデスの原理"
              inference="水没部の体積から浮力 $F$ を計算する"
              inputs={['水没部の体積 $V = \\frac{2}{3}HS$', 'アルキメデスの原理']}
              outputs={['浮力 $F = \\frac{2}{3}HSg$']}
              count={42}
              onClick={() => goToPost('sample-1', 7)}
              onTheoremClick={handleTheoremClick}
            />
          </div>
        </section>

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
            {inputs.map((inp, idx) => (
              <span key={idx}>
                {idx > 0 && ' / '}
                <FormattedText text={inp} onTheoremClick={onTheoremClick} />
              </span>
            ))}
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
            {outputs.map((out, idx) => (
              <span key={idx}>
                {idx > 0 && ' / '}
                <FormattedText text={out} onTheoremClick={onTheoremClick} />
              </span>
            ))}
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

/* ================================================== */
/* スタイル定義 */
/* ================================================== */

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
  stumbleTag: {
    display: 'inline-flex',
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
  cardTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    margin: '0 0 16px 0',
    color: '#0f172a',
    lineHeight: 1.4,
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