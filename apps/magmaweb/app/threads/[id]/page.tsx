'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  getProblemById,
  getAnswersByProblemId,
} from '../../../lib/posts'
import { getCurrentUser } from '../../../lib/auth'
import ProblemCard from '../../../components/ProblemCard'
import AnswerCard from '../../../components/AnswerCard'
import { CircleArrowLeft } from 'lucide-react'

export default function ThreadPage({
  params,
}: {
  params: { id: string }
}) {
  const [problem, setProblem] = useState<any>(null)
  const [answers, setAnswers] = useState<any[]>([])
  const router = useRouter()

  useEffect(() => {
    async function load() {
      try {
        // 未ログイン時のエラー落ちを防ぐため .catch(() => null) を指定
        const [p, a, user] = await Promise.all([
          getProblemById(params.id),
          getAnswersByProblemId(params.id),
          getCurrentUser().catch(() => null),
        ])

        // 未ログイン時はログイン画面へリダイレクト
        if (!user) {
          const currentPath = window.location.pathname
          router.push(`/login?next=${encodeURIComponent(currentPath)}`)
          return
        }

        setProblem(p)
        setAnswers(a)

      } catch (error) {
        console.error("データ読み込み中にエラーが発生しました:", error)
        const currentPath = window.location.pathname
        router.push(`/login?next=${encodeURIComponent(currentPath)}`)
      }
    }

    load()
  }, [params.id])

  if (!problem) {
    return <div style={{ padding: 20 }}>Loading...</div>
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 問題セクション */}
      <div
        style={{
          width: '100%',
          padding: '0 8px 32px',
          maxWidth: '800px',
          margin: '0 auto',
        }}
      >
        <button
          onClick={() => router.push(`/search`)}
          style={{
            background: 'none',
            border: 'none',
            color: '#333',
            cursor: 'pointer',
            padding: '10px 0',
            marginTop: '10px',
          }}
        >
          <CircleArrowLeft size={30} />
        </button>

        <ProblemCard
          image={problem.image_url}
          problemId={problem.id}
          username={problem.profiles?.handle}
          label={problem.label}
          createdAt={problem.created_at}
        />
      </div>

      {/* 解答セクション */}
      <div
        style={{
          flexGrow: 1,
          background:
            'linear-gradient(to bottom, #ffffff 0%, #f1ece1b6 1%, #e6dbcab6 5%, #e0cac3b6 60%, #d2b6ae 99%, #ffffff 100%)',
          padding: '24px 8px 48px',
        }}
      >
        <div
          style={{
            maxWidth: '800px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {answers.length > 0 ? (
            answers.map((a) => (
              <div
                key={a.id}
                style={{
                  filter:
                    'drop-shadow(0 4px 12px rgba(0,0,0,0.08))',
                }}
              >
                <AnswerCard
                  image={a.image_url}
                  answerId={a.id}
                  rootId={problem.id}
                  username={a.profiles?.handle}
                  createdAt={a.created_at}
                  anonymous={a.anonymous}
                />
              </div>
            ))
          ) : (
            <div
              style={{
                marginTop: 20,
                padding: '32px 16px',
                textAlign: 'center',
                color: '#777',
                background: 'rgba(255,255,255,0.6)',
                borderRadius: 12,
                fontSize: 14,
              }}
            >
              まだ解答が投稿されていません。
            </div>
          )}
        </div>
      </div>
    </div>
  )
}