'use client';

import React from 'react';
import physicsData from '../../lib/constants/physics.json'; // physics.jsonのパスに合わせて調整
import { theoremComponentMap } from './registry';

interface Props {
  theoremId: string;
  onClose?: () => void; // モーダル時に閉じるボタン用
}

export default function TheoremDetailRenderer({ theoremId, onClose }: Props) {
  const theorem = (physicsData as any)?.theorems?.find((t: any) => t.id === theoremId);
  const ContentComponent = theoremComponentMap[theoremId];

  if (!theorem) {
    return (
      <div className="p-8 text-white">
        {onClose && (
          <button onClick={onClose} className="mb-4 text-slate-400 hover:text-white">
            ← 閉じる
          </button>
        )}
        <p>該当する定理データが見つかりません。 (ID: {theoremId})</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto text-white p-6">
      {/* モーダル用閉じるボタン等 */}
      {onClose && (
        <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
          <span className="text-xs text-blue-400 font-mono">THEOREMS / {theorem.id}</span>
          <button onClick={onClose} className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-sm text-slate-300">
            ✕ 閉じる
          </button>
        </div>
      )}

      {/* ヘッダー情報 */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">{theorem.name}</h1>
        {theorem.prompt_data?.variables && (
          <div className="bg-slate-800/80 p-4 rounded-lg border border-slate-700 mt-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">登場する物理量・変数</h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(theorem.prompt_data.variables).map(([key, val]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="font-mono text-cyan-400">${key}$</span>
                  <span className="text-slate-300">: {val as string}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* 自由記述コンポーネントのレンダリング */}
      <main className="mt-6">
        {ContentComponent ? (
          <ContentComponent theorem={theorem} />
        ) : (
          <div className="p-6 bg-slate-800/50 rounded-lg text-slate-400 border border-slate-700">
            この定理のリッチ解説コンポーネントは準備中です。
          </div>
        )}
      </main>
    </div>
  );
}