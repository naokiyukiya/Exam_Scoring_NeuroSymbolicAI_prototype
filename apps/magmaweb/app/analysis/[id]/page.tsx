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
  // 元の解答用紙全体のグラフ構造（複数ノード・複数エッジのレイアウト）を完全に再現
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
      { from: 'p1', to: 'i1' },
      { from: 'i1', to: 'p2' },
      { from: 'p2', to: 'i2' },
      { from: 'i2', to: 'p3' }
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
      // APIから返却された検証済みのノード情報で状態を更新し、ノードのタグと色を書き換える
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

  // React Flow用のノードに変換（元のDAG配置座標とデザインを維持）
  const flowNodes: Node[] = graphData.nodes.map((node) => {
    // ノードIDに応じた元の配置座標（レイアウト）を維持
    const positions: Record<string, { x: number; y: number }> = {
      'p1': { x: 50, y: 50 },
      'i1': { x: 320, y: 150 },
      'p2': { x: 100, y: 280 },
      'i2': { x: 380, y: 350 },
      'p3': { x: 200, y: 480 },
    };

    const status = node.verification_status || '未検証';
    const statusColor = 
      status === '問題なし' ? '#2e7d32' : 
      status === '問題あり' ? '#c62828' : '#666';

    return {
      id: node.id,
      position: positions[node.id] || { x: 100, y: 100 },
      data: {
        label: (
          <div style={{ padding: '10px', fontSize: '13px', width: '220px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ 
                fontSize: '11px', 
                padding: '2px 6px', 
                borderRadius: '4px', 
                background: node.type === 'inference' ? '#e3f2fd' : '#e8f5e9',
                color: node.type === 'inference' ? '#1565c0' : '#2e7d32',
                fontWeight: 'bold'
              }}>
                {node.type === 'inference' ? '推論' : '命題'}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: statusColor }}>
                {status}
              </span>
            </div>

            {node.type === 'proposition' && (
              <div style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#333' }}>
                {node.expression}
              </div>
            )}

            {node.type === 'inference' && node.theorem && (
              <div style={{ fontSize: '12px', color: '#444' }}>
                <div style={{ fontFamily: 'monospace' }}>{node.input_expression}</div>
                <div style={{ fontSize: '11px', color: '#666', margin: '2px 0' }}>↓ 適用</div>
                <div style={{ fontFamily: 'monospace', color: '#1d4ed8' }}>{node.output_expression}</div>
              </div>
            )}
          </div>
        ),
      },
      style: {
        background: status === '問題なし' ? '#f0fdf4' : status === '問題あり' ? '#fef2f2' : '#ffffff',
        border: `1px solid ${status === '問題なし' ? '#22c55e' : status === '問題あり' ? '#ef4444' : '#cbd5e1'}`,
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }
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
      <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff', marginBottom: '2rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        
        {/* ヘッダー部分（右上にボタンを配置） */}
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
              transition: 'background-color 0.2s'
            }}
          >
            {isLoading ? '検証中...' : '論理を検証する'}
          </button>
        </div>

        {/* React Flow グラフ描画エリア（元の解答用紙の構造を維持） */}
        <div style={{ width: '100%', height: '500px', border: '1px solid #f1f5f9', borderRadius: '8px', background: '#f8fafc' }}>
          <ReactFlow nodes={flowNodes} edges={flowEdges} fitView>
            <Background gap={16} size={1} />
            <Controls />
          </ReactFlow>
        </div>
      </div>

      {/* グラフ構築プログラム (JSONデータ) */}
      <div style={{ backgroundColor: '#0f172a', color: '#f8fafc', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
        <h3 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '1rem', color: '#94a3b8' }}>
          📝 グラフ構築プログラム (JSONデータ)
        </h3>
        <pre style={{ margin: 0, fontSize: '0.85rem', overflowX: 'auto', fontFamily: 'monospace', color: '#38bdf8' }}>
          {JSON.stringify(graphData, null, 2)}
        </pre>
      </div>

    </div>
  );
}