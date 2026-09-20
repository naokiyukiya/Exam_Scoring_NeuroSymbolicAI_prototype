import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { supabase } from '../../../lib/supabase';
import physicsLibrary from './physics.json';

// タイムアウトとプロンプトバージョン設定
export const maxDuration = 60;
const PROMPT_VERSION = "2.2.0_physics";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// 混雑・制限対策のリトライヘルパー関数
async function generateWithRetry(params: any, maxRetries = 5, initialDelayMs = 4000) {
  let delay = initialDelayMs;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const isOverloaded = err?.status === 503 || errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE') || errMsg.includes('503') || err?.status === 429 || errMsg.includes('429');
      
      if (isOverloaded && attempt < maxRetries) {
        console.warn(`[Gemini API Overloaded] サーバー混雑または制限のため自動リトライします (${attempt}/${maxRetries}). ${delay}ms後に再試行...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      } else {
        throw err;
      }
    }
  }
}

// 途中で途切れたJSONを復元するリカバリー関数
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
  const { searchParams } = new URL(request.url);
  const answerId = searchParams.get('answerId');

  if (!answerId) return NextResponse.json({ error: 'Missing answerId' }, { status: 400 });

  const { data: answer, error } = await supabase.from('posts').select('image_url').eq('id', answerId).single();

  if (error || !answer?.image_url) {
    return NextResponse.json({ error: '画像URLを取得できませんでした' }, { status: 404 });
  }

  const physicsData: any = physicsLibrary;
  const theoremVersion = physicsData?.version || "2.2.0";

  // キャッシュチェック
  const { data: existingGraph } = await supabase
    .from('logic_graphs')
    .select('graph_data, construction_process, prompt_version, theorem_version')
    .eq('post_id', answerId)
    .maybeSingle();

  if (existingGraph && existingGraph.prompt_version === PROMPT_VERSION) {
    return NextResponse.json({
      imageUrl: answer.image_url,
      graph: existingGraph.graph_data,
      constructionProcess: existingGraph.construction_process,
      metadata: { promptVersion: existingGraph.prompt_version, theoremVersion: existingGraph.theorem_version, cached: true }
    });
  }

  // 構造化物理ライブラリのテキスト化
  let theoremListString = "";
  try {
    if (Array.isArray(physicsData?.theorems)) {
      theoremListString = physicsData.theorems
        .map((t: any) => {
          const inputsStr = JSON.stringify(t.inputs || {});
          const outputsStr = JSON.stringify(t.outputs || {});
          return `- ID: [${t.id}] | Name: "${t.name}"\n  Type: ${t.type}\n  Inputs(仮定/物理量): ${inputsStr}\n  Outputs(結論/等式/運動分類): ${outputsStr}`;
        })
        .join('\n\n');
    }
  } catch (err) {
    console.error("物理ライブラリデータの展開に失敗しました", err);
  }

  try {
    const imageRes = await fetch(answer.image_url);
    const arrayBuffer = await imageRes.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');

    const promptText = `
[役割 (Persona)]
あなたは、高校物理の論理構造および解法プロセスの自動検証を行うAI物理エンジニアです。

[目的 (Purpose)]
入力された答案・思考ノート画像を解析し、物理法則の【入力（Inputs: 前提・仮定・物理量）】から【出力（Outputs: 成り立つ等式・運動の分類）】への推論フローを有向グラフ（DAG）として抽出してください。

[思考ノードの種類 (Node Types)]
- proposition (命題・状態・式ノード): 物理的な状況設定、定義された座標、立てられた方程式、得られた数値や結論（運動分類含む）。
- inference (物理的推論ノード): 入力前提（inputs）からルールを適用して出力結論（outputs）を導く推論ステップ。
- theorem (物理法則・定理ノード): [利用可能な構造化定理ライブラリ] に定義されている物理ルール。

[制約事項 (Rules)]
0. 【絶対言語指定】: すべての記述（label, construction_process 等）は**必ず日本語**で行ってください。
1. フロー構造と定理の接続:
   - メインのフローは (命題 proposition) -> (推論 inference) -> (命題 proposition) です。
   - すべての推論ノードには、必ず1つの定理ノードを「(定理 theorem) -> (推論 inference)」の向きで接続してください。
   - 【厳守】定理の label には、必ず末尾の [利用可能な構造化定理ライブラリ] の Name と全く同じ文字列を一言一句違わず使用してください。
2. 入出力（Inputs/Outputs）のバインディング記録:
   - 推論ノード（inference）を作成する際は、適用した定理の Inputs / Outputs に従い、どのような物理量や方程式を代入・導出したかを \`inputs_used\` と \`outputs_derived\` に記録してください。
3. 明示的抽象化:
   - 単なる代数計算だけでなく、「ma = -Kx」などの式から「この運動は単振動である」と判定する運動同定ステップ（Outputs）を必ず抽出してください。

[出力形式 (Format)]
{
  "graph": {
    "nodes": [
      { "id": "p1", "label": "質量 m の物体に力 F がはたらく", "type": "proposition" },
      { "id": "t1", "label": "運動方程式", "type": "theorem" },
      {
        "id": "i1",
        "label": "運動方程式 ma = F を立式する",
        "type": "inference",
        "inputs_used": { "mass": "m", "force": "F" },
        "outputs_derived": { "equation": "m*a = F" }
      },
      { "id": "p2", "label": "m*a = F", "type": "proposition" }
    ],
    "edges": [
      { "from": "p1", "to": "i1" },
      { "from": "t1", "to": "i1" },
      { "from": "i1", "to": "p2" }
    ]
  },
  "construction_process": [
    "Step 1: 注目物体の質量 m とはたらく力 F を確認。",
    "Step 2: 運動方程式を適用し、m*a = F を立式。"
  ]
}

[利用可能な構造化定理ライブラリ]
${theoremListString}
    `.trim();

    const response = await generateWithRetry({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
            { text: promptText }
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
                      inputs_used: { type: 'OBJECT', properties: {} },
                      outputs_derived: { type: 'OBJECT', properties: {} }
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
        temperature: 0.1,
        maxOutputTokens: 16384
      }
    });

    const rawText = response.text || '';
    let parsedData: any = null;

    let cleanText = rawText.trim();
    if (cleanText.startsWith('```json')) cleanText = cleanText.replace(/^```json/, '').replace(/```$/, '').trim();
    else if (cleanText.startsWith('```')) cleanText = cleanText.replace(/^```/, '').replace(/```$/, '').trim();

    try {
      parsedData = JSON.parse(cleanText);
    } catch (parseErr1) {
      try {
        const fixedText = cleanText.replace(/\\/g, '\\\\').replace(/\\\\"|\\\\'|\\\\n/g, (match) => match.substring(2));
        parsedData = JSON.parse(fixedText);
      } catch (parseErr2) {
        try {
          const repairedText = repairTruncatedJson(cleanText);
          parsedData = JSON.parse(repairedText);
        } catch (parseErr3) {
          return NextResponse.json({ error: 'Geminiの出力データがJSONとして不適正です', rawText: rawText });
        }
      }
    }

    // セーフティネット：定理が浮いている推論ノードへの自動補填処理
    if (parsedData && parsedData.graph && Array.isArray(parsedData.graph.nodes) && Array.isArray(parsedData.graph.edges)) {
      let nodes = parsedData.graph.nodes;
      const edges = parsedData.graph.edges;
      let autoTheoremCount = 1;

      nodes.forEach((node: any) => {
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
            nodes.push({
              id: newTheoremId,
              type: 'theorem',
              label: `代数計算・連立方程式の消去`
            });
            edges.push({
              from: newTheoremId,
              to: node.id
            });
          }
        }
      });
    }

    // Supabase 保存処理
    let dbSaveError: any = null;
    if (parsedData && parsedData.graph) {
      try {
        const { data: existing } = await supabase.from('logic_graphs').select('id').eq('post_id', answerId).maybeSingle();
        const payload = {
          graph_data: parsedData.graph,
          construction_process: parsedData.construction_process || [],
          status: 'unverified',
          prompt_version: PROMPT_VERSION,
          theorem_version: theoremVersion,
          updated_at: new Date().toISOString()
        };

        if (existing) {
          const { error } = await supabase.from('logic_graphs').update(payload).eq('id', existing.id);
          if (error) dbSaveError = error;
        } else {
          const { error } = await supabase.from('logic_graphs').insert({ post_id: answerId, ...payload });
          if (error) dbSaveError = error;
        }
      } catch (dbEx) {
        dbSaveError = dbEx;
      }
    }

    return NextResponse.json({
      imageUrl: answer.image_url,
      graph: parsedData.graph,
      constructionProcess: parsedData.construction_process || [],
      metadata: { promptVersion: PROMPT_VERSION, theoremVersion: theoremVersion, cached: false },
      dbSaved: !dbSaveError,
      dbError: dbSaveError ? (dbSaveError.message || String(dbSaveError)) : null
    });

  } catch (err: any) {
    return NextResponse.json({ error: 'APIリクエストで致命的エラーが発生しました', details: err?.message || String(err) }, { status: 500 });
  }
}