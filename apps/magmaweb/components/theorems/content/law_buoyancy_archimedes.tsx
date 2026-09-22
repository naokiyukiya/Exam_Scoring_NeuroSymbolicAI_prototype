import React from 'react';

export default function LawBuoyancyArchimedes() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: '#f8fafc' }}>
      {/* 概要 */}
      <section style={{ backgroundColor: '#1e293b', padding: '12px 14px', borderRadius: '8px', border: '1px solid #334155' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#38bdf8', margin: '0 0 6px 0' }}>
          主張・定義
        </h3>
        <p style={{ fontSize: '14px', lineHeight: '1.6', margin: 0, color: '#e2e8f0' }}>
          流体中（液体や気体）にある物体は、その物体が<b>排除した流体の重さ（重量）に等しい大きさの浮力</b>を受ける。
        </p>
      </section>

      {/* 数式 */}
      <section style={{ backgroundColor: '#0f172a', padding: '12px 14px', borderRadius: '8px', border: '1px solid #1e293b' }}>
        <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#94a3b8', margin: '0 0 6px 0' }}>
          公式
        </h4>
        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#4ade80', textAlign: 'center', padding: '8px 0' }}>
          F = ρ V g
        </div>
        <ul style={{ fontSize: '12px', color: '#cbd5e1', paddingLeft: '20px', margin: '6px 0 0 0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <li><code style={{ color: '#38bdf8' }}>F</code>：浮力の大きさ [N]</li>
          <li><code style={{ color: '#38bdf8' }}>ρ</code>（ロー）：流体の密度 [kg/m³]</li>
          <li><code style={{ color: '#38bdf8' }}>V</code>：物体が排除した流体の体積（水中部分の体積）[m³]</li>
          <li><code style={{ color: '#38bdf8' }}>g</code>：重力加速度の大きさ [m/s²]</li>
        </ul>
      </section>

      {/* 証明・導出のポイント */}
      <section>
        <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: '#a5b4fc', margin: '0 0 6px 0' }}>
          導出の考え方（水圧の差）
        </h4>
        <p style={{ fontSize: '13px', lineHeight: '1.6', color: '#cbd5e1', margin: 0 }}>
          深さ <code style={{ color: '#38bdf8' }}>h</code> における流体の圧力は <code style={{ color: '#38bdf8' }}>p = p₀ + ρgh</code> です。
          物体の上面と下面で受ける水圧（圧力 × 面積）の差を計算すると、上面を押し下げる力よりも下面を押し上げる力の方が大きくなり、その差引きの上下方向の合力がちょうど排除した流体の重さ <code style={{ color: '#4ade80' }}>ρVg</code> に一致します。
        </p>
      </section>
    </div>
  );
}