'use client'

import testData from '../../data/testGraph.json'
import { findMistakes } from '../../lib/findMistakes'

export default function TestAnalysisPage() {
  const analysis = findMistakes(testData.graph)
  const results = analysis.results

  return (
    <main className="p-8">
      <h1 className="mb-6 text-2xl font-bold">
        誤り分析テスト
      </h1>

      {results.length === 0 ? (
        <p>「問題あり」のノードはありません。</p>
      ) : (
        results.map((result) => (
          <div
            key={result.problemNode.id}
            className="mb-6 rounded-xl border p-5"
          >
            <h2 className="font-bold">
              問題ありノード
            </h2>

            <p className="mt-2">
              {result.problemNode.label}
            </p>

            <h2 className="mt-5 font-bold">
              関係する定理
            </h2>

            {result.theorems.length === 0 ? (
              <p className="mt-2 text-gray-500">
                定理が見つかりません
              </p>
            ) : (
              result.theorems.map((theorem) => (
                <p
                  key={theorem.id}
                  className="mt-2"
                >
                  ・{theorem.label}
                </p>
              ))
            )}
          </div>
        ))
      )}
    </main>
  )
}