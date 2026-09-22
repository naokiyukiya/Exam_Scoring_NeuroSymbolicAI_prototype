import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { supabase } from '../../../lib/supabase'
import theorems from '../../../lib/constants/mathematics.json';

// ★ タイムアウトを60秒に延長
export const maxDuration = 60;
const PROMPT_VERSION = "1.24.0"; // バージョンを更新

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })

// ★ 503/429エラーが出た時に自動で再試行するヘルパー関数
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

  // ★ 修正：mathematics.json の正しい階層 (data.rule_groups) からリストを抽出するように修正
  let theoremListString = "";
  try {
    if (data?.rule_groups) {
      theoremListString = data.rule_groups.flatMap((g: any) => g.rules || []).map((r: any) => `- ${r.name}`).join('\n');
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

    const response = await generateWithRetry({
      model: 'gemini-3.6-flash', 
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
【超重要】問題に場合分けがある場合、全ての結論に至るまで、すべての計算プロセスを省略せずに完全に抽出しきってください。

[制約事項 (Rules)]
0. 【絶対言語指定】:
   - 出力するJSON内のすべての文字列（label、construction_processなど）は、**必ず日本語**で記述してください。英語での出力は固く禁じます。
1. グラフの基本構造と完走の義務:
   - メインのフローは必ず「命題」→「推論」→「命題」と交互に配置してください。
   - 途中で抽出を打ち切ることは絶対に許されません。答案に書かれているすべての式を命題として抽出し、必ず最後まで対応するエッジを繋ぎ切ってください。
2. 定理ノードの完全必須化とエッジの向き（超厳守）:
   - すべての推論（inference）ノードには、必ず1つの定理（theorem）ノードを「定理から推論へ (from: theorem, to: inference)」の向きで接続してください。
   - 【警告】定理の label は、必ず末尾の [利用可能な定理ライブラリ] の一覧から最も適切なものを一つ選び、一字一句違わず全く同じ文字列をコピーして使用してください。勝手に新規定理を作ることは一切禁止します。
3. 【推論ノードのラベルの調整（超重要）】:
   - 推論ノードの \`label\` は、細かすぎる長文解説にせず、どのような計算・式変形を行ったのかを**簡潔**に記述してください。
   - 「右辺の項を左辺に移項する」「両辺に (x-2) を掛けて整理する」のように、何をどう変形したのかが式レベルで一目で分かる程度に、少しだけ丁寧に書いてください。
4. 複数の命題の組み合わせ:
   - 2つの命題を組み合わせる推論の場合、「2つの命題ノード」と「1つの定理ノード」の合計3つから、1つの推論ノードへエッジ（from）を向けてください。
5. 【孤立ノードの絶対禁止と全結合の義務】（超重要）:
   - "nodes" 配列に作成したすべての命題ノード・推論ノードは、必ず前後の文脈に合わせて "edges" で接続してください。ノードだけ作ってエッジの記述をサボることは固く禁じます。抽出したすべての命題が繋がるように論理を補完してください。
6. 推論ノードの検証ステータス:
   - verification_status は、**種類が「推論（inference）」であるノードにのみ**必ず追加してください。「命題（proposition）」や「定理（theorem）」のノードには、verification_status を絶対に含めないでください。
7. 出力キーの制限:
   - 指定されたJSONスキーマ以外のキー（例: new_theorems）は絶対に出力しないでください。
8.【禁止事項】:
   - 「等号で結ぶ」「等式を立てる」などの自明な操作を独立した推論ノードとして抽出しないでください。「等号の定義」のような当たり前の定理ノードも不要です。数式の変形（展開、因数分解、代入など）のみを推論ステップとして抽出してください。
9.【数式記号の統一フォーマット】:
     数学記号は検証エンジンのパース制約上、必ず以下のフォーマットで出力してください。LaTeX表記や独自の省略表記は禁止です。
   - 極限: lim[変数->近づく値] 式 (例: lim[x->0] (x^2))
   - 定積分: ∫[下端 to 上端] 式 d変数 (例: ∫[0 to 1] (x^2) dx)
   - 不定積分: ∫ 式 d変数 (例: ∫ (x^2) dx)
   - 微分: d/d変数 (式) (例: d/dx (x^2) ※f'(x)のようなダッシュ表記は使わない)
   - シグマ: Σ[変数=初期値 to 終点] 式 (例: Σ[k=1 to n] (2k))
   - 対数: log[底](真数) (例: log[2](8) / 自然対数は ln(x) とする)
   - 絶対値: |式| (例: |x-1|)
   - 順列・組合せ: P(n, r), C(n, r) (例: C(n, k))
   - 平方根・累乗根: sqrt(式), root(式, n) (例: √x やルート記号は使わず sqrt(x) とする)
   - 三角関数: sin(x), cos(x), tan(x) (※必ず括弧をつけること)
   - 数学定数: 円周率は pi、自然対数の底(ネイピア数)は E、虚数単位は I (大文字のアイ) とする。
10.【重要】:
   - 数式の中に「Σ（シグマ）」「∫（積分）」「lim（極限）」などが含まれている場合、その計算や変形を行うステップには、ただの「式の展開・整理」ではなく、必ず「シグマの公式」「定積分の計算」「極限の性質」といった具体的な【定理・定義ノード】を抽出して接続してください。
11.【絶対遵守事項】:
   - Σ（シグマ）記号の計算・消去を行うステップでは、対応する定理・定義ノード（theorem）に必ず「シグマの計算」や「数列の和の公式」といった具体的な名称を付けて独立させてください。これを単なる「式の展開・整理」や「同類項の整理」としてひとまとめにすることは固く禁じます。
12.【式の分割抽出ルール（超厳守）】:
   - 「変形前の式 = 変形後の式」（例: \`a(b+c) = ab + ac\` や \`(1/6 + 5/6)n + Σ... = n^2\`）のように、1つの変形ステップを等号で結んで1つの命題ノードにまとめることは【絶対に禁止】です。
   - 必ず「変形前の式 (ノードA)」と「変形後の式 (ノードB)」を別々の命題ノードとして独立させ、その間に推論ノードを挟んで抽出してください。
13.【命題ノードのデュアル構造（超重要）】:
   - 命題ノードの 'label' には、生徒の答案に書かれている日本語のテキストを含め、**ありのまま**抽出してください。
   - その代わり、命題ノードには必ず 'math_expr' というキーを追加し、そこには**SymPyで計算・検証するための純粋な数式のみ**を記述してください。
   - もし 'label' が「AをBで割ると商はQ、余りはR」という日本語であった場合、'math_expr' には「A = B * Q + R」という等式に翻訳して格納してください。数式のみの命題の場合は、'label' と 'math_expr' は同じ内容で構いません。
14. 【解の範囲の表現（カンマ禁止）】:
   - 解の範囲や複数の条件を列挙する際、「x <= -1, 8/3 <= x」のようにカンマ「,」を使って区切ることは【絶対禁止】です。
   - 必ず文脈に合わせて「x <= -1 または 8/3 <= x」や「x > 0 かつ x != 1」のように、「または」「かつ」という論理記号を日本語で明記してください。
   
[出力形式 (Format)]
- 以下のJSONフォーマットに厳密に従ってください。

{
  "graph": {
    "nodes": [
      { "id": "p1", "label": "x > 2", "math_expr": "x > 2", "type": "proposition" },
      { "id": "p2", "label": "x <= 5", "math_expr": "x <= 5", "type": "proposition" },
      { "id": "t1", "label": "複数の条件を組み合わせる", "type": "theorem" },
      { "id": "i1", "label": "命題p1とp2の条件を組み合わせる", "type": "inference", "verification_status": "検証前" },
      { "id": "p3", "label": "2 < x <= 5", "math_expr": "2 < x <= 5", "type": "proposition" }
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
以下のリストから最も適切な定理名を必ず選んでください。
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
                      to: { type: 'STRING' },
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
        maxOutputTokens: 16384
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

    if (parsedData && parsedData.graph && Array.isArray(parsedData.graph.nodes) && Array.isArray(parsedData.graph.edges)) {
      let nodes = parsedData.graph.nodes;
      const edges = parsedData.graph.edges;
      let autoTheoremCount = 1;

      // セーフティネット：推論ノードに定理が繋がっていなかったら自動で作成して繋ぐ
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