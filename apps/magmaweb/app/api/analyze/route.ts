import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { supabase } from '../../../lib/supabase'
import theorems from '../../../lib/constants/theorems.json';

// ★ Next.js のAPIタイムアウト制限を60秒に延長
export const maxDuration = 60;
const PROMPT_VERSION = "1.26.0";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })

async function generateWithRetry(params: any, maxRetries = 3, initialDelayMs = 2000) {
  let delay = initialDelayMs;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const isOverloaded = err?.status === 503 || errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE') || errMsg.includes('503');
      
      if (isOverloaded && attempt < maxRetries) {
        console.warn(`[Gemini API Overloaded] サーバー混雑のため自動リトライします (${attempt}/${maxRetries}). ${delay}ms後に再試行...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      } else {
        throw err;
      }
    }
  }
}

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
  const allKnownTheorems = new Set<string>();

  try {
    if (data?.theorems?.rule_groups) {
      data.theorems.rule_groups.flatMap((g: any) => g.rules || []).forEach((r: any) => allKnownTheorems.add(r.name));
    } else if (Array.isArray(data)) {
      data.forEach((r: any) => allKnownTheorems.add(r.name));
    }
    theoremListString = Array.from(allKnownTheorems).map(name => `- ${name}`).join('\n');
  } catch (err) {
    console.error("定理データの展開に失敗しました", err);
  }

  try {
    const imageRes = await fetch(answer.image_url)
    const arrayBuffer = await imageRes.arrayBuffer()
    const base64Image = Buffer.from(arrayBuffer).toString('base64')

    const response = await generateWithRetry({
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

[目的 (Purpose)]
入力された数学の答案画像を解析し、生徒の思考プロセスを「命題」「推論」「定理」からなる有向グラフとして抽出します。

[制約事項 (Rules)]
1. グラフの基本構造と完走の義務:
   - メインのフローは必ず「命題」→「推論」→「命題」と交互に配置してください。
   - 途中で抽出を打ち切ることは絶対に許されません。
2. 定理の選択と再利用（超厳守事項）:
   - すべての推論（inference）ノードには、必ず1つの定理（theorem）ノードを「定理から推論へ」の向きで接続してください。
   - 【重要】定理の \`label\` を決める際は、必ず末尾の [利用可能な定理ライブラリ] の一覧を熟読し、その中から最も意味が近いものを一つ選び、**一言一句違わず全く同じ名前**を使用してください。
   - ライブラリに「移項のルール」などがあるのに、「等式の移項」のような似た名前を勝手に新設することは**固く禁じます**。
   - ライブラリを隅々まで探し、それでもどうしても該当する定理が存在しない場合のみ、最終手段として新しい名前をつけて自作してください。
3. 推論ノードのラベルの調整:
   - 細かすぎる長文解説にせず、**「右辺の項を左辺に移項する」「両辺に (x-2) を掛けて整理する」**のように、何をどう変形したのかが式レベルで一目で分かる程度に簡潔に書いてください。
4. 複数の命題の組み合わせ:
   - 2つの命題を組み合わせる推論の場合、「2つの命題ノード」と「1つの定理ノード」の合計3つから、1つの推論ノードへエッジを向けてください。
5. 推論ノードの検証ステータス:
   - ノードの種類が「推論（inference）」である場合のみ、必ず "verification_status": "検証前" を追加してください。
6. 【新規定理の詳細定義】:
   - ライブラリに存在せず、やむを得ず独自の定理を生成した場合は、必ず "new_theorems_details" にその詳細な構造（AST定義）を出力してください。
   - スキーマエラーを防ぐため、"before", "after", "symbols" は**必ずJSON文字列表現（Stringified JSON）**として出力してください。

[出力形式 (Format)]
{
  "graph": {
    "nodes": [ ... ],
    "edges": [ ... ]
  },
  "construction_process": [ ... ],
  "new_theorems_details": [
    {
      "id": "rule_auto_generated_1",
      "name": "合成関数の微分",
      "level": ["high"],
      "before": "[\"Derivative\", [\"f\", [\"g\", \"x\"]], \"x\"]",
      "after": "[\"Multiply\", [\"Evaluate\", [\"Derivative\", [\"f\", \"u\"], \"u\"], [\"Equal\", \"u\", [\"g\", \"x\"]]], [\"Derivative\", [\"g\", \"x\"], \"x\"]]",
      "symbols": "{\"f\": \"外の関数\", \"g\": \"中の関数\", \"x\": \"変数\", \"u\": \"置換変数\"}"
    }
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
            },
            new_theorems_details: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  id: { type: 'STRING' },
                  name: { type: 'STRING' },
                  level: {
                    type: 'ARRAY',
                    items: { type: 'STRING' }
                  },
                  before: { type: 'STRING' },
                  after: { type: 'STRING' },
                  symbols: { type: 'STRING' }
                }
              }
            }
          },
          required: ['graph']
        },
        temperature: 0.0,
        maxOutputTokens: 16384
      }
    });

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

    const newlyDiscoveredTheorems: any[] = []; // 手動追加用の新規定理リスト（詳細付き）

    // 1. AIが作成した新規定理の詳細（new_theorems_details）をオブジェクトにパースしてリスト化
    if (parsedData && Array.isArray(parsedData.new_theorems_details)) {
      parsedData.new_theorems_details.forEach((t: any) => {
        if (!t.name || allKnownTheorems.has(t.name)) return; // 既存のものは除外
        try {
          newlyDiscoveredTheorems.push({
            id: t.id || `rule_auto_${Date.now()}`,
            name: t.name,
            level: t.level || ["high"],
            before: t.before ? JSON.parse(t.before) : [],
            after: t.after ? JSON.parse(t.after) : [],
            symbols: t.symbols ? JSON.parse(t.symbols) : {}
          });
          allKnownTheorems.add(t.name); // 重複防止
        } catch (e) {
          console.warn(`[Warning] 新規定理 ${t.name} のASTパースに失敗しました`, e);
          newlyDiscoveredTheorems.push(t);
        }
      });
    }

    if (parsedData && parsedData.graph && Array.isArray(parsedData.graph.nodes) && Array.isArray(parsedData.graph.edges)) {
      let nodes = parsedData.graph.nodes;
      const edges = parsedData.graph.edges;
      let autoTheoremCount = 1;

      nodes.forEach((node: any) => {
        // AIが生成した定理ノードをチェックし、知らないものなら [新規定理] を付与する
        if (node.type === 'theorem') {
          const cleanName = (node.label || '').replace(/^\[自動生成\]\s*/, '').trim();
          
          if (cleanName && !Array.from(allKnownTheorems).includes(cleanName) && !newlyDiscoveredTheorems.some(t => t.name === cleanName)) {
            node.label = `[新規定理] ${cleanName}`; 
            
            newlyDiscoveredTheorems.push({
              id: `rule_auto_${Date.now()}_${autoTheoremCount}`,
              name: cleanName,
              level: ["high"],
              before: [],
              after: [],
              symbols: {},
              note: "AIが詳細構造の出力をスキップしました"
            });
            allKnownTheorems.add(cleanName); 
          } else if (newlyDiscoveredTheorems.some(t => t.name === cleanName)) {
             node.label = `[新規定理] ${cleanName}`; 
          }
        }
        
        // 推論ノードに定理が繋がっていない場合の強制補完処理
        if (node.type === 'inference') {
          const hasTheorem = edges.some((e: any) => {
            if (e.to === node.id) {
              const fromNode = nodes.find((n: any) => n.id === e.from);
              return fromNode && fromNode.type === 'theorem';
            }
            return false;
          });

          if (!hasTheorem) {
            const newTheoremId = `t_auto_${autoTheoremCount++}`;
            const generatedLabel = `[自動生成] ${node.label || '基本変形'}`;
            nodes.push({
              id: newTheoremId,
              type: 'theorem',
              label: generatedLabel
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
      newTheoremsDetails: newlyDiscoveredTheorems,
      metadata: { promptVersion: PROMPT_VERSION, theoremVersion: theoremVersion, cached: false },
      dbSaved: !dbSaveError,
      dbError: dbSaveError ? (dbSaveError.message || String(dbSaveError)) : null
    })

  } catch (err: any) {
    return NextResponse.json({ error: 'APIリクエストで致命的エラーが発生しました', details: err?.message || String(err) }, { status: 500 })
  }
}