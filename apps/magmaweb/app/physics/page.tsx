"use client";
import { useState } from "react";

export default function PhysicsSolver() {
  // AI(Gemini)が抽出したと仮定する初期状況（テスト用データ）
  const [situation, setSituation] = useState({
    motion_states: {
      "y軸": { state: "stationary" },
      "x軸": { state: "accelerating", acceleration_symbol: "a" }
    }
  });
  
  const [dagNodes, setDagNodes] = useState<any[]>([]);
  const [isFinished, setIsFinished] = useState(false);

  const handleNextStep = async () => {
    if (!situation) return;
    
    // 現在画面に表示されている定理のラベルだけを配列として抽出
    const appliedLaws = dagNodes.map(node => node.label);

    try {
      // Pythonサーバー(5328番ポート)の推論APIにデータを送信
      const res = await fetch("http://localhost:5328/api/get_next_node", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          situation: situation,
          applied_laws: appliedLaws
        })
      });
      
      const data = await res.json();

      // Pythonから新しい定理が返ってこなかったら推論完了
      if (data.status === "complete" || !data.next_node) {
        setIsFinished(true);
        return;
      }

      // 新しいノード（次の一手）をDAG配列に追加し、画面を更新
      setDagNodes([...dagNodes, data.next_node]);
      
    } catch (error) {
      console.error("APIエラー:", error);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">物理推論エンジン（プロトタイプ）</h1>
      
      <button 
        onClick={handleNextStep} 
        disabled={isFinished}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
      >
        {isFinished ? "推論完了（すべての定理を適用済み）" : "次の一手を探す"}
      </button>

      <div className="mt-8 space-y-4">
        {dagNodes.map((node, index) => (
          <div key={node.id} className="border p-4 rounded shadow-sm bg-white">
            <h2 className="font-bold text-lg text-blue-800">
              Step {index + 1}: {node.label}
            </h2>
            <p className="text-gray-600 mt-2">
              <strong>理由:</strong> {node.justification}
            </p>
            <div className="mt-3 p-3 bg-gray-100 rounded font-mono text-lg">
              {node.outputs_derived.equation}
            </div>
            {/* ASTの内部構造を確認するためのデバッグ表示 */}
            <details className="mt-2 text-sm text-gray-500">
              <summary className="cursor-pointer">AST(内部データ)を表示</summary>
              <pre className="mt-2 p-2 bg-gray-800 text-green-400 rounded overflow-x-auto">
                {JSON.stringify(node.formula_ast, null, 2)}
              </pre>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}