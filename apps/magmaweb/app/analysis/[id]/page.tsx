'use client';

import React, { useState } from 'react';
import { ReactFlow, Background, Controls, Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// ==========================================
// 1. 型定義
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
  edges?: { to: string; from: string }[];
}

export default function AnalysisPage({ params }: { params: { id: string } }) {
  // 3枚目の写真のJSON構造および元のグラフ構造を完全に再現
  const [graphData, setGraphData] = useState<LogicGraph>({
    nodes: [
      {
        id: 'p1',
        type: 'proposition',
        expression: 'x - 2 > 0',
        verification_status: '未検証',
      },
      {
        id: 'i1',
        type: 'inference',
        theorem: { before: 'P * x + Q * x', after: '(P + Q) * x' },
        input_expression: '3 * x^2 - 5 * x - 8',
        output_expression: '(3 * x - 8) * (x + 1)',
        verification_status: '未検証',
      },
      {
        id: 'p2',
        type: 'proposition',
        expression: 'x > 2',
        verification_status: '未検証',
      },
      {
        id: 'i2',
        type: 'inference',
        theorem: { before: 'A', after: 'B' },
        input_expression: '6 <= (3 * x + 1) * (x - 2)',
        output_expression: '6 <= 3 * x^2 - 5 * x - 2',
        verification_status: '未検証',
      },
      {
        id: 'p3',
        type: 'proposition',
        expression: '3 * x^2 - 5 * x - 8 >= 0',
        verification_status: '未検証',
      }
    ],
    edges: [
      { to: 'i1', from: 'p1' },
      { to: 'p2', from: 'i1' },
      { to: 'i2', from: 'p4' }, // 元のJSON構造に合わせたエッジ
      { to: 'p5', from: 'i2' },
      { to: 'i3', from: 'p3' }
    ]
  });

  const [isLoading, setIsLoading] = useState(false);

  // 検証APIを呼び出してステータスを更新する関数
  const handleVerify = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(graphData),
      });

      if (!response.ok) throw new Error('検証に失敗しました');

      const result = await response.json();
      setGraphData(prev => ({
        ...prev,
        nodes: result.nodes
      }));
    } catch (error) {
      console.error(error);
      alert('エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  // 元の写真のカードデザインを完全に再現したノード変換
  const flowNodes: Node[] = graphData.nodes.map((node, index) => {
    const status = node.verification_status || '未検証';
    const isOk = status === '問題なし';
    const isNg = status === '問題あり';

    return {
      id: node.id,
      position: { x: 100 + (index * 120), y: 80 + (index * 90) },
      data: {
        label: (
          <div style={{
            background: isOk ? '#f0fdf4' : isNg ? '#fef2f2' : '#ffffff',
            border: `1px solid ${isOk ? '#22c55e' : isNg ? '#ef4444' : '#93c5fd'}`,
            borderRadius: '6px',
            padding: '8px 12px',
            minWidth: '180px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '10px', fontWeight: 'bold', color: node.type === 'inference' ? '#2563eb' : '#16a34a' }}>
                {node.type === 'inference' ? '推論' : '命題'}
              </span>
              <span style={{ 
                fontSize: '9px', 
                padding: '1px 5px', 
                borderRadius: '3px', 
                background: isOk ? '#dcfce7' : isNg ? '#fee2e2' : '#f1f5f9',
                color: isOk ? '#16a34a' : isNg ? '#dc2626' : '#64748b',
                fontWeight: 'bold'
              }}>
                {status}
              </span>
            </div>
            {node.type === 'proposition' && (
              <div style={{ fontSize: '12px', color: '#1e293b' }}>{node.expression}</div>
            )}
            {node.type === 'inference' && (
              <div style={{ fontSize: '11px', color: '#334155' }}>
                <div>{node.input_expression}</div>
                <div style={{ fontSize: '10px', color: '#64748b' }}>↓ 条件を整理する</div>
              </div>
            )}
          </div>
        ),
      },
      style: { background: 'transparent', border: 'none', padding: 0 }
    };
  });

  const flowEdges: Edge[] = (graphData.edges || []).map((edge, i) => ({
    id: `e-${i}`,
    source: edge.from,
    target: edge.to,
    animated: true,
  }));

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      {/* 2枚目の写真のエリア：論理構造 DAG モニター */}
      <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.5rem', background: '#fff', marginBottom: '2rem' }}>
        
        {/* ヘッダー部分（右上に「論理を検証する」ボタンを配置） */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1rem', margin: 0, fontWeight: 'bold', color: '#1e293b' }}>論理構造 DAG モニター</h2>
          <button
            onClick={handleVerify}
            disabled={isLoading}
            style={{
              backgroundColor: isLoading ? '#cbd5e1' : '#2563eb',
              color: '#fff',
              border: 'none',
              padding: '0.4rem 1rem',
              borderRadius: '6px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              fontSize: '0.85rem',
            }}
          >
            {isLoading ? '検証中...' : '論理を検証する'}
          </button>
        </div>

        {/* React Flow グラフ描画エリア */}
        <div style={{ width: '100%', height: '400px', border: '1px solid #f1f5f9', borderRadius: '6px', background: '#fafafa' }}>
          <ReactFlow nodes={flowNodes} edges={flowEdges} fitView>
            <Background />
            <Controls />
          </ReactFlow>
        </div>
      </div>

      {/* 3枚目の写真のエリア：グラフ構築プログラム (JSONデータ) */}
      <div style={{ backgroundColor: '#1e293b', color: '#f8fafc', padding: '1.5rem', borderRadius: '8px' }}>
        <h3 style={{ fontSize: '0.95rem', marginTop: 0, marginBottom: '1rem', color: '#cbd5e1' }}>
          📝 グラフ構築プログラム (JSONデータ)
        </h3>
        <pre style={{ margin: 0, fontSize: '0.8rem', overflowX: 'auto', fontFamily: 'monospace' }}>
          {JSON.stringify({ graph: graphData }, null, 2)}
        </pre>
      </div>

    </div>
  );
}