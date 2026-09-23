'use client';

import React from 'react';
import physicsData from '../../lib/constants/physics.json';
import { theoremComponentMap } from './registry';
import { X, Sparkles, Atom } from 'lucide-react';
import FormattedText from '../FormattedText';

interface Props {
  theoremId: string;
  onClose?: () => void;
  isModal?: boolean; // ★ 追加：モーダル表示か単体ページ表示かの判定フラグ
}

function formatSymbolKey(key: string): string {
  const greekMap: Record<string, string> = {
    rho: '\\rho',
    theta: '\\theta',
    alpha: '\\alpha',
    beta: '\\beta',
    gamma: '\\gamma',
    omega: '\\omega',
    mu: '\\mu',
    lambda: '\\lambda',
    pi: '\\pi',
    sigma: '\\sigma',
    phi: '\\phi',
    epsilon: '\\epsilon',
    delta: '\\delta',
  };

  let formatted = key;

  Object.entries(greekMap).forEach(([raw, latex]) => {
    const regex = new RegExp(`\\b${raw}\\b`, 'g');
    formatted = formatted.replace(regex, latex);
  });

  formatted = formatted.replace(/_([a-zA-Z0-9]+)/g, '_{$1}');

  return `$${formatted}$`;
}

export default function TheoremDetailRenderer({ theoremId, onClose, isModal = true }: Props) {
  const theorem = (physicsData as any)?.theorems?.find((t: any) => t.id === theoremId);
  const ContentComponent = theoremComponentMap[theoremId];

  // ★ 単体ページ（白背景）とモーダル（ダーク背景）でスタイルの動的切替
  const dynamicStyles = isModal ? darkStyles : lightStyles;

  if (!theorem) {
    return (
      <div style={dynamicStyles.container}>
        {onClose && (
          <div style={{ ...dynamicStyles.headerBar, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={dynamicStyles.closeButton} aria-label="閉じる">
              <X size={18} />
            </button>
          </div>
        )}
        <div style={dynamicStyles.notFoundBox}>
          <p style={{ margin: 0, fontSize: '14px', color: isModal ? '#94a3b8' : '#64748b' }}>
            該当する定理データが見つかりませんでした。(ID: {theoremId})
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={dynamicStyles.container}>
      {/* モーダル時のみ閉じるボタン付きヘッダーバーを表示 */}
      {isModal && onClose && (
        <div style={dynamicStyles.headerBar}>
          <div />
          <button onClick={onClose} style={dynamicStyles.closeButton} aria-label="閉じる">
            <X size={18} />
          </button>
        </div>
      )}

      <div style={dynamicStyles.scrollBody}>
        {/* タイトルセクション */}
        <header style={dynamicStyles.headerSection}>
          <h1 style={dynamicStyles.title}>{theorem.name}</h1>
          
          {/* 変数・物理量リスト */}
          {theorem.prompt_data?.variables && (
            <div style={dynamicStyles.variableBox}>
              <div style={dynamicStyles.variableTitle}>
                <Atom size={15} color={isModal ? '#38bdf8' : '#0284c7'} />
                <span>登場する物理量・記号</span>
              </div>
              <div style={dynamicStyles.variableGrid}>
                {Object.entries(theorem.prompt_data.variables).map(([key, val]) => (
                  <div key={key} style={dynamicStyles.variableItem}>
                    <span style={dynamicStyles.variableSymbol}>
                      <FormattedText text={formatSymbolKey(key)} />
                    </span>
                    <span style={dynamicStyles.variableDesc}>: {val as string}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </header>

        {/* 動的コンポーネント（個別の解説コンテンツ） */}
        <main style={dynamicStyles.mainContent}>
          {ContentComponent ? (
            <ContentComponent
              theorem={theorem}
              onOpenTheorem={(nextTheoremId: string) => {
                if (typeof window !== 'undefined') {
                  const url = new URL(window.location.href);
                  url.searchParams.set('theorem', nextTheoremId);
                  window.history.pushState({}, '', url.toString());
                  window.dispatchEvent(new Event('popstate'));
                }
              }}
            />
          ) : (
            <div style={dynamicStyles.placeholderBox}>
              <Sparkles size={18} color={isModal ? '#6366f1' : '#4f46e5'} />
              <span>この定理のリッチ解説は現在準備中です。</span>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// スタイル定義：モーダル用（ダーク） & 単体ページ用（白背景）
// -------------------------------------------------------------

/* モーダル用（既存の完璧に動いているスタイリング） */
const darkStyles: Record<string, React.CSSProperties> = {
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
  headerSection: { display: 'flex', flexDirection: 'column', gap: '12px' },
  title: { fontSize: '22px', fontWeight: 'bold', color: '#ffffff', margin: 0, lineHeight: '1.3' },
  variableBox: { backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid #1e293b', borderRadius: '10px', padding: '12px' },
  variableTitle: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 'bold', color: '#38bdf8', marginBottom: '8px' },
  variableGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' },
  variableItem: { fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' },
  variableSymbol: { color: '#38bdf8', fontWeight: 'bold' },
  variableDesc: { color: '#cbd5e1' },
  mainContent: { marginTop: '4px' },
  placeholderBox: { backgroundColor: '#1e293b', border: '1px dashed #334155', borderRadius: '10px', padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  notFoundBox: { padding: '32px', textAlign: 'center' },
};

/* 単体ページ用（白背景・全表示スタイル） */
const lightStyles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    maxWidth: '800px',
    margin: '0 auto',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
  },
  headerBar: { display: 'none' },
  closeButton: { display: 'none' },
  scrollBody: {
    padding: '16px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  headerSection: { display: 'flex', flexDirection: 'column', gap: '12px' },
  title: { fontSize: '26px', fontWeight: 'bold', color: '#0f172a', margin: 0, lineHeight: '1.3' },
  variableBox: { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' },
  variableTitle: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 'bold', color: '#0284c7', marginBottom: '10px' },
  variableGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' },
  variableItem: { fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' },
  variableSymbol: { color: '#0284c7', fontWeight: 'bold' },
  variableDesc: { color: '#334155' },
  mainContent: { marginTop: '8px' },
  placeholderBox: { backgroundColor: '#f1f5f9', border: '1px dashed #cbd5e1', borderRadius: '12px', padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  notFoundBox: { padding: '40px', textAlign: 'center' },
};