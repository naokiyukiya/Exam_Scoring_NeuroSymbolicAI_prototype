import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { supabase } from '../../../lib/supabase'
import theorems from '../../../lib/constants/theorems.json';

// ★ タイムアウトを60秒に延長
export const maxDuration = 60;
const PROMPT_VERSION = "1.14.0";
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
      escape = false; continue;
    }
    if (char === '\\') {
      escape = true; continue;
    }
    if (char === '"') {
      inString = !inString; continue;
    }
    if (!inString) {
      if (char === '{' || char === '[') stack.push(char);
      else if (char === '}') {
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

  if (!answerId) return NextResponse.json({ error: 'Missing answerId' }, { status: 400 })

  const { data: answer, error } = await supabase.from('posts').select('image_url').eq('id', answerId).single()

  if (error || !answer?.image_url) {
    return NextResponse.json({ error: '画像URLを取得できませんでした' }, { status: 404 })
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
      metadata: { promptVersion: existingGraph.prompt_version, theoremVersion: existingGraph.theorem_version, cached: true }
    })
  }

  let theoremListString = "";
  try {
    if (data?.theorems?.rule_groups) {
      theoremListString = data.theorems.rule_groups.flatMap((g: any) => g.rules || []).map((r: any) => `- ${r.name}`).join('\n');
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
[役割 (Persona)]
あなたは、数学の論理構造解析に精通したAIアシスタントです。

[背景 (Context)]
生徒の数学の解答プロセスを読み取り、命題（proposition）、推論（inference）、定理（theorem）の3要素を用いた有向グラフ（JSONフォーマット）に変換するタスクを行っています。後続のシステムで正確な自動検証を行うためには、すべての推論ノードに対して、「1つ以上の変形前の命題」と「適用した定理」の入力エッジが必ず揃っている必要があります。

[メインタスク (Task)]
提供された解答画像を解析し、指定されたフォーマットのJSONを出力してください。すべての \`inference\`（推論ノード）に対して、必ず1つの \`theorem\`（定理ノード）と、文脈に応じた1つ以上の \`proposition\`（命題ノード）を入力として接続してください。

[制約事項]
1. 定理ノードの完全必須化: 「同類項をまとめる」「移項する」「分配法則」などのいかなる些細な式変形であっても、必ず対応する \`theorem\` ノードを生成し、\`edges\` で \`inference\` ノードに接続してください。定理ノードが接続されていない推論ノードの出力は固く禁じます。
2. 汎用定理の自己生成: 事前定義された定理が思いつかない場合でも、AI自身の判断で「移項のルール」「条件の組み合わせ」といった適切なラベルを持つ \`theorem\` ノードを作成して付与してください。
3. エッジの接続ルール（複数の命題入力への対応）: 1つの \`inference\` ノードには、必ず「1つ以上の変形元の proposition」と「適用する 1つの theorem」からエッジ（from）が向かうようにJSONを構成してください。2つの命題を組み合わせる推論の場合、命題2つと定理1つの合計3つのノードから推論ノードへエッジを繋いでください。
4. 推論ノードの検証ステータス: ノードの種類が「推論（inference）」である場合のみ、必ず "verification_status": "検証前" というプロパティを追加してください。
5. 出力キーの制限: 指定されたJSONスキーマ以外のキーを出力しないでください。途中で出力をサボらず、必ず最後まで抽出しきってください。

[出力形式 (Format)]
- 以下のJSONフォーマットに厳密に従ってください。JSON以外の説明文やマークダウン記法は一切含めないでください。

{
  "graph": {
    "nodes": [
      { "id": "p1", "label": "x > 2", "type": "proposition" },
      { "id": "p2", "label": "x <= 5", "type": "proposition" },
      { "id": "t1", "label": "複数の条件を組み合わせる", "type": "theorem" },
      { "id": "i1", "label": "命題p1とp2の条件を組み合わせる", "type": "inference", "verification_status": "検証前" },
      { "id": "p3", "label": "2 < x <= 5", "type": "proposition" }
    ],
    "edges": [
      { "from": "p1", "to": "i1" },
      { "from": "p2", "to": "i1" },
      { "from": "t1", "to": "i1" },
      { "from": "i1", "to": "p3" }
    ]
  },
  "construction_process": [
    "Step 1: 命題「x > 2」と「x <= 5」を抽出しました。",
    "Step 2: 複数の条件を組み合わせる推論と定理を接続し、命題「2 < x <= 5」を導きました。"
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
    if (cleanText.startsWith('```json')) cleanText = cleanText.replace(/^```json/, '').replace(/```$/, '').trim()
    else if (cleanText.startsWith('```')) cleanText = cleanText.replace(/^```/, '').replace(/```$/, '').trim()

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
          return NextResponse.json({ error: 'Geminiの出力データがJSONとして不適正です', rawText: rawText })
        }
      }
    }

    let dbSaveError: any = null
    if (parsedData && parsedData.graph) {
      try {
        const { data: existing } = await supabase.from('logic_graphs').select('id').eq('post_id', answerId).maybeSingle()
        const payload = {
          graph_data: parsedData.graph,
          construction_process: parsedData.construction_process || [],
          status: 'unverified',
          prompt_version: PROMPT_VERSION,       
          theorem_version: theoremVersion,      
          updated_at: new Date().toISOString()
        };

        if (existing) {
          const { error } = await supabase.from('logic_graphs').update(payload).eq('id', existing.id)
          if (error) dbSaveError = error
        } else {
          const { error } = await supabase.from('logic_graphs').insert({ post_id: answerId, ...payload })
          if (error) dbSaveError = error
        }
      } catch (dbEx) {
        dbSaveError = dbEx
      }
    }

    return NextResponse.json({ 
      imageUrl: answer.image_url, 
      graph: parsedData.graph, 
      constructionProcess: parsedData.construction_process || [],
      metadata: { promptVersion: PROMPT_VERSION, theoremVersion: theoremVersion, cached: false },
      dbSaved: !dbSaveError,
      dbError: dbSaveError ? (dbSaveError.message || String(dbSaveError)) : null
    })

  } catch (err: any) {
    return NextResponse.json({ error: 'APIリクエストで致命的エラーが発生しました', details: err?.message || String(err) }, { status: 500 })
  }
}