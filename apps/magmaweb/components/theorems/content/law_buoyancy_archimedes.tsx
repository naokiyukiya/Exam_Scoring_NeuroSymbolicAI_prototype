import React from 'react';
import { Info, Lightbulb } from 'lucide-react';
import FormattedText from '../../FormattedText';

interface LawBuoyancyArchimedesProps {
  theorem?: any;
  onOpenTheorem?: (theoremId: string) => void;
}

export default function LawBuoyancyArchimedes({ onOpenTheorem }: LawBuoyancyArchimedesProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', color: '#f8fafc' }}>
      
      {/* 1. 主張・定義 */}
      <section style={styles.cardInfo}>
        <div style={styles.cardHeader}>
          <Info size={15} color="#38bdf8" />
          <h3 style={{ ...styles.cardTitle, color: '#38bdf8' }}>主張・物理的意義</h3>
        </div>
        <p style={styles.cardBodyText}>
          流体中（液体や気体）にある物体は、その物体が<b>おしのけた流体の重量に等しい大きさの鉛直上向きの浮力</b>を受ける。
        </p>
      </section>

      {/* 2. 公式メイン */}
      <section style={styles.cardFormula}>
        <div style={styles.formulaBadge}>
          <span>基本公式</span>
        </div>
        
        <div style={styles.formulaDisplay}>
          <FormattedText text="$F = \rho V g$" onTheoremClick={onOpenTheorem} />
        </div>

        {/* 基本公式の概念図 */}
        <div style={styles.diagramContainer}>
          <img
            src="https://res.cloudinary.com/zmgjxdaa/image/upload/v1790102783/%E3%82%B9%E3%82%AF%E3%83%AA%E3%83%BC%E3%83%B3%E3%82%B7%E3%83%A7%E3%83%83%E3%83%88_2026-09-23_034555.png"
            alt="アルキメデスの原理の基本モデル図"
            style={styles.diagramImage}
          />
        </div>

        <div style={styles.formulaGrid}>
          <div style={styles.formulaItem}>
            <span style={styles.symbol}><FormattedText text="$F$" onTheoremClick={onOpenTheorem} /></span>
            <span>浮力の大きさ <small style={styles.unit}>[N]</small></span>
          </div>
          <div style={styles.formulaItem}>
            <span style={styles.symbol}><FormattedText text="$\rho$" onTheoremClick={onOpenTheorem} /></span>
            <span>流体の密度 <small style={styles.unit}>[kg/m³]</small></span>
          </div>
          <div style={styles.formulaItem}>
            <span style={styles.symbol}><FormattedText text="$V$" onTheoremClick={onOpenTheorem} /></span>
            <span>没入部の体積 <small style={styles.unit}>[m³]</small></span>
          </div>
          <div style={styles.formulaItem}>
            <span style={styles.symbol}><FormattedText text="$g$" onTheoremClick={onOpenTheorem} /></span>
            <span>重力加速度 <small style={styles.unit}>[m/s²]</small></span>
          </div>
        </div>
      </section>

      {/* 3. 導出のメカニズム */}
      <section style={styles.cardDerivation}>
        <div style={styles.cardHeader}>
          <h3 style={{ ...styles.cardTitle, color: '#a5b4fc' }}>導出のメカニズム（水圧の差）</h3>
        </div>

        {/* 導出モデルの図 */}
        <div style={styles.diagramContainer}>
          <img
            src="https://res.cloudinary.com/zmgjxdaa/image/upload/f_auto,q_auto/スクリーンショット_2026-09-23_025938"
            alt="アルキメデスの原理の導出モデル図"
            style={styles.diagramImage}
          />
        </div>

        <div style={styles.cardBodyText}>
          <p style={{ margin: '0 0 8px 0' }}>
            <FormattedText text="深さ $h$ における水圧は $p = p_0 + \rho g h$ です。" onTheoremClick={onOpenTheorem} />
          </p>
          <p style={{ margin: 0 }}>
            <FormattedText text="図のように、円柱の物体を水中に沈めた場合を考えます。上面（$P_1$）には下向きに押す力 $F_1 = (p_0 + \rho g h_1)S$ が働き、下面（$P_2$）には上向きに押す力 $F_2 = (p_0 + \rho g h_2)S$ がはたらきます。これらの合力は、鉛直上向きを正として：" onTheoremClick={onOpenTheorem} />
          </p>
        </div>
        
        <div style={styles.equationBox}>
          <FormattedText text="$$F_{\text{浮力}} = F_2 - F_1 = \rho g (h_2 - h_1)S = \rho V g$$" onTheoremClick={onOpenTheorem} />
        </div>

        <div style={styles.noteBox}>
          <Lightbulb size={15} color="#fbbf24" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span style={styles.noteText}>
            <b>ポイント:</b> 左右から押す水圧は互いに打ち消し合いますが、上下では深さが異なるため <FormattedText text="$p_2 > p_1$" onTheoremClick={onOpenTheorem} /> となり、この水圧差が上向きの浮力を生み出します。
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
    margin: '4px 0',
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
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: '8px',
    padding: '12px',
    border: '1px solid #1e293b',
    boxSizing: 'border-box',
  },
  diagramImage: {
    maxWidth: '100%',
    maxHeight: '220px',
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
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
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