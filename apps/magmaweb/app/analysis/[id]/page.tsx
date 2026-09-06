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
  // グラフデータ（初期状態：未検証）
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
      // APIから返却された検証済みのノード情報で状態を更新
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

  // React Flow用のノードに変換（検証ステータスに応じて色や表示を変更）
  const flowNodes: Node[] = graphData.nodes.map((node, index) => ({
    id: node.id,
    position: { x: 100 + (index * 250), y: 150 + (index * 100) },
    data: {
      label: (
        <div style={{ padding: '8px', fontSize: '12px' }}>
          <div style={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
            <span>{node.type === 'inference' ? '推論' : '命題'}</span>
            <span style={{ 
              color: node.verification_status === '問題なし' ? '#2e7d32' : 
                     node.verification_status === '問題あり' ? '#c62828' : '#666' 
            }}>
              {node.verification_status || '未検証'}
            </span>
          </div>
          {node.type === 'proposition' && <div>{node.expression}</div>}
          {node.type === 'inference' && node.theorem && (
            <div>
              <div>{node.input_expression}</div>
              <div style={{ fontSize: '10px', color: '#666' }}>↓ {node.theorem.after}</div>
            </div>
          )}
        </div>
      ),
    },
    style: {
      background: node.verification_status === '問題なし' ? '#e8f5e9' :
                  node.verification_status === '問題あり' ? '#ffebee' : '#fff',
      border: `1px solid ${
        node.verification_status === '問題なし' ? '#4caf50' :
        node.verification_status === '問題あり' ? '#f4433e' : '#ccc'
      }`,
      borderRadius: '8px',
      width: 220,
    }
  }));

  const flowEdges: Edge[] = (graphData.edges || []).map((edge, i) => ({
    id: `e-${i}`,
    source: edge.from,
    target: edge.to,
    animated: true,
  }));

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      {/* 2枚目の画像のエリア：論理構造 DAG モニター */}
      <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '1.5rem', background: '#fff', marginBottom: '2rem' }}>
        
        {/* ヘッダー部分（右上にボタンを配置） */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 'bold' }}>論理構造 DAG モニター</h2>
          <button
            onClick={handleVerify}
            disabled={isLoading}
            style={{
              backgroundColor: isLoading ? '#ccc' : '#2563eb',
              color: '#fff',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              fontSize: '0.9rem',
            }}
          >
            {isLoading ? '検証中...' : '論理を検証する'}
          </button>
        </div>

        {/* React Flow グラフ描画エリア */}
        <div style={{ width: '1000px', height: '400px', border: '1px solid #eee', borderRadius: '6px' }}>
          <ReactFlow nodes={flowNodes} edges={flowEdges} fitView>
            <Background />
            <Controls />
          </ReactFlow>
        </div>
      </div>

      {/* 3枚目の画像のエリア：グラフ構築プログラム (JSONデータ) */}
      <div style={{ backgroundColor: '#1e293b', color: '#f8fafc', padding: '1.5rem', borderRadius: '8px' }}>
        <h3 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '1rem', color: '#cbd5e1' }}>
          📝 グラフ構築プログラム (JSONデータ)
        </h3>
        <pre style={{ margin: 0, fontSize: '0.85rem', overflowX: 'auto', fontFamily: 'monospace' }}>
          {JSON.stringify(graphData, null, 2)}
        </pre>
      </div>

    </div>
  );
}