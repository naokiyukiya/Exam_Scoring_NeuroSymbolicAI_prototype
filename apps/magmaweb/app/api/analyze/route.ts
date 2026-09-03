import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { supabase } from '../../../lib/supabase'
import theorems from '../../../lib/constants/theorems.json';

// ★ プロンプトのバージョン（プロンプト改修時にここをインクリメント）
const PROMPT_VERSION = "1.0.0";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })

/**
 * 途中で切れたJSON文字列のカッコを自動補完するヘルパー関数
 */
function repairTruncatedJson(jsonStr: string): string {
  let cleaned = jsonStr.trim();
  
  // 文字列リテラルの途中で切れている場合のレスキュー
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

  // カンマやコロンで終わっている場合は削除
  cleaned = cleaned.replace(/[,:\s]+$/, '');

  // スタックを使って閉じられていない括弧を補完
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

  // ★ theorems.json からバージョンを取得（存在しない場合のフォールバック付き）
  const data: any = theorems;
  const theoremVersion = data?.version || "unknown";

  // キャッシュチェック（すでに存在する場合はGeminiを叩かず返却）
  const { data: existingGraph } = await supabase
    .from('logic_graphs')
    .select('graph_data, construction_process, prompt_version, theorem_version')
    .eq('post_id', answerId)
    .maybeSingle()

  if (existingGraph) {
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
                1. グラフの基本構造（【絶対遵守】厳密な交互配置）:
                   - メインの論理フローは、必ず「命題」→「推論」→「命題」→「推論」と厳密に交互に繋がるように配置してください。
                   - 【重要】命題ノード同士、または推論ノード同士が直接繋がることは絶対に禁止します。答案上で数式が連続して書かれている場合でも、必ずその間に「[推測] 式を整理する」「[推測] 次の条件を考慮する」などの推論ノードを補完して挟んでください。
                2. 命題（proposition）ノード:
                   - 答案に書かれている数式、条件、結論のみを正確に抽出してください。
                   - ルート、大なりイコールなどはLaTeXコマンドを使わず、「√」「≧」「≦」「≠」「±」などの環境依存しない文字記号を直接使用してください。
                3. 推論（inference）ノードと定義・定理（theorem）ノードの接続ルール（基本と特例）:
                   - 【基本原則】定義・定理ノード（type: "theorem"）は、原則としてそれを適用した「推論ノード」から枝分かれさせて接続してください。
                   - 【特例ルール（命題からの直接接続）】もし推論ノードの内容（例：「右辺の式を簡略化する」等）が公式変換に直接関係ない場合でも、命題の数式内に「Σ（シグマ）」などの重要な定義・定理が含まれており、解説として必要な場合は、特例として【命題ノードから直接、定義・定理ノードへエッジを繋ぐ】ことを強く推奨します。推論に紐づけられないからといって、重要な定義・定理の抽出を絶対に省略しないでください。
                   - 【絶対遵守】同じ定理が複数回使われた場合は、毎回新しい定理ノードを作成し、末尾に「(2回目の利用)」と記載してください。
                   - 【見落とし厳禁の自己チェック機構】: 抽出処理の最後に、画像内のすべての数式を必ず再確認（ダブルチェック）してください。「Σ（シグマ）の公式」「二次方程式の解の公式」「展開・因数分解の公式」などの重要な定義・定理の「抽出漏れ」が絶対に起きないように網羅してください。
                4. 複数の式の合流（連立方程式など）の扱い:
                   - 複数の命題（数式）を組みまして新しい命題を導いている場合、それらの複数の「命題ノード」から、1つの「推論ノード」に向かってエッジを繋げてください。
                5. グラフや表の除外:
                   - 関数グラフ、幾何的な図形、増減表などは解析の対象外とします。
                6. 忠実性の原則:
                   - 誤った数式はそのまま「命題」ノードとして抽出してください。
                7. 推論ノードの検証ステータス（【絶対遵守】）:
                   - ノードの種類が「推論（inference）」である場合のみ、必ず "verification_status" というプロパティを追加し、値を必ず「検証前」にしてください。「検証済み」と出力することは固く禁じます。命題や定義・定理ノードには絶対に追加しないでください。

                [出力フォーマット（厳守）]
                - 以下のJSONスキーマに厳密に従って出力してください。
                - 挨拶、説明、Markdownのコードブロックなどの余分なテキストは一切含めず、パース可能な生のJSON文字列のみを返してください。
                  
                {
                  "graph": {
                    "nodes": [
                      { "id": "p1", "label": "x = 1 - √5", "type": "proposition" },
                      { "id": "p2", "label": "y = 2", "type": "proposition" },
                      { "id": "i1", "label": "xとyの値を式に代入する", "type": "inference", "verification_status": "検証前" },
                      { "id": "p3", "label": "x + y = 3 - √5", "type": "proposition" },
                      { "id": "p4", "label": "S = Σ_{k=1}^{n} k", "type": "proposition" },
                      { "id": "t1", "label": "総和記号(Σ)の定義: 数列の和を簡易的に表す記号", "type": "theorem" },
                      { "id": "i2", "label": "[推測] 自然数の和の公式を利用し、右辺の式を簡略化して展開する", "type": "inference", "applied_theorem": "自然数の和の公式", "verification_status": "検証前" },
                      { "id": "t2", "label": "自然数の和の公式: Σ_{k=1}^{n} k = n(n+1)/2", "type": "theorem" },
                      { "id": "p5", "label": "S = n(n+1)/2", "type": "proposition" }
                    ],
                    "edges": [
                      { "from": "p1", "to": "i1" },
                      { "from": "p2", "to": "i1" },
                      { "from": "i1", "to": "p3" },
                      { "from": "p4", "to": "t1" }, 
                      { "from": "p4", "to": "i2" },
                      { "from": "i2", "to": "t2" },
                      { "from": "i2", "to": "p5" }
                    ]
                  },
                  "construction_process": [
                    "Step 1: 命題「x = 1 - √5」と「y = 2」を抽出しました。",
                    "Step 2: それらを式に代入する推論を追加し、命題「x + y = 3 - √5」を導きました。"
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

    // 文字列クレンジング
    let cleanText = rawText.trim()
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json/, '').replace(/```$/, '').trim()
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```/, '').replace(/```$/, '').trim()
    }

    // 段階的にパースを試行
    try {
      parsedData = JSON.parse(cleanText)
    } catch (parseErr1) {
      try {
        // エスケープ処理の試行
        const fixedText = cleanText.replace(/\\/g, '\\\\').replace(/\\\\"|\\\\'|\\\\n/g, (match) => match.substring(2))
        parsedData = JSON.parse(fixedText)
      } catch (parseErr2) {
        try {
          // 途中切れJSONの自動補完・修復試行
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

    // ★ Supabase への保存処理（UPDATE/INSERT に明示分岐 & バージョン情報を追加）
    let dbSaveError: any = null
    if (parsedData && parsedData.graph) {
      try {
        // 1. 既存のレコードがあるか探す
        const { data: existing } = await supabase
          .from('logic_graphs')
          .select('id')
          .eq('post_id', answerId)
          .maybeSingle()

        const payload = {
          graph_data: parsedData.graph,
          construction_process: parsedData.construction_process || [],
          status: 'unverified',
          prompt_version: PROMPT_VERSION,       // ★ プロンプトバージョン
          theorem_version: theoremVersion,      // ★ theorems.jsonのバージョン
          updated_at: new Date().toISOString()
        };

        if (existing) {
          // 既存があれば UPDATE
          const { error: updateErr } = await supabase
            .from('logic_graphs')
            .update(payload)
            .eq('id', existing.id)

          if (updateErr) {
            console.error('logic_graphs Update Error:', updateErr)
            dbSaveError = updateErr
          }
        } else {
          // 既存がなければ INSERT
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