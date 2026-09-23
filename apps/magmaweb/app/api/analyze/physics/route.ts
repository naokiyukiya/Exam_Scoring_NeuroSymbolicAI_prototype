import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { supabase } from '../../../../lib/supabase';
import physicsLibrary from '../../../../lib/constants/physics.json';

export const maxDuration = 60;

const physicsData: any = physicsLibrary;
const theoremVersion = physicsData?.version || "2.4.2";
// 出力例を追加した新しいプロンプトバージョン
const PROMPT_VERSION = `${theoremVersion}_with_fewshot_v5`;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
 
async function generateWithRetry(params: any, maxRetries = 5, initialDelayMs = 2000) {
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

  if (!answerId) {
    return NextResponse.json({ error: 'Missing answerId' }, { status: 400 });
  }

  try {
    const { data: answer, error: answerError } = await supabase
      .from('posts')
      .select('id, image_url, parent_id')
      .eq('id', answerId)
      .single();

    if (answerError || !answer?.image_url) {
      console.error('[API Error] 答案画像URL取得失敗:', answerError);
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

    // physics.json からの定理整形
    let theoremListString = "";
    try {
      if (Array.isArray(physicsData?.theorems)) {
        theoremListString = physicsData.theorems
          .map((t: any) => {
            const target = t.prompt_data || t;
            const inputsStr = JSON.stringify(target.inputs || {});
            const outputsStr = JSON.stringify(target.outputs || {});
            const varsStr = target.variables ? JSON.stringify(target.variables) : "{}";
            return `- 定理ID: [${t.id}] | 定理名: "${t.name}"\n  変数定義: ${varsStr}\n  入力条件: ${inputsStr}\n  出力結論: ${outputsStr}`;
          })
          .join('\n\n');
      }
    } catch (err) {
      console.error("物理ライブラリデータの展開に失敗しました", err);
    }

    const [problemRes, answerRes] = await Promise.all([
      fetch(problemImageUrl),
      fetch(answer.image_url)
    ]);

    if (!problemRes.ok || !answerRes.ok) {
      console.error('[API Error] 画像のダウンロードに失敗しました', {
        problemStatus: problemRes.status,
        answerStatus: answerRes.status
      });
      return NextResponse.json({
        error: '画像の取得に失敗しました',
        details: `Problem HTTP ${problemRes.status}, Answer HTTP ${answerRes.status}`
      }, { status: 500 });
    }

    const problemMimeType = problemRes.headers.get('content-type') || 'image/jpeg';
    const answerMimeType = answerRes.headers.get('content-type') || 'image/jpeg';

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
【1枚目画像: 問題文】の設定前提と、【2枚目画像: 解答答案】に書かれている物理的思考・計算ステップを極めて詳細に追跡し、答案内のすべての行・計算・法則適用を分解抽出した有向アサイクリックグラフ（DAG）を作成してください。

[最重要原則（1ステップ1ノードの原則）]
1. **【答案の全ステップの微細ノード化（省略の絶対禁止）】**:
   - 答案に書かれている**すべての式・計算の変形・代入・立式・条件設定の行を、スキップせずに1ステップずつ個別の推論ノード（inference）および命題ノード（proposition）として分解**してください。
   - 複数の計算や代入をまとめて1つのノードにスキップしてはいけません。答案の展開順序に忠実に細かくノードを作成してください。

2. **【未記述の補完禁止】**:
   - 生徒が答案に書いていない『未記述の思考ステップ』や『未記述の文字』を勝手に補完・捏造することを禁じます。

3. **【Inputs / Outputs の徹底記録】**:
   - 推論ノード（type: "inference"）を作成する際は、必ずその推論ステップで「使われた式/変数 (inputs_used)」と「新たに得られた式/変数 (outputs_derived)」を明示してください。

4. **【LaTeX表現と小問の一貫性】**:
   - 数式はすべて LaTeX（例: $E = \\frac{1}{2}m v^2$）で記述してください。
   - 小問 (1), (2) などがあっても全体のグラフ（DAG）は1つにつなげ、各ノードに sub_question（例: "(1)", "(2)"）を設定してください。最終答えには is_final_answer: true を付与してください。

5. **【定理ラベルの一致】**:
   - 定理ノード（type: "theorem"）の label は、必ず [利用可能な構造化定理ライブラリ] の「定理名」と一字一句違わず一致させてください。

[出力形式 (Format Example)]
{
  "graph": {
    "nodes": [
      {
        "id": "p1",
        "label": "変位 x での水没体積 V' = ((2/3)*H + x)*S",
        "type": "proposition",
        "sub_question": "(1)",
        "is_final_answer": false
      },
      {
        "id": "t1",
        "label": "アルキメデスの原理（浮力）",
        "type": "theorem",
        "sub_question": "(1)",
        "is_final_answer": false
      },
      {
        "id": "i1",
        "label": "変位 x での浮力 F' を計算する",
        "type": "inference",
        "sub_question": "(1)",
        "is_final_answer": false,
        "inputs_used": { "fluid_density": "1", "submerged_volume": "((2/3)*H + x)*S", "gravity_acc": "g" },
        "outputs_derived": { "buoyant_force": "F' = 1 * ((2/3)*H + x)*S * g" }
      },
      {
        "id": "p2",
        "label": "浮力 F' = 1 * ((2/3)*H + x)*S * g",
        "type": "proposition",
        "sub_question": "(1)",
        "is_final_answer": true
      }
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
      model: 'gemini-3.6-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: "【1枚目画像: 問題文】" },
            { inlineData: { mimeType: problemMimeType, data: problemBase64 } },
            { text: "【2枚目画像: 解答答案】" },
            { inlineData: { mimeType: answerMimeType, data: answerBase64 } },
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
                        enum: ['proposition', 'theorem', 'inference']
                      },
                      label: { type: 'STRING' },
                      sub_question: { type: 'STRING' },
                      is_final_answer: { type: 'BOOLEAN' },
                      inputs_used: { 
                        type: 'OBJECT',
                        nullable: true
                      },
                      outputs_derived: { 
                        type: 'OBJECT',
                        nullable: true
                      }
                    },
                    required: ['id', 'type', 'label', 'sub_question']
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
          console.error('[API Error] Gemini JSON Parse 失敗:', rawText);
          return NextResponse.json({ error: 'Geminiの出力データがJSONとして不適正です', rawText: rawText }, { status: 500 });
        }
      }
    }

    // 浮いている推論ノードへのセーフティ補填
    if (parsedData && parsedData.graph && Array.isArray(parsedData.graph.nodes) && Array.isArray(parsedData.graph.edges)) {
      const currentNodes = [...parsedData.graph.nodes];
      const edges = parsedData.graph.edges;
      const additionalNodes: any[] = [];
      let autoTheoremCount = 1;

      currentNodes.forEach((node: any) => {
        if (node.type === 'inference') {
          const hasTheorem = edges.some((e: any) => {
            if (e.to === node.id) {
              const fromNode = currentNodes.find((n: any) => n.id === e.from);
              return fromNode && fromNode.type === 'theorem';
            }
            return false;
          });

          if (!hasTheorem) {
            const newTheoremId = `t_auto_${autoTheoremCount++}`;
            additionalNodes.push({
              id: newTheoremId,
              type: 'theorem',
              label: `代数計算・連立方程式の消去`,
              sub_question: node.sub_question || "共通",
              is_final_answer: false
            });
            edges.push({
              from: newTheoremId,
              to: node.id
            });
          }
        }
      });

      parsedData.graph.nodes = [...currentNodes, ...additionalNodes];
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
    console.error('[API Catch Error] 致命的エラーが発生しました:', err);
    return NextResponse.json({
      error: 'APIリクエストで致命的エラーが発生しました',
      details: err?.message || String(err)
    }, { status: 500 });
  }
}