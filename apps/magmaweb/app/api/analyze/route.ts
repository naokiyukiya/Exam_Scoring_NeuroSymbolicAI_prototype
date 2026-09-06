import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { supabase } from '../../../lib/supabase'
import theorems from '../../../lib/constants/theorems.json';

// ★ プロンプトのバージョン（プロンプト改修時にここをインクリメント）
const PROMPT_VERSION = "1.3.0";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })

/**
 * 途中で切れたJSON文字列のカッコを自動補完するヘルパー関数
 */
function repairTruncatedJson(jsonStr: string): string {
  let cleaned = jsonStr.trim();
  
  let inString = false;
  let escape = false;
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
    }
  }
  if (inString) {
    cleaned += '"';
  }

  cleaned = cleaned.replace(/[,:\s]+$/, '');

  const stack: string[] = [];
  inString = false;
  escape = false;

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
    console.error("定理データの展開に失敗しましたが、空のまま続行します", err);
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
                入力された数学の答案画像を解析し、生徒の思考プロセスを「命題（数式や条件）」と「推論（変形ルールや適用した定理）」からなる有向グラフとして最小ステップで抽出します。指定されたJSONフォーマットのみで出力し、併せてグラフを構築したステップごとの思考プロセスも出力してください。

                [抽出ルール]
                1. グラフの基本構造（【絶対遵守】厳密な交互配置と終端）:
                   - メインの論理フローは、必ず「命題」→「推論」→「命題」→「推論」と交互に配置し、グラフの最後のノードは必ず「命題（proposition）」で終了してください。推論ノードや定理ノードでグラフを終わらせることは絶対に禁止します。
                   - 命題ノード同士、または推論ノード同士が直接繋がることは絶対に禁止します。
                2. 命題（proposition）ノード:
                   - 答案に書かれている数式、条件、結論のみを正確に抽出してください。勝手な推測や書かれていない内容を補足してはいけません。
                   - ルート、大なりイコールなどはLaTeXコマンドを使わず、「√」「≧」「≦」「≠」「±」などの環境依存しない文字記号を直接使用してください。
                3. 定理（theorem）ノードの抽出と接続ルール（【絶対遵守】）:
                   - **Σ（シグマ）記号を使った和の計算や等差・等比数列の公式変形が含まれている場合、必ず「自然数の和の公式」や「等差数列の和の公式」などの正しい定理ノード（type: "theorem"）を生成し、対応する推論ノードに 'edges' で確実に接続してください。** 単なる「代入」や「約分」でごまかさず、公式の適用を正確に反映させてください。
                   - 答案で使用された定理は必ずノードとして作成し、必ず対応する「推論ノード」または「命題ノード」から 'edges' で矢印を繋いでください。画面の左側に定理ノードが孤立して残るような中途半端な出力は絶対に避けてください。
                4. 推論ノードの検証ステータスと数式データの付与（【絶対遵守】）:
                   - ノードの種類が「推論（inference）」である場合、必ず以下のプロパティをすべて含めてください：
                     - "verification_status": 必ず「検証前」にしてください。
                     - "theorem": 適用した定理の "before" と "after"
                     - "input_expression": 変形する前の入力式（文字列）
                     - "output_expression": 変形した後の出力式（文字列）
                   - 命題や定義・定理ノードにはこれらを追加しないでください。

                [出力フォーマット（厳守）]
                - 以下のJSONスキーマに厳密に従って出力してください。
                - 挨拶、説明、Markdownのコードブロックなどの余分なテキストは一切含めず、パース可能な生のJSON文字列のみを返してください。
                
                {
                  "graph": {
                    "nodes": [
                      { "id": "p1", "label": "x - 2 > 0", "type": "proposition" },
                      { 
                        "id": "i1", 
                        "label": "分配法則（展開）を適用する", 
                        "type": "inference", 
                        "theorem": { "before": "P * (Q + R)", "after": "P * Q + P * R" },
                        "input_expression": "3 * (x + 2)",
                        "output_expression": "3 * x + 6",
                        "verification_status": "検証前" 
                      },
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