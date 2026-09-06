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
  edges?: { from: string; to: string }[];
}

export default function AnalysisPage({ params }: { params: { id: string } }) {
  // 元のグラフ構造とノードデータを保持
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
    ],
    edges: [
      { from: 'p1', to: 'i1' }
    ]
  });

  const [isLoading, setIsLoading] = useState(false);

  // APIを呼び出して検証を実行する関数
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
      // APIから返却された検証ステータスのみを更新
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

  // 2枚目の写真のスタイル（コンパクトで洗練されたカードデザイン）を再現
  const flowNodes: Node[] = graphData.nodes.map((node) => {
    const status = node.verification_status || '未検証';
    const isOk = status === '問題なし';
    const isNg = status === '問題あり';

    // ノードの位置（元の写真の配置を維持）
    const positions: Record<string, { x: number; y: number }> = {
      'p1': { x: 100, y: 80 },
      'i1': { x: 350, y: 200 },
    };

    return {
      id: node.id,
      position: positions[node.id] || { x: 100, y: 100 },
      data: {
        label: (
          <div style={{
            background: '#ffffff',
            border: `1px solid ${isOk ? '#22c55e' : isNg ? '#ef4444' : '#cbd5e1'}`,
            borderRadius: '8px',
            padding: '10px 14px',
            minWidth: '200px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
          }}>
            {/* 上部：ラベルと検証タグ */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ 
                fontSize: '11px', 
                fontWeight: 'bold', 
                color: node.type === 'inference' ? '#2563eb' : '#16a34a' 
              }}>
                {node.type === 'inference' ? '推論' : '命題'}
              </span>
              <span style={{ 
                fontSize: '10px', 
                padding: '2px 6px', 
                borderRadius: '4px', 
                background: isOk ? '#f0fdf4' : isNg ? '#fef2f2' : '#f1f5f9',
                color: isOk ? '#16a34a' : isNg ? '#dc2626' : '#64748b',
                fontWeight: 'bold'
              }}>
                {status}
              </span>
            </div>

            {/* 内容表示 */}
            {node.type === 'proposition' && (
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#1e293b' }}>
                {node.expression}
              </div>
            )}

            {node.type === 'inference' && (
              <div style={{ fontSize: '12px', color: '#334155' }}>
                <div style={{ fontWeight: '500' }}>{node.input_expression}</div>
                <div style={{ fontSize: '11px', color: '#64748b', margin: '2px 0' }}>↓ 条件を整理する</div>
                <div style={{ fontWeight: '500', color: '#2563eb' }}>{node.output_expression}</div>
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
    style: { stroke: '#94a3b8', strokeWidth: 2 }
  }));

  return (
    <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      {/* 論理構造 DAG モニター */}
      <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        
        {/* ヘッダー部分（右上に「論理を検証する」ボタンを配置） */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 'bold', color: '#1e293b' }}>論理構造 DAG モニター</h2>
          <button
            onClick={handleVerify}
            disabled={isLoading}
            style={{
              backgroundColor: isLoading ? '#cbd5e1' : '#2563eb',
              color: '#fff',
              border: 'none',
              padding: '0.6rem 1.2rem',
              borderRadius: '6px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              fontSize: '0.9rem',
            }}
          >
            {isLoading ? '検証中...' : '論理を検証する'}
          </button>
        </div>

        {/* グラフ描画エリア */}
        <div style={{ width: '100%', height: '450px', border: '1px solid #f1f5f9', borderRadius: '8px', background: '#f8fafc' }}>
          <ReactFlow nodes={flowNodes} edges={flowEdges} fitView>
            <Background gap={16} size={1} />
            <Controls />
          </ReactFlow>
        </div>
      </div>

    </div>
  );
}