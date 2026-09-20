'use client'

import testData from '../../data/testGraph.json'
import { findMistakes } from '../../lib/findMistakes'

export default function TestAnalysisPage() {
  const analysis = findMistakes(testData.graph)
  const results = analysis.results
  const theoremCounts = analysis.theoremCounts

  return (
    <main className="p-8">
      <h1 className="mb-6 text-2xl font-bold">
        誤り分析テスト
      </h1>

      {/* 問題ありノード */}
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

             {result.relatedConcepts.length === 0 ? (
              <p className="mt-2 text-gray-500">
                定理が見つかりません
              </p>
            ) : (
              result.relatedConcepts.map((concept) => (
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

      {/* 定理ごとのミス回数 */}
      <div className="mt-8 rounded-xl border p-5">
        <h2 className="text-xl font-bold">
          定理ごとのミス回数
        </h2>

        {Object.keys(theoremCounts).length === 0 ? (
          <p className="mt-3 text-gray-500">
            ミスした定理はありません。
          </p>
        ) : (
          Object.entries(theoremCounts).map(
            ([theorem, count]) => (
              <p
                key={theorem}
                className="mt-3"
              >
                ・{theorem}：{count}回
              </p>
            )
          )
        )}
      </div>
    </main>
  )
}