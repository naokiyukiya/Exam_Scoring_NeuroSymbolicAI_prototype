import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { supabase } from '../../../lib/supabase';
import theorems from '../../../lib/constants/theorems.json';

// ★ Next.js のAPIタイムアウト制限を60秒に設定
export const maxDuration = 60;
const PROMPT_VERSION = "1.28.0";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

/**
 * 503 (High Demand) や 429 (Rate Limit / Quota) などの一時的過負荷時に自動で再試行するヘルパー関数
 */
async function generateWithRetry(params: any, maxRetries = 3, initialDelayMs = 2000) {
  let delay = initialDelayMs;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const isRetryable =
        err?.status === 503 ||
        err?.status === 429 ||
        errMsg.includes('high demand') ||
        errMsg.includes('UNAVAILABLE') ||
        errMsg.includes('503') ||
        errMsg.includes('429') ||
        errMsg.includes('RESOURCE_EXHAUSTED');

      if (isRetryable && attempt < maxRetries) {
        console.warn(
          `[Gemini API Overloaded/Quota] サーバー混雑または制限検知のためリトライ (${attempt}/${maxRetries}). ${delay}ms後に再試行...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // 指数バックオフ
      } else {
        throw err;
      }
    }
  }
}

/**
 * トークン切れ等で途中で切れた不完全なJSON文字列を安全に閉じて修復する関数
 */
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
  const { searchParams } = new URL(request.url);
  const answerId = searchParams.get('answerId');

  if (!answerId) {
    return NextResponse.json({ error: 'Missing answerId' }, { status: 400 });
  }

  const { data: answer, error } = await supabase
    .from('posts')
    .select('image_url')
    .eq('id', answerId)
    .single();

  if (error || !answer?.image_url) {
    return NextResponse.json({ error: '画像URLを取得できませんでした' }, { status: 404 });
  }

  const data: any = theorems;
  const theoremVersion = data?.version || "unknown";

  // キャッシュの確認（プロンプトバージョン一致時のみキャッシュ返却）
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
      metadata: {
        promptVersion: existingGraph.prompt_version,
        theoremVersion: existingGraph.theorem_version,
        cached: true
      }
    });
  }

  // 定理ライブラリの展開
  let theoremListString = "";
  const allKnownTheorems = new Set<string>();

  try {
    if (data?.theorems?.rule_groups) {
      data.theorems.rule_groups
        .flatMap((g: any) => g.rules || [])
        .forEach((r: any) => allKnownTheorems.add(r.name));
    } else if (Array.isArray(data)) {
      data.forEach((r: any) => allKnownTheorems.add(r.name));
    }
    theoremListString = Array.from(allKnownTheorems).map((name) => `- ${name}`).join('\n');
  } catch (err) {
    console.error("定理データの展開に失敗しました", err);
  }

  try {
    const imageRes = await fetch(answer.image_url);
    const arrayBuffer = await imageRes.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');

    const response = await generateWithRetry({
      // クオータ制限を回避しやすい gemini-1.5-flash を設定（プランに応じて 2.5-flash に変更可）
      model: 'gemini-1.5-flash',
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
問題に場合分けがある場合は、すべての計算プロセスを省略せずに完全に抽出しきってください。

[制約事項 (Rules)]
0. 【絶対言語指定】:
   - 出力するJSON内のすべての文字列（label、construction_processなど）は、**必ず日本語**で記述してください。英語での出力は固く禁じます。
1. グラフの基本構造と完走の義務:
   - メインのフローは必ず「命題」→「推論」→「命題」と交互に配置してください。
   - 途中で抽出を打ち切ることは絶対に許されません。答案に書かれているすべての式を命題として抽出し、必ず最後まで対応するエッジを繋ぎ切ってください。
2. 定理の選択（自作の完全禁止・超厳守事項）:
   - すべての推論（inference）ノードには、必ず1つの定理（theorem）ノードを「定理から推論へ」の向きで接続してください。
   - 【警告】定理の label は、必ず末尾の [利用可能な定理ライブラリ] の一覧から最も適切なものを一つ選び、**一言一句違わず全く同じ文字列**をコピーして使用してください。
   - 【警告】ライブラリに存在しない独自の定理名（例: [新規定理] ○○ など）を勝手に作成することは**一切禁止**します。必ず用意されたリストの既存ルールの中から代用してください。
3. 推論ノードのラベルの調整:
   - 細かすぎる長文解説にせず、「右辺の項を左辺に移項する」「両辺に (x-2) を掛けて整理する」「2つの条件の共通範囲を求める」のように、何をどう変形したのかが式レベルで一目で分かる程度に簡潔な日本語で書いてください。
4. 複数の命題の組み合わせ:
   - 2つの命題を組み合わせる推論の場合、「2つの命題ノード」と「1つの定理ノード」の合計3つから、1つの推論ノードへエッジを向けてください。
5. 推論ノードの検証ステータス:
   - ノードの種類が「推論（inference）」である場合のみ、必ず "verification_status": "検証前" を追加してください。

[出力形式 (Format)]
- 以下のJSONフォーマットに厳密に従ってください。

{
  "graph": {
    "nodes": [
      { "id": "p1", "label": "x > 2", "type": "proposition" },
      { "id": "p2", "label": "x <= 5", "type": "proposition" },
      { "id": "t1", "label": "複数の条件を組み合わせる", "type": "theorem" },
      { "id": "i1", "label": "2つの条件の共通範囲を求める", "type": "inference", "verification_status": "検証前" },
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
          return NextResponse.json({ error: 'Geminiの出力データがJSONとして不適正です', rawText: rawText }, { status: 500 });
        }
      }
    }

    if (parsedData && parsedData.graph && Array.isArray(parsedData.graph.nodes) && Array.isArray(parsedData.graph.edges)) {
      const nodes = parsedData.graph.nodes;
      const edges = parsedData.graph.edges;
      let autoTheoremCount = 1;

      nodes.forEach((node: any) => {
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
            nodes.push({
              id: newTheoremId,
              type: 'theorem',
              label: '基本変形'
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
        const { data: existing } = await supabase
          .from('logic_graphs')
          .select('id')
          .eq('post_id', answerId)
          .maybeSingle();

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
    return NextResponse.json(
      { error: 'APIリクエストで致命的エラーが発生しました', details: err?.message || String(err) },
      { status: 500 }
    );
  }
}