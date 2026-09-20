'use client';

import { useState } from 'react';

export default function TestSympyPage() {
  const [expr1, setExpr1] = useState('x**2 - 4'); // ※SymPyでは累乗は ** を使います
  const [expr2, setExpr2] = useState('(x-2)*(x+2)');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    setLoading(true);
    setResult('検証中... (数秒かかる場合があります)');
    try {
      const response = await fetch('/api/verify-sympy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expr1, expr2 }),
      });
      
      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error: any) {
      setResult(`エラーが発生しました: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>SymPy API 連携テスト</h1>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px' }}>式 1 (変形前):</label>
          <input 
            value={expr1} 
            onChange={(e) => setExpr1(e.target.value)} 
            style={{ width: '100%', padding: '8px', fontSize: '16px' }}
          />
        </div>
        
        <div>
          <label style={{ display: 'block', marginBottom: '5px' }}>式 2 (変形後):</label>
          <input 
            value={expr2} 
            onChange={(e) => setExpr2(e.target.value)} 
            style={{ width: '100%', padding: '8px', fontSize: '16px' }}
          />
        </div>

        <button 
          onClick={handleVerify} 
          disabled={loading}
          style={{ 
            padding: '12px', 
            fontSize: '16px', 
            backgroundColor: loading ? '#ccc' : '#0070f3', 
            color: '#fff', 
            border: 'none', 
            borderRadius: '5px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? '通信中...' : 'SymPyで等価性をチェック'}
        </button>

        <div style={{ marginTop: '20px' }}>
          <h3>検証結果:</h3>
          <pre style={{ backgroundColor: '#f5f5f5', padding: '15px', borderRadius: '5px', minHeight: '80px', overflowX: 'auto' }}>
            {result || '結果がここに表示されます'}
          </pre>
        </div>
      </div>
    </div>
  );
}