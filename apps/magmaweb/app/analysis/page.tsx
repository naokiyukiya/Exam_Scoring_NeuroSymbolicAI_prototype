'use client';

import React, { useState } from 'react';
import { 
  BarChart3, 
  BrainCircuit, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronRight, 
  RefreshCw, 
  Users, 
  BookOpen, 
  Trophy,
  Flame,
  ArrowUpRight
} from 'lucide-react';

// ダミーデータ（DBからの取得を想定した構造）
const mockAnalyticsData = {
  studentName: "山田 太郎",
  weakPoints: [
    { id: 1, category: "数学II", title: "三角関数の合成ミス", count: 4, severity: "high", lastDate: "2026-09-02" },
    { id: 2, category: "英語", title: "関係代名詞 what の識別", count: 3, severity: "medium", lastDate: "2026-09-01" },
    { id: 3, category: "物理", title: "力学的エネルギー保存則の符号ミス", count: 2, severity: "low", lastDate: "2026-08-29" },
  ],
  overcomeHistory: [
    { id: 101, title: "2次方程式の判別式", solvedDate: "2026-09-03", streak: 3 },
    { id: 102, title: "不定形極限の計算", solvedDate: "2026-09-02", streak: 5 },
  ],
  recommendedQuiz: {
    id: "q-108",
    subject: "数学II",
    title: "三角関数の最大値・最小値の決定",
    estimatedTime: "3分",
    reason: "あなたが最近つまずきやすい「三角関数の合成」を含む実践問題です"
  }
};

export default function AnalyzePage() {
  const [activeTab, setActiveTab] = useState<'student' | 'teacher' | 'parent'>('student');
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-24">
      {/* ヘッダーエリア */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-200">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                誤り分析・AI診断
              </h1>
              <p className="text-xs text-slate-500">あなたの「つまずき」を強みに変える</p>
            </div>
          </div>
          <button 
            onClick={() => setIsGeneratingQuiz(true)}
            className="p-2 text-slate-500 hover:text-indigo-600 rounded-full hover:bg-indigo-50 transition-colors"
            title="データを更新"
          >
            <RefreshCw className={`w-5 h-5 ${isGeneratingQuiz ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </header>

      {/* 視点切替タブ (生徒 / 先生 / 保護者) */}
      <div className="max-w-md mx-auto px-4 mt-4">
        <div className="flex bg-slate-200 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab('student')}
            className={`flex-1 py-2 rounded-lg transition-all ${
              activeTab === 'student' 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            :上半身シルエット_1: 生徒モード
          </button>
          <button
            onClick={() => setActiveTab('teacher')}
            className={`flex-1 py-2 rounded-lg transition-all ${
              activeTab === 'teacher' 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            :先生_男性: 先生モード
          </button>
          <button
            onClick={() => setActiveTab('parent')}
            className={`flex-1 py-2 rounded-lg transition-all ${
              activeTab === 'parent' 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            :家: 保護者モード
          </button>
        </div>
      </div>

      <main className="max-w-md mx-auto px-4 mt-6 space-y-6">

        {/* ------------------- 生徒モード ------------------- */}
        {activeTab === 'student' && (
          <>
            {/* 本日の克服おすすめクイズ */}
            <section className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-5 text-white shadow-lg shadow-indigo-200 relative overflow-hidden">
              <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 opacity-10">
                <Sparkles className="w-32 h-32" />
              </div>
              <div className="flex items-center gap-2 text-indigo-200 text-xs font-semibold mb-2">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>AIパーソナライズ問題</span>
              </div>
              <h2 className="text-lg font-bold mb-1">{mockAnalyticsData.recommendedQuiz.title}</h2>
              <p className="text-xs text-indigo-100 mb-4 leading-relaxed">
                {mockAnalyticsData.recommendedQuiz.reason}
              </p>
              <div className="flex items-center justify-between pt-2 border-t border-indigo-400/30">
                <span className="text-xs bg-indigo-500/50 px-2.5 py-1 rounded-full border border-indigo-300/30">
                  :ストップウォッチ: 目安: {mockAnalyticsData.recommendedQuiz.estimatedTime}
                </span>
                <button className="bg-white text-indigo-600 px-4 py-2 rounded-xl text-xs font-bold shadow hover:bg-indigo-50 transition-all flex items-center gap-1">
                  今すぐチャレンジ
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </section>

            {/* つまずきパターンカード一覧 */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  検出されたつまずき傾向 ({mockAnalyticsData.weakPoints.length})
                </h3>
              </div>
              <div className="space-y-3">
                {mockAnalyticsData.weakPoints.map((item) => (
                  <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        {item.category}
                      </span>
                      <span className="text-xs text-slate-400">直近の誤り: {item.lastDate}</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 mb-2">{item.title}</h4>
                    <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                      <span>過去の累計誤り: <strong className="text-rose-500">{item.count}回</strong></span>
                      <button className="text-indigo-600 font-semibold flex items-center hover:underline">
                        分析と解説を見る
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 克服ログ（モチベーションUP） */}
            <section className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold">最近克服できた問題！</h3>
              </div>
              <div className="space-y-2">
                {mockAnalyticsData.overcomeHistory.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-2.5 bg-emerald-50/60 rounded-lg border border-emerald-100">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-xs font-semibold text-slate-700">{item.title}</span>
                    </div>
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Flame className="w-3 h-3" /> {item.streak}問連続正解
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* ------------------- 先生モード ------------------- */}
        {activeTab === 'teacher' && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-900 text-xs leading-relaxed">
              <strong>:先生_男性: 授業サポートAI:</strong> クラス全体の答案データから、多くの生徒がつまずいている共通要因を抽出しています。
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  クラス全体の要フォロー項目
                </h3>
              </div>
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-bold">数学II: 三角関数の合成</span>
                    <span className="text-rose-500 font-bold">42% がつまずき中</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mb-2">
                    <div className="bg-rose-500 h-full w-[42%]" />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    :電球: 提示案: 次回の授業冒頭で $a \sin \theta + b \cos \theta$ の図形的意味を5分おさらいするのが効果的です。
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------- 保護者モード ------------------- */}
        {activeTab === 'parent' && (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-900 text-xs leading-relaxed">
              <strong>:家: ご家庭での声かけヒント:</strong> 「間違えたこと」ではなく、「どこを工夫して解き直したか」を褒めてあげると学習意欲が高まります！
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm space-y-3">
              <h3 className="text-sm font-bold">今週の学習の成果</h3>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-xs text-slate-500 block">克服したつまずき</span>
                  <span className="text-lg font-bold text-emerald-600">3 つ</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-xs text-slate-500 block">解き直し完了率</span>
                  <span className="text-lg font-bold text-indigo-600">85 %</span>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}