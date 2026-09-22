'use client';

import React from 'react';
import physicsData from '../../lib/constants/physics.json';
import { theoremComponentMap } from './registry';
import { X, Sparkles, Atom } from 'lucide-react';
import FormattedText from '../FormattedText'; // ★ FormattedText をインポート

interface Props {
  theoremId: string;
  onClose?: () => void;
}

export default function TheoremDetailRenderer({ theoremId, onClose }: Props) {
  const theorem = (physicsData as any)?.theorems?.find((t: any) => t.id === theoremId);
  const ContentComponent = theoremComponentMap[theoremId];

  if (!theorem) {
    return (
      <div style={styles.container}>
        {onClose && (
          <div style={{ ...styles.headerBar, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={styles.closeButton} aria-label="閉じる">
              <X size={18} />
            </button>
          </div>
        )}
        <div style={styles.notFoundBox}>
          <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8' }}>
            該当する定理データが見つかりませんでした。(ID: {theoremId})
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* 1. ヘッダーバー（タグ文字を消して閉じるボタンのみ、右寄せに配置） */}
      <div style={styles.headerBar}>
        <div /> {/* 空のdivで右寄せを維持 */}
        {onClose && (
          <button onClick={onClose} style={styles.closeButton} aria-label="閉じる">
            <X size={18} />
          </button>
        )}
      </div>

      <div style={styles.scrollBody}>
        {/* タイトルセクション */}
        <header style={styles.headerSection}>
          <h1 style={styles.title}>{theorem.name}</h1>
          
          {/* 2. 変数・物理量リスト */}
          {theorem.prompt_data?.variables && (
            <div style={styles.variableBox}>
              <div style={styles.variableTitle}>
                {/* 物理量に合ったAtomアイコンに変更 */}
                <Atom size={15} color="#38bdf8" />
                <span>登場する物理量・記号</span>
              </div>
              <div style={styles.variableGrid}>
                {Object.entries(theorem.prompt_data.variables).map(([key, val]) => (
                  <div key={key} style={styles.variableItem}>
                    {/* 3. 記号（key）を FormattedText に渡して LaTeX 化 ($rho$ -> ρ) */}
                    <span style={styles.variableSymbol}>
                      <FormattedText text={`$${key}$`} />
                    </span>
                    <span style={styles.variableDesc}>: {val as string}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </header>

        {/* 動的コンポーネント（個別の解説コンテンツ） */}
        <main style={styles.mainContent}>
          {ContentComponent ? (
            <ContentComponent theorem={theorem} />
          ) : (
            <div style={styles.placeholderBox}>
              <Sparkles size={18} color="#6366f1" />
              <span>この定理のリッチ解説は現在準備中です。</span>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    height: '100%',
    maxHeight: '100%',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '16px',
    overflow: 'hidden',
    boxSizing: 'border-box',
  },
  headerBar: {
    padding: '12px 16px',
    borderBottom: '1px solid #1e293b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    flexShrink: 0,
  },
  closeButton: {
    background: '#1e293b',
    border: '1px solid #334155',
    color: '#94a3b8',
    borderRadius: '6px',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    padding: '18px',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    flex: 1,
    minHeight: 0,
  },
  headerSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  title: {
    fontSize: '22px',
    fontWeight: 'bold',
    color: '#ffffff',
    margin: 0,
    lineHeight: '1.3',
  },
  variableBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid #1e293b',
    borderRadius: '10px',
    padding: '12px',
  },
  variableTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#38bdf8',
    marginBottom: '8px',
  },
  variableGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '8px',
  },
  variableItem: {
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  variableSymbol: {
    color: '#38bdf8',
    fontWeight: 'bold',
  },
  variableDesc: {
    color: '#cbd5e1',
  },
  mainContent: {
    marginTop: '4px',
  },
  placeholderBox: {
    backgroundColor: '#1e293b',
    border: '1px dashed #334155',
    borderRadius: '10px',
    padding: '24px',
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  notFoundBox: {
    padding: '32px',
    textAlign: 'center',
  },
};