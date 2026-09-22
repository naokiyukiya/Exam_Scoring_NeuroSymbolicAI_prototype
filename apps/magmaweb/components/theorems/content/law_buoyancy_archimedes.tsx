import React from 'react';
import { Lightbulb, Info, ArrowDownUp } from 'lucide-react';
import FormattedText from '../../components/FormattedText'; // 数式レンダラー

export default function LawBuoyancyArchimedes() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', color: '#f8fafc' }}>
      
      {/* 1. 主張・定義カード */}
      <section style={styles.cardInfo}>
        <div style={styles.cardHeader}>
          <Info size={15} color="#38bdf8" />
          <h3 style={{ ...styles.cardTitle, color: '#38bdf8' }}>主張・物理的意義</h3>
        </div>
        <p style={styles.cardBodyText}>
          流体中（液体や気体）にある物体は、その物体が<b>排除した流体の重さ（重量）に等しい大きさの鉛直上向きの浮力</b>を受ける。
        </p>
      </section>

      {/* 2. 公式メインカード */}
      <section style={styles.cardFormula}>
        <span style={styles.formulaBadge}>基本公式</span>
        <div style={styles.formulaDisplay}>
          <FormattedText text="$F = \rho V g$" />
        </div>
        <div style={styles.formulaGrid}>
          <div style={styles.formulaItem}>
            <span style={styles.symbol}>$F$</span>
            <span>浮力の大きさ <small style={styles.unit}>[N]</small></span>
          </div>
          <div style={styles.formulaItem}>
            <span style={styles.symbol}>$\rho$</span>
            <span>流体の密度 <small style={styles.unit}>[kg/m³]</small></span>
          </div>
          <div style={styles.formulaItem}>
            <span style={styles.symbol}>$V$</span>
            <span>没入部分の体積 <small style={styles.unit}>[m³]</small></span>
          </div>
          <div style={styles.formulaItem}>
            <span style={styles.symbol}>$g$</span>
            <span>重力加速度 <small style={styles.unit}>[m/s²]</small></span>
          </div>
        </div>
      </section>

      {/* 3. 導出の考え方（水圧差） */}
      <section style={styles.cardDerivation}>
        <div style={styles.cardHeader}>
          <ArrowDownUp size={15} color="#a5b4fc" />
          <h3 style={{ ...styles.cardTitle, color: '#a5b4fc' }}>導出のメカニズム（水圧の差）</h3>
        </div>
        <p style={styles.cardBodyText}>
          深さ <code style={styles.codeText}>h</code> における水圧は <code style={styles.codeText}>p = p₀ + ρgh</code> です。<br />
          円柱の物体を水中に沈めたとき、上面を下向きに押す力 $F_1 = (p_0 + \rho g h_1)S$ と、下面を上向きに押す力 $F_2 = (p_0 + \rho g h_2)S$ の差をとると：
        </p>
        <div style={styles.equationBox}>
          <FormattedText text="$F_{浮力} = F_2 - F_1 = \rho g (h_2 - h_1)S = \rho V g$" />
        </div>
        <p style={styles.noteText}>
          💡 <b>ポイント:</b> 物体の質量（物体の密度）ではなく、<b>「周囲の流体の密度 $\rho$」</b> を使う点につまずきやすいので注意しましょう！
        </p>
      </section>

    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  cardInfo: {
    backgroundColor: '#1e293b',
    padding: '14px',
    borderRadius: '10px',
    border: '1px solid #334155',
  },
  cardFormula: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    padding: '16px',
    borderRadius: '10px',
    border: '1px solid #312e81',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  formulaBadge: {
    position: 'absolute',
    top: '10px',
    left: '12px',
    fontSize: '10px',
    fontWeight: 'bold',
    color: '#818cf8',
    backgroundColor: '#1e1b4b',
    padding: '2px 8px',
    borderRadius: '4px',
    border: '1px solid #3730a3',
  },
  formulaDisplay: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#4ade80',
    margin: '12px 0 4px',
  },
  formulaGrid: {
    width: '100%',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
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
    padding: '14px',
    borderRadius: '10px',
    border: '1px solid #334155',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '2px',
  },
  cardTitle: {
    fontSize: '13px',
    fontWeight: 'bold',
    margin: 0,
  },
  cardBodyText: {
    fontSize: '13px',
    lineHeight: '1.6',
    color: '#e2e8f0',
    margin: 0,
  },
  codeText: {
    color: '#38bdf8',
    backgroundColor: '#0f172a',
    padding: '2px 6px',
    borderRadius: '4px',
    fontFamily: 'monospace',
  },
  equationBox: {
    backgroundColor: '#0f172a',
    padding: '10px',
    borderRadius: '6px',
    border: '1px solid #1e293b',
    textAlign: 'center',
    fontSize: '14px',
    color: '#e2e8f0',
    margin: '4px 0',
  },
  noteText: {
    fontSize: '12px',
    color: '#fbbf24',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.2)',
    padding: '8px 10px',
    borderRadius: '6px',
    margin: '4px 0 0 0',
    lineHeight: '1.5',
  },
};