import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { supabase } from '../../../lib/supabase'
import theorems from '../../../lib/constants/theorems.json';

// ★ タイムアウトを60秒に延長
export const maxDuration = 60;
// ★ プロンプトバージョン
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
                1. グラフの基本構造:
                   - メインのフローは、必ず「命題」→「推論」→「命題」→「推論」と交互に配置してください。
                2. 定理（theorem）ノードの【完全必須化】と【動的生成の許可】（超重要）:
                   - すべての推論ノードには、必ず1つの定理ノード（type: "theorem"）をエッジで接続してください。
                   - 【重要】提供された「定理ライブラリ」の中に「移項」「同類項をまとめる」「両辺を割る」などの基本的な変形ルールが存在しない場合でも、決して定理ノードを省略してはいけません。
                   - ライブラリにない場合は、AI自身の判断で「移項の性質」「条件の組み合わせ」などの適切な名前をつけて、**必ず新しい定理ノードを自作（動的生成）**してください。
                3. 推論ノードの検証ステータス:
                   - ノードの種類が「推論（inference）」である場合のみ、必ず "verification_status": "検証前" というプロパティを追加してください。

                [出力フォーマット（厳守）]
                - 以下のJSONフォーマットに厳密に従ってください。余分なキー（new_theoremsなど）は追加しないでください。
                
                {
                  "graph": {
                    "nodes": [
                      { "id": "p1", "label": "x - 2 > 0", "type": "proposition" },
                      { "id": "t1", "label": "移項の性質", "type": "theorem" },
                      { "id": "i1", "label": "移項する", "type": "inference", "verification_status": "検証前" },
                      { "id": "p2", "label": "x > 2", "type": "proposition" }
                    ],
                    "edges": [
                      { "from": "p1", "to": "i1" },
                      { "from": "t1", "to": "i1" },
                      { "from": "i1", "to": "p2" }
                    ]
                  },
                  "construction_process": [
                    "Step 1: 命題「x - 2 > 0」を抽出しました。",
                    "Step 2: 移項する推論と定理を接続し、命題「x > 2」を導きました。"
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
          return NextResponse.json({ error: 'Geminiの出力データがJSONとして不適正です', rawText: rawText })
        }
      }
    }

    // =================================================================================
    // ★ 解決策：システム側による定理ノードの「自動補完」機能（セーフティネット）
    // AIが万が一定理ノードを作り忘れても、プログラム側で強制的に生成して接続します。
    // =================================================================================
    if (parsedData && parsedData.graph && Array.isArray(parsedData.graph.nodes) && Array.isArray(parsedData.graph.edges)) {
      const nodes = parsedData.graph.nodes;
      const edges = parsedData.graph.edges;
      let autoTheoremCount = 1;

      nodes.forEach((node: any) => {
        if (node.type === 'inference') {
          // この推論ノードに繋がっている定理ノードが存在するかチェック
          const hasTheorem = edges.some((e: any) => {
            if (e.to === node.id) {
              const fromNode = nodes.find((n: any) => n.id === e.from);
              return fromNode && fromNode.type === 'theorem';
            }
            if (e.from === node.id) {
              const toNode = nodes.find((n: any) => n.id === e.to);
              return toNode && toNode.type === 'theorem';
            }
            return false;
          });

          // 定理ノードがない場合、推論名から自動的に定理ノードを作ってくっつける！
          if (!hasTheorem) {
            const newTheoremId = `t_auto_${autoTheoremCount++}`;
            nodes.push({
              id: newTheoremId,
              type: 'theorem',
              label: `[自動生成] ${node.label || '基本変形'}`
            });
            edges.push({
              from: newTheoremId,
              to: node.id
            });
          }
        }
      });
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
          const { error: updateErr } = await supabase.from('logic_graphs').update(payload).eq('id', existing.id)
          if (updateErr) dbSaveError = updateErr
        } else {
          const { error: insertErr } = await supabase.from('logic_graphs').insert({ post_id: answerId, ...payload })
          if (insertErr) dbSaveError = insertErr
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