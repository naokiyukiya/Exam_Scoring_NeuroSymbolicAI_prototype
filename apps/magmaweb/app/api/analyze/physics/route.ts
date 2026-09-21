import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { supabase } from '../../../../lib/supabase';
import physicsLibrary from '../../../../lib/constants/physics.json';

export const maxDuration = 60;
const PROMPT_VERSION = "2.3.1_strict_binding";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

async function generateWithRetry(params: any, maxRetries = 5, initialDelayMs = 4000) {
  let delay = initialDelayMs;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const isOverloaded = err?.status === 503 || errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE') || errMsg.includes('503') || err?.status === 429 || errMsg.includes('429');
      
      if (isOverloaded && attempt < maxRetries) {
        console.warn(`[Gemini API Overloaded] リトライ (${attempt}/${maxRetries})... ${delay}ms待機`);
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
    if (escape) { escape = false; continue; }
    if (char === '\\') { escape = true; continue; }
    if (char === '"') { inString = !inString; continue; }
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

  const { data: answer, error: answerError } = await supabase
    .from('posts')
    .select('id, image_url, parent_id')
    .eq('id', answerId)
    .single();

  if (answerError || !answer?.image_url) {
    return NextResponse.json({ error: '答案画像URLを取得できませんでした' }, { status: 404 });
  }

  let problemImageUrl = answer.image_url;
  if (answer.parent_id) {
    const { data: problem } = await supabase
      .from('posts')
      .select('image_url')
      .eq('id', answer.parent_id)
      .maybeSingle();

    if (problem?.image_url) {
      problemImageUrl = problem.image_url;
    }
  }

  const physicsData: any = physicsLibrary;
  const theoremVersion = physicsData?.version || "2.3.1";

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

  let theoremListString = "";
  try {
    if (Array.isArray(physicsData?.theorems)) {
      theoremListString = physicsData.theorems
        .map((t: any) => {
          const inputsStr = JSON.stringify(t.inputs || {});
          const outputsStr = JSON.stringify(t.outputs || {});
          return `- ID: [${t.id}] | Name: "${t.name}"\n  Inputs: ${inputsStr}\n  Outputs: ${outputsStr}`;
        })
        .join('\n\n');
    }
  } catch (err) {
    console.error("物理ライブラリデータの展開に失敗しました", err);
  }

  try {
    const [problemRes, answerRes] = await Promise.all([
      fetch(problemImageUrl),
      fetch(answer.image_url)
    ]);

    const [problemBuffer, answerBuffer] = await Promise.all([
      problemRes.arrayBuffer(),
      answerRes.arrayBuffer()
    ]);

    const problemBase64 = Buffer.from(problemBuffer).toString('base64');
    const answerBase64 = Buffer.from(answerBuffer).toString('base64');

    const promptText = `
[役割 (Persona)]
あなたは高校物理の論理構造および解法プロセスの自動検証を行う厳格な物理AIエンジンです。

[目的 (Purpose)]
【1枚目画像: 問題文】の設定前提と、【2枚目画像: 解答答案】に実際に書かれている記述ステップを正確に抽出し、有向グラフ（DAG）を作成してください。

[最重要制約ルール (Strict Rules)]
1. **【答案への完全忠実原則（ハルシネーションの絶対禁止）】**:
   - 生徒が答案に書いていない思考ステップや数式（例: 運動方程式 Ma=F など）を勝手に補完・捏造してノードに組み込まないでください。
   - 生徒が「合力 F = -Kx」から直ちに単振動と同定した場合は、「合力からの復元力定数の特定」を使用し、運動方程式のノードを作らないでください。
2. **【Inputs / Outputs の必須バインディング】**:
   - 推論ノード（type: "inference"）における \`inputs_used\` と \`outputs_derived\` は**絶対に使用・出力**してください。決して空のオブジェクト \`{}\` や \`null\` にしないでください。
   - 定理の適用に使用された変数・前提式を \`inputs_used\` に、その結果導出された式・物理量を \`outputs_derived\` に必ずキーと値のペアで格納してください。
3. **【座標軸・正の向きの一貫性】**:
   - 問題文および答案で定義された座標軸・正の向き（例: 鉛直下向き正、右向き正）に従い、符号（+ / -）の矛盾が生じないように数式を記述してください。
4. **【定理ラベルの一致】**:
   - 推論ノードに接続する \`theorem\` ノードの label は、必ず [利用可能な構造化定理ライブラリ] の Name と一字一句違わず一致させてください。
5. **【全記述の日本語指定】**:
   - label および construction_process はすべて日本語で記述してください。
   
[SymPy 互換数式フォーマットの厳格適用]
1. inputs_used および outputs_derived 内の数式は、SymPy の sympy.sympify() や parse_expr() で直接パース可能な記法を用いてください。
   - 掛け算記号 '*' を省略しないこと (例: '2*H', 'm*g', 'S*g', '1*(2/3*H + x)*S*g')
   - べき乗は '**' を使用すること (例: 'x**2', '(1/2)')
   - ギリシャ文字は英字表記にすること (例: 'rho', 'pi', 'omega', 'theta')
   - 平方根は 'sqrt(...)' を使用すること (例: '2*pi*sqrt((2*H)/(3*g))')
   - 等式関係は 'E1 == E2' または 'variable = expression' の形式で書くこと

[出力形式 (Format Example)]
{
  "graph": {
    "nodes": [
      { "id": "p1", "label": "変位 x での水没体積 V' = ((2/3)*H + x)*S", "type": "proposition" },
      { "id": "t1", "label": "アルキメデスの原理（浮力）", "type": "theorem" },
      {
        "id": "i1",
        "label": "変位 x での浮力 F' を計算する",
        "type": "inference",
        "inputs_used": { "fluid_density": "1", "submerged_volume": "((2/3)*H + x)*S", "gravity_acc": "g" },
        "outputs_derived": { "buoyant_force": "F' = 1 * ((2/3)*H + x)*S * g" }
      },
      { "id": "p2", "label": "浮力 F' = 1 * ((2/3)*H + x)*S * g", "type": "proposition" }
    ],
    "edges": [
      { "from": "p1", "to": "i1" },
      { "from": "t1", "to": "i1" },
      { "from": "i1", "to": "p2" }
    ]
  },
  "construction_process": [
    "Step 1: 変位 x における水没体積 V' を求める。",
    "Step 2: アルキメデスの原理より浮力 F' を導出する。"
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
            { text: "【1枚目画像: 問題文】" },
            { inlineData: { mimeType: 'image/jpeg', data: problemBase64 } },
            { text: "【2枚目画像: 解答答案】" },
            { inlineData: { mimeType: 'image/jpeg', data: answerBase64 } },
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
                      type: { 
                        type: 'STRING',
                        description: 'ノード種別: "proposition", "theorem", "inference" のいずれか'
                      },
                      label: { type: 'STRING' },
                      inputs_used: { 
                        type: 'OBJECT',
                        description: '【inferenceノードで必須】定理に代入された実際の変数や数式（例: {"mass": "M", "gravity": "g"}）。空にしてはいけません。'
                      },
                      outputs_derived: { 
                        type: 'OBJECT',
                        description: '【inferenceノードで必須】推論によって導かれた式や物理量（例: {"buoyant_force": "F = rho*V*g"}）。空にしてはいけません。'
                      }
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
          required: ['graph', 'construction_process']
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

    // 浮いている推論ノードへのセーフティ補填
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