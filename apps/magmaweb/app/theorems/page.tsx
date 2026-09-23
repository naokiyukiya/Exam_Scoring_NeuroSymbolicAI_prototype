'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import physicsData from '../../lib/constants/physics.json';
import { Search, ChevronRight, Atom, Sparkles } from 'lucide-react';
import FormattedText from '../../components/FormattedText';

// JSONの生テキスト（Python風・SymPy風）を正しく綺麗に表示される LaTeX 記法に変換するヘルパー関数
function formatFormulaToLatex(formulaInput: any): string {
  if (!formulaInput) return '';

  let formatted = typeof formulaInput === 'string'
    ? formulaInput
    : JSON.stringify(formulaInput);

  // 配列形式などの要素をカンマ区切りテキストに整える
  if (formatted.startsWith('[') && formatted.endsWith(']')) {
    try {
      const parsed = JSON.parse(formatted);
      if (Array.isArray(parsed)) {
        return `$${parsed.map((item) => String(item)).join(', ')}$`;
      }
    } catch {
      // JSON parseエラーの場合はそのまま続行
    }
  }

  // 1. == を = に置換
  formatted = formatted.replace(/==/g, '=');

  // 2. sqrt 記法の修復
  formatted = formatted.replace(/\bsqrt\(([^)]+)\)/g, '\\sqrt{$1}');

  // 3. ギリシャ文字の変換
  const greekMap: Record<string, string> = {
    rho: '\\rho', theta: '\\theta', alpha: '\\alpha', beta: '\\beta',
    gamma: '\\gamma', omega: '\\omega', mu_prime: "\\mu'", mu: '\\mu',
    lambda: '\\lambda', pi: '\\pi', sigma: '\\sigma', phi: '\\phi',
    epsilon: '\\epsilon', delta: '\\delta',
  };
  Object.entries(greekMap).forEach(([raw, latex]) => {
    const regex = new RegExp(`\\b${raw}\\b`, 'g');
    formatted = formatted.replace(regex, latex);
  });

  // 4. 演算子の整形
  formatted = formatted.replace(/\*\*([a-zA-Z0-9]+)/g, '^{$1}');
  formatted = formatted.replace(/\(1\/2\)/g, '\\frac{1}{2}');
  formatted = formatted.replace(/\s*\*\s*/g, ' ');

  // 5. 下付き文字 (連続するアンダースコアに対応)
  // 英単語全体を \text{} で包むか数字であればそのまま下付きにする
  formatted = formatted.replace(/_([a-zA-Z0-9]+)/g, (_, sub) => {
    return isNaN(Number(sub)) ? `_{\\text{${sub}}}` : `_{${sub}}`;
  });

  return `$${formatted.trim()}$`;
}

const TYPE_LABEL_MAP: Record<string, { label: string; bg: string; color: string }> = {
  law: { label: '物理法則', bg: '#e0f2fe', color: '#0369a1' },
  principle: { label: '原理・定理', bg: '#fef3c7', color: '#b45309' },
  formula: { label: '公式・計算', bg: '#dcfce7', color: '#15803d' },
  math: { label: '数学・ベクトル', bg: '#f3e8ff', color: '#6b21a8' },
  meta_focus: { label: '注目物体・作図', bg: '#ffe4e6', color: '#9f1239' },
  pattern: { label: '解法パターン', bg: '#e0e7ff', color: '#3730a3' },
};

