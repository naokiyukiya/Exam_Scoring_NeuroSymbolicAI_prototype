import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { supabase } from '../../../lib/supabase'
import theorems from '../../../lib/constants/theorems.json';

// ★ Next.js のAPIタイムアウト制限を60秒に延長
export const maxDuration = 60;

// ★ プロンプトのバージョン
const PROMPT_VERSION = "1.13.0";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })

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
                1. グラフの基本構造と完走の義務:
                   - メインのフローは、必ず「命題」→「推論」→「命題」→「推論」と交互に配置してください。
                   - 【超重要】問題に場合分け（(i), (ii)など）がある場合、全ての場合分けの最後の結論に至るまで、すべての計算プロセスを省略せずに完全に抽出しきってください。途中でサボることは固く禁じます。
                2. 命題（proposition）ノード:
                   - 答案に書かれている数式や条件のみを正確に抽出してください。
                3. 推論（inference）と定理（theorem）の分離:
                   - 推論ノードはシンプルに保ち、使用された公式や定理は必ず独立した「定理ノード（type: "theorem"）」として作成し、推論ノードからエッジを繋いでください。
                4. 推論ノードの検証ステータス:
                   - ノードの種類が「推論（inference）」である場合のみ、必ず "verification_status": "検証前" というプロパティを追加してください。
                5. 出力キーの制限（【絶対遵守】）:
                   - あなたは指定されたJSONスキーマ以外のキー（例: "new_theorems"）を出力することをシステムレベルで固く禁じられています。
                   - "graph" の中には必ず "nodes" と "edges" の両方を記述してください。"nodes" だけを出力して満足してはいけません。必ずノード間の繋がりを "edges" に全て記述してから出力を終えてください。"edges"配列が空のまま終了することは許可されません。

                [出力フォーマット（厳守）]
                - 以下のJSONフォーマットに厳密に従ってください。
                
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
        responseSchema: {
          type: 'OBJECT',
          properties: {
            graph: {
              type: 'OBJECT',
              properties: {
                nodes: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      id: { type: 'STRING' },
                      type: { type: 'STRING' },
                      label: { type: 'STRING' },
                      verification_status: { type: 'STRING' }
                    },
                    required: ['id', 'type', 'label']
                  }
                },
                edges: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      from: { type: 'STRING' },
                      to: { type: 'STRING' }
                    },
                    required: ['from', 'to']
                  }
                }
              },
              required: ['nodes', 'edges']
            },
            construction_process: {
              type: 'ARRAY',
              items: { type: 'STRING' }
            }
          },
          required: ['graph']
        },
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