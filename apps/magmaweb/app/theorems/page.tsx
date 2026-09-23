'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import physicsData from '../../lib/constants/physics.json';
import { Search, BookOpen, ChevronRight, Atom, Sparkles } from 'lucide-react';
import FormattedText from '../../components/FormattedText';

export default function TheoremsIndexPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');

  const theorems = (physicsData as any)?.theorems || [];

  // フィルタリング処理
  const filteredTheorems = useMemo(() => {
    return theorems.filter((t: any) => {
      // 検索ワードマッチ（名前 or ID）
      const matchesSearch =
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.id.toLowerCase().includes(searchQuery.toLowerCase());

      // タイプ（law / math など）マッチ
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
          <div style={styles.titleBadge}>
            <BookOpen size={16} color="#0284c7" />
            <span>物理公式・法則ライブラリ</span>
          </div>
          <h1 style={styles.mainTitle}>物理の定理・法則一覧</h1>
          <p style={styles.subTitle}>
            各定理の解説、公式、登場する物理量や導出メカニズムを確認できます。
          </p>
        </header>

        {/* 検索 & フィルターコントロール */}
        <div style={styles.controlSection}>
          {/* 検索バー */}
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

          {/* タブフィルター */}
          <div style={styles.tabContainer}>
            <button
              onClick={() => setSelectedType('all')}
              style={{
                ...styles.tabButton,
                ...(selectedType === 'all' ? styles.tabButtonActive : {}),
              }}
            >
              すべて ({theorems.length})
            </button>
            <button
              onClick={() => setSelectedType('law')}
              style={{
                ...styles.tabButton,
                ...(selectedType === 'law' ? styles.tabButtonActive : {}),
              }}
            >
              物理法則 (Law)
            </button>
            <button
              onClick={() => setSelectedType('math')}
              style={{
                ...styles.tabButton,
                ...(selectedType === 'math' ? styles.tabButtonActive : {}),
              }}
            >
              数学・ベクトル (Math)
            </button>
          </div>
        </div>

        {/* カード一覧グリッド */}
        {filteredTheorems.length > 0 ? (
          <div style={styles.grid}>
            {filteredTheorems.map((item: any) => {
              const outputValues = Object.values(item.prompt_data?.outputs || {});
              const mainFormula = outputValues.length > 0 ? (outputValues[0] as string) : null;

              return (
                <Link
                  key={item.id}
                  href={`/theorems/${item.id}`}
                  style={styles.cardLink}
                >
                  <div style={styles.card}>
                    {/* カードヘッダー（タイプタグ） */}
                    <div style={styles.cardTop}>
                      <span
                        style={{
                          ...styles.typeBadge,
                          ...(item.prompt_data?.type === 'law'
                            ? styles.badgeLaw
                            : styles.badgeMath),
                        }}
                      >
                        {item.prompt_data?.type === 'law' ? '物理法則' : '数学手法'}
                      </span>
                      <ChevronRight size={18} color="#cbd5e1" />
                    </div>

                    {/* 定理名 */}
                    <h2 style={styles.cardTitle}>{item.name}</h2>

                    {/* メイン公式プレビュー */}
                    {mainFormula && (
                      <div style={styles.formulaPreview}>
                        <FormattedText text={`$${mainFormula}$`} />
                      </div>
                    )}

                    {/* 変数プレビュー */}
                    {item.prompt_data?.variables && (
                      <div style={styles.variablesPreview}>
                        <Atom size={13} color="#0284c7" style={{ flexShrink: 0 }} />
                        <span style={styles.variableText}>
                          {Object.keys(item.prompt_data.variables).join(', ')}
                        </span>
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

// -------------------------------------------------------------
// スタイル定義（クリーンな白背景ベース）
// -------------------------------------------------------------
const styles: Record<string, React.CSSProperties> = {
  pageWrapper: {
    width: '100%',
    minHeight: '100vh',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    padding: '32px 16px 90px 16px', // フッター被り防止の余白
    boxSizing: 'border-box',
  },
  container: {
    maxWidth: '1000px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  titleBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#0284c7',
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
  },
  cardLink: {
    textDecoration: 'none',
    color: 'inherit',
    display: 'block',
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
    transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
    cursor: 'pointer',
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
  badgeLaw: {
    backgroundColor: '#e0f2fe',
    color: '#0369a1',
  },
  badgeMath: {
    backgroundColor: '#f3e8ff',
    color: '#6b21a8',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#0f172a',
    margin: 0,
    lineHeight: '1.4',
  },
  formulaPreview: {
    backgroundColor: '#f8fafc',
    border: '1px solid #f1f5f9',
    borderRadius: '8px',
    padding: '8px 12px',
    textAlign: 'center',
    fontSize: '15px',
    color: '#0369a1',
    fontWeight: 'bold',
  },
  variablesPreview: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: 'auto',
  },
  variableText: {
    fontSize: '12px',
    color: '#64748b',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
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