export default function TheoremsIndexPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');

  const theorems = (physicsData as any)?.theorems || [];

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: theorems.length };
    theorems.forEach((t: any) => {
      const type = t.prompt_data?.type || 'other';
      counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  }, [theorems]);

  const filteredTheorems = useMemo(() => {
    return theorems.filter((t: any) => {
      const matchesSearch =
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType =
        selectedType === 'all' || t.prompt_data?.type === selectedType;

      return matchesSearch && matchesType;
    });
  }, [theorems, searchQuery, selectedType]);

  return (
    <div style={styles.pageWrapper}>
      <div style={styles.container}>
        
        {/* ヘッダーセクション */}
        <header style={styles.header}>
          <h1 style={styles.mainTitle}>物理の定理・法則一覧</h1>
          <p style={styles.subTitle}>
            各定理の解説、公式、登場する物理量や導出メカニズムを確認できます。
          </p>
        </header>

        {/* 検索 & フィルターコントロール */}
        <div style={styles.controlSection}>
          <div style={styles.searchBar}>
            <Search size={18} color="#94a3b8" />
            <input
              type="text"
              placeholder="定理名・キーワードで検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
          </div>

          <div style={styles.tabContainer}>
            <button
              onClick={() => setSelectedType('all')}
              style={{
                ...styles.tabButton,
                ...(selectedType === 'all' ? styles.tabButtonActive : {}),
              }}
            >
              すべて ({typeCounts.all})
            </button>
            {Object.keys(typeCounts)
              .filter((type) => type !== 'all')
              .map((type) => {
                const badgeInfo = TYPE_LABEL_MAP[type] || { label: type };
                return (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    style={{
                      ...styles.tabButton,
                      ...(selectedType === type ? styles.tabButtonActive : {}),
                    }}
                  >
                    {badgeInfo.label} ({typeCounts[type]})
                  </button>
                );
              })}
          </div>
        </div>

        {/* カード一覧グリッド */}
        {filteredTheorems.length > 0 ? (
          <div style={styles.grid}>
            {filteredTheorems.map((item: any) => {
              const outputValues = Object.values(item.prompt_data?.outputs || {});
              const rawFormula = outputValues.length > 0 ? outputValues[0] : '';
              const latexFormula = formatFormulaToLatex(rawFormula);

              const itemType = item.prompt_data?.type || 'other';
              const typeStyle = TYPE_LABEL_MAP[itemType] || {
                label: itemType,
                bg: '#f1f5f9',
                color: '#475569',
              };

              const variablesKeys = Object.keys(item.prompt_data?.variables || {});

              return (
                <Link
                  key={item.id}
                  href={`/theorems/${item.id}`}
                  style={styles.cardLink}
                >
                  <div style={styles.card}>
                    <div style={styles.cardTop}>
                      <span
                        style={{
                          ...styles.typeBadge,
                          backgroundColor: typeStyle.bg,
                          color: typeStyle.color,
                        }}
                      >
                        {typeStyle.label}
                      </span>
                      <ChevronRight size={18} color="#cbd5e1" />
                    </div>

                    <h2 style={styles.cardTitle}>{item.name}</h2>

                    {latexFormula && (
                      <div style={styles.formulaPreview}>
                        <FormattedText text={latexFormula} />
                      </div>
                    )}

                    {variablesKeys.length > 0 && (
                      <div style={styles.variablesPreview}>
                        <Atom size={13} color="#0284c7" style={{ flexShrink: 0 }} />
                        <div style={styles.variableList}>
                          {variablesKeys.map((key, idx) => (
                            <span key={key} style={styles.variableItem}>
                              <FormattedText text={formatFormulaToLatex(key)} />
                              {idx < variablesKeys.length - 1 ? ',\u00A0' : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div style={styles.emptyBox}>
            <Sparkles size={24} color="#94a3b8" />
            <p style={{ margin: 0 }}>該当する物理の定理が見つかりませんでした。</p>
          </div>
        )}

      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageWrapper: {
    width: '100%',
    minHeight: '100vh',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    padding: '32px 16px 90px 16px',
    boxSizing: 'border-box',
    overflowX: 'hidden',
  },
  container: {
    maxWidth: '1000px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    width: '100%',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  mainTitle: {
    fontSize: '28px',
    fontWeight: '800',
    color: '#0f172a',
    margin: 0,
    lineHeight: '1.2',
  },
  subTitle: {
    fontSize: '14px',
    color: '#64748b',
    margin: 0,
  },
  controlSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '16px',
  },
  searchBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    padding: '10px 14px',
  },
  searchInput: {
    border: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    fontSize: '14px',
    width: '100%',
    color: '#0f172a',
  },
  tabContainer: {
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    paddingBottom: '4px',
    maxWidth: '100%',
    WebkitOverflowScrolling: 'touch',
  },
  tabButton: {
    padding: '6px 14px',
    borderRadius: '20px',
    border: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    color: '#64748b',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s',
    flexShrink: 0,
  },
  tabButtonActive: {
    backgroundColor: '#0284c7',
    color: '#ffffff',
    borderColor: '#0284c7',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '16px',
    width: '100%',
  },
  cardLink: {
    textDecoration: 'none',
    color: 'inherit',
    display: 'block',
    minWidth: 0,
  },
  card: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    height: '100%',
    boxSizing: 'border-box',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    cursor: 'pointer',
    minWidth: 0,
    overflow: 'hidden',
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeBadge: {
    fontSize: '11px',
    fontWeight: 'bold',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#0f172a',
    margin: 0,
    lineHeight: '1.4',
    wordBreak: 'break-word',
  },
  formulaPreview: {
    backgroundColor: '#f8fafc',
    border: '1px solid #f1f5f9',
    borderRadius: '8px',
    padding: '10px 12px',
    textAlign: 'center',
    fontSize: '15px',
    color: '#0369a1',
    fontWeight: 'bold',
    overflowX: 'auto',
    maxWidth: '100%',
    whiteSpace: 'nowrap',
  },
  variablesPreview: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '6px',
    marginTop: 'auto',
    overflow: 'hidden',
  },
  variableList: {
    display: 'flex',
    flexWrap: 'wrap',
    fontSize: '12px',
    color: '#64748b',
    overflow: 'hidden',
    wordBreak: 'break-all',
  },
  variableItem: {
    display: 'inline-flex',
    alignItems: 'center',
  },
  emptyBox: {
    padding: '48px',
    textAlign: 'center',
    color: '#64748b',
    backgroundColor: '#f8fafc',
    borderRadius: '12px',
    border: '1px dashed #cbd5e1',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
};