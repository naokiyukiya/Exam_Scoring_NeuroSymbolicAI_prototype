'use client';

import React, { useState } from 'react';

// ==========================================
// 型定義 (Type Definitions)
// ==========================================

type NodeType = 'proposition' | 'inference';

interface Theorem {
  before: string;
  after: string;
}

interface LogicNode {
  id: string;
  type: NodeType;
  expression?: string;
  theorem?: Theorem;
  input_expression?: string;
  output_expression?: string;
  verification_status?: '未検証' | '問題なし' | '問題あり';
}

interface LogicGraph {
  nodes: LogicNode[];
}

export default function AnalysisPage({ params }: { params: { id: string } }) {
  // サンプルとして、検証対象のグラフデータ（初期状態）を用意
  const [graphData, setGraphData] = useState<LogicGraph>({
    nodes: [
      {
        id: 'node-1',
        type: 'proposition',
        expression: 'A * x + B * x',
      },
      {
        id: 'node-2',
        type: 'inference',
        theorem: {
          before: 'P * x + Q * x',
          after: '(P + Q) * x',
        },
        input_expression: 'A * x + B * x',
        output_expression: '(A + B) * x',
        verification_status: '未検証',
      },
    ],
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // APIを呼び出してグラフを検証する関数
  const handleVerify = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(graphData),
      });

      if (!response.ok) {
        throw new Error('サーバーでの検証処理に失敗しました。');
      }

      const result = await response.json();
      
      // APIから返ってきた更新済みのノード情報で画面の状態を更新
      setGraphData({ nodes: result.nodes });
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || '予期せぬエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>論理グラフ検証ダッシュボード (ID: {params.id})</h1>
      <p style={{ color: '#666' }}>
        mathjsのASTパターンマッチングと代数簡約を用いて、推論ステップの数式変形が正しいかを検証します。
      </p>

      <div style={{ margin: '1.5rem 0' }}>
        <button
          onClick={handleVerify}
          disabled={isLoading}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: isLoading ? '#ccc' : '#0070f3',
            color: '#white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '1rem',
            cursor: isLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {isLoading ? '検証中...' : 'AI論理グラフを検証する'}
        </button>
      </div>

      {errorMessage && (
        <div style={{ padding: '1rem', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '4px', marginBottom: '1rem' }}>
          {errorMessage}
        </div>
      )}

      <h2>ノード一覧・検証結果</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {graphData.nodes.map((node) => (
          <div
            key={node.id}
            style={{
              border: '1px solid #ddd',
              padding: '1rem',
              borderRadius: '6px',
              backgroundColor: '#fafafa',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <strong>ID: {node.id} ({node.type})</strong>
              <span
                style={{
                  fontWeight: 'bold',
                  color:
                    node.verification_status === '問題なし'
                      ? '#2e7d32'
                      : node.verification_status === '問題あり'
                      ? '#c62828'
                      : '#555',
                }}
              >
                ステータス: {node.verification_status || '未検証'}
              </span>
            </div>

            {node.type === 'proposition' && (
              <p>数式: <code>{node.expression}</code></p>
            )}

            {node.type === 'inference' && node.theorem && (
              <div style={{ fontSize: '0.95rem', color: '#444' }}>
                <p>適用定理: <code>{node.theorem.before}</code> ⇒ <code>{node.theorem.after}</code></p>
                <p>入力式: <code>{node.input_expression}</code></p>
                <p>出力式: <code>{node.output_expression}</code></p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}