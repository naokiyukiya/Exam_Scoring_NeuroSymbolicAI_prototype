import React from 'react';
import { Info, Calculator, GitCommitVertical, Lightbulb } from 'lucide-react';
import FormattedText from '../../FormattedText';

export default function LawBuoyancyArchimedes() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', color: '#f8fafc' }}>
      
      {/* 1. 主張・定義 */}
      <section style={styles.cardInfo}>
        <div style={styles.cardHeader}>
          <Info size={15} color="#38bdf8" />
          <h3 style={{ ...styles.cardTitle, color: '#38bdf8' }}>主張・物理的意義</h3>
        </div>
        <p style={styles.cardBodyText}>
          流体中（液体や気体）にある物体は、その物体が<b>排除した流体の重さ（重量）に等しい大きさの鉛直上向きの浮力</b>を受ける。
        </p>
      </section>

      {/* 2. 公式メイン */}
      <section style={styles.cardFormula}>
        <div style={styles.formulaBadge}>
          <Calculator size={12} color="#818cf8" />
          <span>基本公式</span>
        </div>
        
        <div style={styles.formulaDisplay}>
          <FormattedText text="$F = \rho V g$" />
        </div>

        <div style={styles.formulaGrid}>
          <div style={styles.formulaItem}>
            <span style={styles.symbol}><FormattedText text="$F$" /></span>
            <span>浮力の大きさ <small style={styles.unit}>[N]</small></span>
          </div>
          <div style={styles.formulaItem}>
            <span style={styles.symbol}><FormattedText text="$\rho$" /></span>
            <span>流体の密度 <small style={styles.unit}>[kg/m³]</small></span>
          </div>
          <div style={styles.formulaItem}>
            <span style={styles.symbol}><FormattedText text="$V$" /></span>
            <span>没入部分の体積 <small style={styles.unit}>[m³]</small></span>
          </div>
          <div style={styles.formulaItem}>
            <span style={styles.symbol}><FormattedText text="$g$" /></span>
            <span>重力加速度 <small style={styles.unit}>[m/s²]</small></span>
          </div>
        </div>
      </section>

      {/* 3. 導出のメカニズム */}
      <section style={styles.cardDerivation}>
        <div style={styles.cardHeader}>
          <GitCommitVertical size={15} color="#a5b4fc" />
          <h3 style={{ ...styles.cardTitle, color: '#a5b4fc' }}>導出のメカニズム（水圧の差）</h3>
        </div>

        {/* Cloudinaryの図を表示 */}
        <div style={styles.diagramContainer}>
          <img
            src="https://res.cloudinary.com/zmgjxdaa/image/upload/f_auto,q_auto/スクリーンショット_2026-09-23_025938"
            alt="アルキメデスの原理の導出モデル図"
            style={styles.diagramImage}
          />
        </div>

        <div style={styles.cardBodyText}>
          <p style={{ margin: '0 0 6px 0' }}>
            <FormattedText text="深さ $h$ における水圧は $p = p_0 + \rho g h$ です。" />
          </p>
          <p style={{ margin: 0 }}>
            <FormattedText text="円柱の物体を水中に沈めたとき、上面を下向きに押す力 $F_1 = (p_0 + \rho g h_1)S$ と、下面を上向きに押す力 $F_2 = (p_0 + \rho g h_2)S$ の差をとると：" />
          </p>
        </div>
        
        <div style={styles.equationBox}>
          <FormattedText text="$$F_{\text{浮力}} = F_2 - F_1 = \rho g (h_2 - h_1)S = \rho V g$$" />
        </div>

        <div style={styles.noteBox}>
          <Lightbulb size={15} color="#fbbf24" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span style={styles.noteText}>
            <b>ポイント:</b> 左右から押す水圧は打ち消し合いますが、上下では深さが異なるため <FormattedText text="**$p_2 > p_1$**" /> となり、差し引きで「上向きの力（浮力）」が生まれます。
          </span>
        </div>
      </section>

    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  cardInfo: {
    backgroundColor: '#1e293b',
    padding: '14px 16px',
    borderRadius: '10px',
    border: '1px solid #334155',
  },
  cardFormula: {
    backgroundColor: '#111827',
    padding: '16px',
    borderRadius: '10px',
    border: '1px solid #1e293b',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  formulaBadge: {
    alignSelf: 'flex-start',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    fontWeight: '600',
    color: '#818cf8',
    backgroundColor: '#1e1b4b',
    padding: '3px 8px',
    borderRadius: '6px',
    border: '1px solid #312e81',
  },
  formulaDisplay: {
    fontSize: '22px',
    fontWeight: 'bold',
    color: '#4ade80',
    margin: '8px 0 4px',
    textAlign: 'center',
  },
  formulaGrid: {
    width: '100%',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: '8px',
    borderTop: '1px solid #1e293b',
    paddingTop: '12px',
  },
  formulaItem: {
    fontSize: '12px',
    color: '#cbd5e1',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  symbol: {
    color: '#38bdf8',
    fontWeight: 'bold',
  },
  unit: {
    color: '#64748b',
  },
  cardDerivation: {
    backgroundColor: '#1e293b',
    padding: '14px 16px',
    borderRadius: '10px',
    border: '1px solid #334155',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  cardTitle: {
    fontSize: '13px',
    fontWeight: 'bold',
    margin: 0,
  },
  diagramContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: '8px',
    padding: '12px',
    border: '1px solid #1e293b',
  },
  diagramImage: {
    maxWidth: '100%',
    maxHeight: '260px',
    objectFit: 'contain',
    borderRadius: '4px',
  },
  cardBodyText: {
    fontSize: '13px',
    lineHeight: '1.6',
    color: '#e2e8f0',
  },
  equationBox: {
    backgroundColor: '#0f172a',
    padding: '12px 10px',
    borderRadius: '6px',
    border: '1px solid #1e293b',
    textAlign: 'center',
    fontSize: '15px',
    color: '#4ade80',
    overflowX: 'auto',
  },
  noteBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    border: '1px solid rgba(245, 158, 11, 0.2)',
    padding: '10px 12px',
    borderRadius: '8px',
    marginTop: '4px',
  },
  noteText: {
    fontSize: '12px',
    color: '#fbbf24',
    lineHeight: '1.5',
  },
};