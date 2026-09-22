import React from 'react';
import { Info, Lightbulb } from 'lucide-react';
import FormattedText from '../../FormattedText';

interface LawFluidPressureProps {
  theorem?: any;
  onOpenTheorem?: (theoremId: string) => void;
}

export default function LawFluidPressure({ onOpenTheorem }: LawFluidPressureProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', color: '#f8fafc' }}>
      
      {/* 1. 主張・物理的意義 */}
      <section style={styles.cardInfo}>
        <div style={styles.cardHeader}>
          <Info size={15} color="#38bdf8" />
          <h3 style={{ ...styles.cardTitle, color: '#38bdf8' }}>概要</h3>
        </div>
        <p style={styles.cardBodyText}>
          静止した流体中の深さにある面は、その上にある<b>流体の重さ（重量）と大気圧の合計による力</b>を均等に受ける。水圧は面に対して垂直にはたらき、深さに比例して大きくなる。
        </p>
      </section>

      {/* 2. 基本公式 */}
      <section style={styles.cardFormula}>
        <div style={styles.formulaBadge}>
          <span>基本公式</span>
        </div>
        
        <div style={styles.formulaDisplay}>
          <FormattedText text="$p = p_0 + \rho g h$" onTheoremClick={onOpenTheorem} />
        </div>

        <div style={styles.formulaGrid}>
          <div style={styles.formulaItem}>
            <span style={styles.symbol}><FormattedText text="$p$" onTheoremClick={onOpenTheorem} /></span>
            <span>深さ $h$ での水圧 <small style={styles.unit}>[Pa]</small></span>
          </div>
          <div style={styles.formulaItem}>
            <span style={styles.symbol}><FormattedText text="$p_0$" onTheoremClick={onOpenTheorem} /></span>
            <span>大気圧（液面の圧力） <small style={styles.unit}>[Pa]</small></span>
          </div>
          <div style={styles.formulaItem}>
            <span style={styles.symbol}><FormattedText text="$\rho$" onTheoremClick={onOpenTheorem} /></span>
            <span>流体の密度 <small style={styles.unit}>[kg/m³]</small></span>
          </div>
          <div style={styles.formulaItem}>
            <span style={styles.symbol}><FormattedText text="$g$" /></span>
            <span>重力加速度 <small style={styles.unit}>[m/s²]</small></span>
          </div>
          <div style={styles.formulaItem}>
            <span style={styles.symbol}><FormattedText text="$h$" /></span>
            <span>液面からの深さ <small style={styles.unit}>[m]</small></span>
          </div>
        </div>
      </section>

      {/* 3. 導出のメカニズム */}
      <section style={styles.cardDerivation}>
        <div style={styles.cardHeader}>
          <h3 style={{ ...styles.cardTitle, color: '#a5b4fc' }}>導出のメカニズム（力のつりあい）</h3>
        </div>

        <div style={styles.cardBodyText}>
          <p style={{ margin: '0 0 8px 0' }}>
            <FormattedText text="密度 $\rho$ の静止した液体において、液面から深さ $h$ の位置にある底面積 $S$ の仮想的な液柱（直方体）を考えます。" onTheoremClick={onOpenTheorem} />
          </p>
          <p style={{ margin: '0 0 8px 0' }}>
            <FormattedText text="この液柱にはたらく鉛直方向の力は以下の3つです：" onTheoremClick={onOpenTheorem} />
          </p>
          <ul style={{ margin: '0 0 8px 0', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <li><FormattedText text="1. 上面（液面）を大気が下向きに押す力 $F_0 = p_0 S$" onTheoremClick={onOpenTheorem} /></li>
            <li><FormattedText text="2. 液柱自身の重さ $W = m g = (\rho \cdot S h) g$" onTheoremClick={onOpenTheorem} /></li>
            <li><FormattedText text="3. 下面の周囲の液体が上向きに押す力 $F = p S$" onTheoremClick={onOpenTheorem} /></li>
          </ul>
          <p style={{ margin: 0 }}>
            <FormattedText text="液柱が静止しているため、鉛直方向の力のつりあい式 $F = F_0 + W$ を立てると：" onTheoremClick={onOpenTheorem} />
          </p>
        </div>
        
        <div style={styles.equationBox}>
          <FormattedText text="$$p S = p_0 S + \rho S h g$$" onTheoremClick={onOpenTheorem} />
          <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
            両辺を $S$ で割ると：
          </p>
          <FormattedText text="$$p = p_0 + \rho g h$$" onTheoremClick={onOpenTheorem} />
        </div>

        <div style={styles.noteBox}>
          <Lightbulb size={15} color="#fbbf24" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span style={styles.noteText}>
            <b>ポイント:</b> 水圧 $p$ は「大気圧 $p_0$」と「深さ $h$ に比例する水自体の重さ $\rho g h$」の和で決まります。問題によっては「ゲージ圧（大気圧差 $p - p_0 = \rho g h$）」を問われる場合もあるので注意しましょう。
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