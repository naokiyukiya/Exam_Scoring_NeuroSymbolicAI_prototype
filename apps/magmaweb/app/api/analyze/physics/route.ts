import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { supabase } from '../../../../lib/supabase';
import physicsLibrary from '../../../../lib/constants/physics.json';

export const maxDuration = 60;

const physicsData: any = physicsLibrary;
const theoremVersion = physicsData?.version || "2.4.2";
// プロンプトバージョンを更新してキャッシュを更新
const PROMPT_VERSION = `${theoremVersion}_latex_and_detailed_energy_steps_v2`;

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

    // physics.json から Geminiの推論に必要な情報（prompt_data）だけをフィルタリング抽出
    let theoremListString = "";
    try {
      if (Array.isArray(physicsData?.theorems)) {
        theoremListString = physicsData.theorems
          .map((t: any) => {
            // 新フォーマット（prompt_dataあり）と旧フォーマットの両方に対応
            const target = t.prompt_data || t;
            const inputsStr = JSON.stringify(target.inputs || {});
            const outputsStr = JSON.stringify(target.outputs || {});
            const varsStr = target.variables ? JSON.stringify(target.variables) : "{}";
            
            // UI用HTML(explanation_html)やプログラム(render_script)等は完全に除外して送信
            return `- ID: [${t.id}] | Name: "${t.name}"\n  Variables Definition: ${varsStr}\n  Inputs: ${inputsStr}\n  Outputs: ${outputsStr}`;
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
【1枚目画像: 問題文】の設定前提と、【2枚目画像: 解答答案】に書かれている物理的思考・計算ステップを分解抽出し、細かな論理構成を持つ有向グラフ（DAG）を作成してください。

[最重要ルール]
1. **【答案への完全忠実原則（未記述の法則・文字・ステップの補完・捏造の絶対禁止）】**:
   - 生徒が答案に明示的に書いていない『未記述の思考ステップ』『新しい物理量（例: 答案に書いていない加速度 a や張力 T など）』『未記述の中間法則（例: F=-Kxの答案に対して勝手に挿入する運動方程式 m*a=F など）』を補完・捏造してノード化することを一切禁じます。
   - 生徒が大きな跳躍（例: F=-Kx から直接周期へ）をしている場合は、書かれていない中間法則ノードを挟まず、答案に存在する要素から直接推論ノードへ接続してください。

2. **【複合式の要素分解ルール（保存則・方程式の各項の個別ノード化）】**:
   - 答案上に「等式」や「複合式」（例: 保存則の式 $\\frac{1}{2}K\\left(\\frac{2}{3}H\\right)^2 + 0 = \\frac{1}{2}K\\left(\\frac{1}{3}H\\right)^2 + \\frac{1}{2}M v^2$）が1行で書かれている場合、その式を構成する各項（例: 左辺の初期状態エネルギー、右辺の移動後エネルギー）は **すでに答案内に提示されている明示的要素** です。
   - 保存法則等の推論ノード（type: "inference"）を作成する際は、いきなり等式全体を1つの推論で終わらせるのではなく、**必ずその等式に含まれる各状態の物理量・エネルギー表現式を個別の proposition ノード（例: 「初期状態における単振動位置エネルギー」）として分解・抽出し、それらを推論ノードの inputs_used に入力として接続** してください。
   - ※「未記述の法則を勝手に創作すること（禁止）」と「記述された1行の式から構成要素を分解抽出すること（必須）」を明確に区別してください。

3. **【Inputs / Outputs の必須バインディングと変数定義の尊重】**:
   - 推論ノード（type: "inference"）における \`inputs_used\` と \`outputs_derived\` は**絶対に使用・出力**してください。決して空のオブジェクト \`{}\` や \`null\` にしないでください。
   - [利用可能な構造化定理ライブラリ] の **Variables Definition** に記載されている物理的意味を踏まえ、問題文・答案内のどの文字や式が定理のどの変数に対応しているかを正しく理解した上で \`inputs_used\` に格納してください。
   - ノード内の数式表現は、フロントエンドでの表示のために可能な限りきれいな **LaTeX形式**（例: \`\\frac{a}{b}\`, \`x_0\`, \`\\cdot\`）で記述してください。

4. **【座標軸・正の向きの一貫性】**:
   - 問題文および答案で定義された座標軸・正の向きに従い、符号（+ / -）の矛盾が生じないように数式を記述してください。

5. **【小問（sub_question）の接続性とタグ付け】**:
   - 小問 (1), (2), (3) が分かれている問題でも、前後の小問の論理的つながりを途切れさせず、**全体の1つの繋がったグラフ（DAG）**として構成してください。
   - 各ノードには \`sub_question\`（例: "(1)", "(2)", "共通"）を付与し、各小問の最終結論の proposition ノードには \`is_final_answer: true\` を設定してください。

6. **【定理ラベルの一致】**:
   - 推論ノードに接続する \`theorem\` ノードの label は、必ず [利用可能な構造化定理ライブラリ] の Name と一字一句違わず一致させてください。

7. **【全記述の日本語指定】**:
   - label および construction_process はすべて日本語で記述してください。

[出力形式 (Format Examples)]
※以下はグラフ構造とLaTeX表記の記述例です。問題に応じて適切なノード構造を構築してください。

--- 例1: 複合式（保存則・方程式など）の要素分解と立式パターン ---
{
  "graph": {
    "nodes": [
      {
        "id": "p1",
        "label": "初期状態（底面が水面）における単振動位置エネルギー: $E_1 = \\frac{1}{2}K\\left(\\frac{2}{3}H\\right)^2$",
        "type": "proposition",
        "sub_question": "(3)",
        "is_final_answer": false
      },
      {
        "id": "p2",
        "label": "上面が水面と一致した状態での全エネルギー: $E_2 = \\frac{1}{2}K\\left(\\frac{1}{3}H\\right)^2 + \\frac{1}{2}M v^2$",
        "type": "proposition",
        "sub_question": "(3)",
        "is_final_answer": false
      },
      {
        "id": "t1",
        "label": "単振動の位置エネルギー保存法則（つりあい位置基準）",
        "type": "theorem",
        "sub_question": "(3)",
        "is_final_answer": false
      },
      {
        "id": "i1",
        "label": "2状態間で単振動の位置エネルギー保存法則を立式する",
        "type": "inference",
        "sub_question": "(3)",
        "is_final_answer": false,
        "inputs_used": {
          "E_initial": "\\frac{1}{2}K\\left(\\frac{2}{3}H\\right)^2",
          "E_final": "\\frac{1}{2}K\\left(\\frac{1}{3}H\\right)^2 + \\frac{1}{2}M v^2"
        },
        "outputs_derived": {
          "energy_conservation_eq": "\\frac{1}{2}K\\left(\\frac{2}{3}H\\right)^2 = \\frac{1}{2}K\\left(\\frac{1}{3}H\\right)^2 + \\frac{1}{2}M v^2"
        }
      },
      {
        "id": "p3",
        "label": "エネルギー保存の式: $\\frac{1}{2}K\\left(\\frac{2}{3}H\\right)^2 = \\frac{1}{2}K\\left(\\frac{1}{3}H\\right)^2 + \\frac{1}{2}M v^2$",
        "type": "proposition",
        "sub_question": "(3)",
        "is_final_answer": false
      }
    ],
    "edges": [
      { "from": "p1", "to": "i1" },
      { "from": "p2", "to": "i1" },
      { "from": "t1", "to": "i1" },
      { "from": "i1", "to": "p3" }
    ]
  },
  "construction_process": [
    "Step 1: 答案内の保存則式から、初期状態における単振動位置エネルギー項を抽出する。",
    "Step 2: 答案内の保存則式から、上面一致状態における位置エネルギーと運動エネルギーの和を抽出する。",
    "Step 3: つりあい位置基準の単振動位置エネルギー保存法則を適用し、等式として立式する。"
  ]
}

--- 例2: 物理量の定義・計算・導出パターン ---
{
  "graph": {
    "nodes": [
      {
        "id": "p4",
        "label": "変位 $x$ での水没体積: $V' = \\left(\\frac{2}{3}H + x\\right)S$",
        "type": "proposition",
        "sub_question": "(1)",
        "is_final_answer": false
      },
      {
        "id": "t2",
        "label": "アルキメデスの原理（浮力）",
        "type": "theorem",
        "sub_question": "(1)",
        "is_final_answer": false
      },
      {
        "id": "i2",
        "label": "変位 $x$ での浮力 $F'$ を計算する",
        "type": "inference",
        "sub_question": "(1)",
        "is_final_answer": false,
        "inputs_used": {
          "fluid_density": "\\rho",
          "submerged_volume": "\\left(\\frac{2}{3}H + x\\right)S",
          "gravity_acc": "g"
        },
        "outputs_derived": {
          "buoyant_force": "F' = \\rho \\left(\\frac{2}{3}H + x\\right)S g"
        }
      },
      {
        "id": "p5",
        "label": "浮力: $F' = \\rho \\left(\\frac{2}{3}H + x\\right)S g$",
        "type": "proposition",
        "sub_question": "(1)",
        "is_final_answer": true
      }
    ],
    "edges": [
      { "from": "p4", "to": "i2" },
      { "from": "t2", "to": "i2" },
      { "from": "i2", "to": "p5" }
    ]
  },
  "construction_process": [
    "Step 1: 変位 $x$ における水没体積 $V'$ を特定する。",
    "Step 2: アルキメデスの原理より浮力 $F'$ を導出する。"
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
                        description: 'ノード種別: "proposition", "theorem", "inference" のいずれか'
                      },
                      label: { type: 'STRING' },
                      sub_question: {
                        type: 'STRING',
                        description: '対応する小問（例: "(1)", "(2)", "共通"）。'
                      },
                      is_final_answer: {
                        type: 'BOOLEAN',
                        description: '該当する小問の最終結果となる答えのノードである場合は true'
                      },
                      inputs_used: { 
                        type: 'OBJECT',
                        description: '【inferenceノードで必須】LaTeX形式での入力変数や数式。'
                      },
                      outputs_derived: { 
                        type: 'OBJECT',
                        description: '【inferenceノードで必須】LaTeX形式での出力変数や数式。'
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