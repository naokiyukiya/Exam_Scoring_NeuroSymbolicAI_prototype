import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { supabase } from '../../../lib/supabase'
import theorems from '../../../lib/constants/theorems.json';

// ★ Next.js (Vercel等) のAPIタイムアウト制限をデフォルトから60秒に延長する
export const maxDuration = 60;

// ★ プロンプトのバージョン
const PROMPT_VERSION = "1.11.0";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })

/**
 * 途中で切れたJSON文字列を安全に修復する強化版ヘルパー関数
 */
function repairTruncatedJson(jsonStr: string): string {
  let cleaned = jsonStr.trim();
  const lastValidIndex = Math.max(
    cleaned.lastIndexOf('}'),
    cleaned.lastIndexOf(']'),
    cleaned.lastIndexOf('"')
  );
  if (lastValidIndex !== -1 && lastValidIndex < cleaned.length - 1) {
    cleaned = cleaned.substring(0, lastValidIndex + 1);
  }
  cleaned = cleaned.replace(/,\s*"[^"]*"\s*:\s*"?[^"]*$/, '');
  cleaned = cleaned.replace(/,\s*$/, '');

  let inString = false;
  let escape = false;
  const stack: string[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{' || char === '[') {
        stack.push(char);
      } else if (char === '}') {
        if (stack.length > 0 && stack[stack.length - 1] === '{') stack.pop();
      } else if (char === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === '[') stack.pop();
      }
    }
  }

  while (stack.length > 0) {
    const open = stack.pop();
    if (open === '{') cleaned += '}';
    else if (open === '[') cleaned += ']';
  }

  return cleaned;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const answerId = searchParams.get('answerId')

  if (!answerId) {
    return NextResponse.json({ error: 'Missing answerId (パラメータが空です)' }, { status: 400 })
  }

  const { data: answer, error } = await supabase
    .from('posts')
    .select('image_url')
    .eq('id', answerId)
    .single()

  if (error || !answer?.image_url) {
    return NextResponse.json({ 
      error: 'Supabaseから画像URLを取得できませんでした', 
      details: error?.message || '該当する答案データに画像URLがありません。' 
    }, { status: 404 })
  }

  const data: any = theorems;
  const theoremVersion = data?.version || "unknown";

  const { data: existingGraph } = await supabase
    .from('logic_graphs')
    .select('graph_data, construction_process, prompt_version, theorem_version')
    .eq('post_id', answerId)
    .maybeSingle()

  if (existingGraph && existingGraph.prompt_version === PROMPT_VERSION) {
    return NextResponse.json({
      imageUrl: answer.image_url,
      graph: existingGraph.graph_data,
      constructionProcess: existingGraph.construction_process,
      metadata: {
        promptVersion: existingGraph.prompt_version || null,
        theoremVersion: existingGraph.theorem_version || null,
        cached: true
      }
    })
  }

  let theoremListString = "";
  try {
    if (data?.theorems?.rule_groups) {
      theoremListString = data.theorems.rule_groups
        .flatMap((g: any) => g.rules || [])
        .map((r: any) => `- ${r.name}`)
        .join('\n');
    } else if (data?.rule_groups) {
      theoremListString = data.rule_groups
        .flatMap((g: any) => g.rules || [])
        .map((r: any) => `- ${r.name}`)
        .join('\n');
    } else if (Array.isArray(data)) {
      theoremListString = data.map((r: any) => `- ${r.name}`).join('\n');
    }
  } catch (err) {
    console.error("定理データの展開に失敗しました", err);
  }

  try {
    const imageRes = await fetch(answer.image_url)
    const arrayBuffer = await imageRes.arrayBuffer()
    const base64Image = Buffer.from(arrayBuffer).toString('base64')

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', 
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
            {
              text: `
                [役割]
                あなたは数学教育の専門家であり、論理構造解析に特化したAIアシスタントです。

                [目的]
                入力された数学の答案画像を解析し、生徒の思考プロセスを「命題（数式や条件）」と「推論（変形ルール）」からなる有向グラフとして最後まで省略せずに抽出します。

                [抽出ルール（厳守）]
                1. グラフの基本構造（絶対遵守）:
                   - メインのフローは、必ず「命題」→「推論」→「命題」→「推論」と交互に配置してください。
                   - 【重要】ステップ数が多くても途中で省略・中断することは絶対に禁止します。グラフの最後は必ず「命題（proposition）」ノードで完結させてください。
                2. 命題（proposition）ノード:
                   - 答案に書かれている数式や条件のみを正確に抽出してください。推測で式を追加しないでください。
                3. 推論（inference）ノードと定理（theorem）ノードの分離:
                   - 【重要】推論ノードの中に "theorem" や "input_expression" 等の複雑なデータを詰め込むことは禁止します。推論ノードはシンプルに保ち、使用された定理は必ず独立した「定理ノード（type: "theorem"）」として枝分かれさせて作成・接続してください。
                   - 命題の数式内に「Σ（シグマ）」などの重要な定義・定理が含まれる場合、解説として命題ノードから直接定理ノードへ繋ぐことも推奨します。
                4. 推論ノードの検証ステータス:
                   - ノードの種類が「推論（inference）」である場合のみ、必ず "verification_status": "検証前" というプロパティを追加してください。
                5. 出力キーの制限:
                   - "graph" と "construction_process" の2つのキーのみを出力してください。勝手に "new_theorems" などのキーを追加することは厳禁です。

                [出力フォーマット（厳守）]
                - 以下のJSONフォーマットに厳密に従ってください。Markdownの余分なテキストは一切含めず、純粋なJSONのみを返してください。
                
                {
                  "graph": {
                    "nodes": [
                      { "id": "p1", "label": "x - 2 > 0", "type": "proposition" },
                      { "id": "i1", "label": "分配法則（展開）を適用する", "type": "inference", "verification_status": "検証前" },
                      { "id": "p2", "label": "3 * x + 6 > 0", "type": "proposition" },
                      { "id": "t1", "label": "分配法則（展開）: P * (Q + R) = P * Q + P * R", "type": "theorem" }
                    ],
                    "edges": [
                      { "from": "p1", "to": "i1" },
                      { "from": "i1", "to": "p2" },
                      { "from": "i1", "to": "t1" }
                    ]
                  },
                  "construction_process": [
                    "Step 1: 命題「x - 2 > 0」を抽出しました。",
                    "Step 2: 分配法則を適用する推論と定理を接続し、命題「3 * x + 6 > 0」を導きました。"
                  ]
                }

                [利用可能な定理ライブラリ]
                ${theoremListString}
              `
            }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.0,
        maxOutputTokens: 8192
      }
    })

    const rawText = response.text || ''
    let parsedData: any = null

    let cleanText = rawText.trim()
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json/, '').replace(/```$/, '').trim()
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```/, '').replace(/```$/, '').trim()
    }

    try {
      parsedData = JSON.parse(cleanText)
    } catch (parseErr1) {
      try {
        const fixedText = cleanText.replace(/\\/g, '\\\\').replace(/\\\\"|\\\\'|\\\\n/g, (match) => match.substring(2))
        parsedData = JSON.parse(fixedText)
      } catch (parseErr2) {
        try {
          const repairedText = repairTruncatedJson(cleanText)
          parsedData = JSON.parse(repairedText)
        } catch (parseErr3) {
          return NextResponse.json({ 
            error: 'Geminiの出力データがJSONとして不適正です', 
            rawText: rawText 
          })
        }
      }
    }

    let dbSaveError: any = null
    if (parsedData && parsedData.graph) {
      try {
        const { data: existing } = await supabase
          .from('logic_graphs')
          .select('id')
          .eq('post_id', answerId)
          .maybeSingle()

        const payload = {
          graph_data: parsedData.graph,
          construction_process: parsedData.construction_process || [],
          status: 'unverified',
          prompt_version: PROMPT_VERSION,       
          theorem_version: theoremVersion,      
          updated_at: new Date().toISOString()
        };

        if (existing) {
          const { error: updateErr } = await supabase
            .from('logic_graphs')
            .update(payload)
            .eq('id', existing.id)

          if (updateErr) {
            console.error('logic_graphs Update Error:', updateErr)
            dbSaveError = updateErr
          }
        } else {
          const { error: insertErr } = await supabase
            .from('logic_graphs')
            .insert({
              post_id: answerId,
              ...payload
            })

          if (insertErr) {
            console.error('logic_graphs Insert Error:', insertErr)
            dbSaveError = insertErr
          }
        }
      } catch (dbEx) {
        console.error('Supabase処理中に例外が発生しました:', dbEx)
        dbSaveError = dbEx
      }
    }

    return NextResponse.json({ 
      imageUrl: answer.image_url, 
      graph: parsedData.graph, 
      constructionProcess: parsedData.construction_process || [],
      metadata: {
        promptVersion: PROMPT_VERSION,
        theoremVersion: theoremVersion,
        cached: false
      },
      dbSaved: !dbSaveError,
      dbError: dbSaveError ? (dbSaveError.message || String(dbSaveError)) : null
    })

  } catch (err: any) {
    return NextResponse.json({ error: 'APIリクエストで致命的エラーが発生しました', details: err?.message || String(err) }, { status: 500 })
  }
}