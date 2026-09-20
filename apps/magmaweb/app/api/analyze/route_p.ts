import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, Type, Schema } from '@google/generative-ai';
import physicsLibrary from './physics.json';

// --- 型定義 ---
export interface Node {
  id: string;
  type: 'proposition' | 'inference' | 'theorem';
  label: string;
  latex?: string;
  // 推論ノードにおいて適用された入出力の対応関係
  inputs_used?: Record<string, string>;
  outputs_derived?: Record<string, string>;
  construction_process?: string;
}

export interface Edge {
  source: string;
  target: string;
  role?: string;
}

export interface PhysicsDagResponse {
  nodes: Node[];
  edges: Edge[];
  overall_summary?: string;
}

// --- Gemini 構造化出力用 JSON Schema 定義 ---
const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    nodes: {
      type: Type.ARRAY,
      description: "DAGに含まれる全ノードのリスト",
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "一意のノードID（例: p1, inf1, th1）"
          },
          type: {
            type: Type.STRING,
            enum: ["proposition", "inference", "theorem"],
            description: "ノードの種類（proposition: 物理状態/方程式, inference: 規則・定理の適用推論, theorem: 定理ライブラリの法則）"
          },
          label: {
            type: Type.STRING,
            description: "日本語によるノードの説明または数式ラベル"
          },
          latex: {
            type: Type.STRING,
            description: "数式が存在する場合のLaTeX表現"
          },
          inputs_used: {
            type: Type.OBJECT,
            description: "推論ノード（inference）において、適用したルールに与えた入力物理量・前提式のマップ",
            properties: {}
          },
          outputs_derived: {
            type: Type.OBJECT,
            description: "推論ノード（inference）において、適用したルールによって得られた出力式・運動同定結果のマップ",
            properties: {}
          },
          construction_process: {
            type: Type.STRING,
            description: "思考・計算ステップの補足解説"
          }
        },
        required: ["id", "type", "label"]
      }
    },
    edges: {
      type: Type.ARRAY,
      description: "ノード間の接続（有向エッジ）のリスト",
      items: {
        type: Type.OBJECT,
        properties: {
          source: {
            type: Type.STRING,
            description: "接続元ノードID"
          },
          target: {
            type: Type.STRING,
            description: "接続先ノードID"
          },
          role: {
            type: Type.STRING,
            description: "エッジの役割（例: input_binding, theorem_apply, output_result）"
          }
        },
        required: ["source", "target"]
      }
    },
    overall_summary: {
      type: Type.STRING,
      description: "思考プロセスの全体要約（日本語）"
    }
  },
  required: ["nodes", "edges"]
};

// Gemini APIクライアント初期化
const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get('image') as File | null;

    if (!imageFile) {
      return NextResponse.json({ error: '画像ファイルが送信されていません。' }, { status: 400 });
    }

    // 画像をBase64化
    const arrayBuffer = await imageFile.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');

    // physics.json から入力・出力の仕様を含めた定理ライブラリ文字列を生成
    const theoremListString = physicsLibrary.theorems
      .map(t => {
        const inputsStr = JSON.stringify(t.inputs);
        const outputsStr = JSON.stringify(t.outputs);
        return `- ID: [${t.id}] | Name: "${t.name}"\n  Type: ${t.type}\n  Inputs(仮定/物理量): ${inputsStr}\n  Outputs(結論/等式/運動分類): ${outputsStr}`;
      })
      .join('\n\n');

    // システムプロンプトの構築
    const promptText = `
[役割 (Persona)]
あなたは、高校物理の論理構造および解法プロセスの自動検証を行うAI物理エンジニアです。

[目的 (Purpose)]
入力された答案・思考ノート画像を解析し、物理法則の【入力（Inputs: 前提・仮定・物理量）】から【出力（Outputs: 成り立つ等式・運動の分類）】への推論フローを有向グラフ（DAG）として抽出してください。

[思考ノードの種類 (Node Types)]
- proposition (命題・状態・式ノード): 物理的な状況設定、定義された座標、立てられた方程式、得られた数値や結論（運動分類含む）。
- inference (物理的推論ノード): 入力前提（inputs）からルールを適用して出力結論（outputs）を導く推論ステップ。
- theorem (物理法則・定理ノード): [利用可能な構造化定理ライブラリ] に定義されている物理ルール。

[推論ステップ（inference）のバインディング規則]
推論ノード（inference）を作成する際は、必ず適用した theorem ノードの Inputs / Outputs の契約に従い、具体的にどの物理量や式が代入・抽出されたかを \`inputs_used\` と \`outputs_derived\` に記録してください。

例 (単振動の同定の場合):
- 定理: pattern_restoring_force
- inputs_used: { "equation_form": "m * d^2x/dt^2 = -K * (x - x_c)" }
- outputs_derived: { "motion_type": "単振動", "vibration_center": "x_c", "angular_frequency": "sqrt(K/m)" }

[構造ルール (Graph Rules)]
1. フロー構造:
   - 前提の proposition ノード群 -> (inputとして) -> inference ノード
   - theorem ノード -> (ルール適用として) -> inference ノード
   - inference ノード -> (outputとして) -> 結論の proposition ノード群
2. 明示的抽象化:
   - 式変形だけで終わらせず、得られた式（例: ma = -Kx）から「この運動は単振動である」という運動分類（Outputs）へのマッピングノードを必ず含めてください。
3. 言語指定:
   - 説明テキストは日本語を使用してください。

[利用可能な構造化定理ライブラリ]
${theoremListString}
    `.trim();

    // Gemini API呼び出し
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.1,
      }
    });

    let attempts = 0;
    const maxAttempts = 3;
    let rawText = '';

    while (attempts < maxAttempts) {
      try {
        attempts++;
        const result = await model.generateContent([
          {
            inlineData: {
              mimeType: imageFile.type || 'image/jpeg',
              data: base64Image
            }
          },
          { text: promptText }
        ]);

        rawText = result.response.text();
        if (rawText) break;
      } catch (err) {
        console.warn(`Gemini API 呼び出し試行 ${attempts} 失敗:`, err);
        if (attempts >= maxAttempts) throw err;
      }
    }

    const parsedData: PhysicsDagResponse = JSON.parse(rawText);

    return NextResponse.json(parsedData, { status: 200 });

  } catch (error: any) {
    console.error('route_p POST エラー:', error);
    return NextResponse.json(
      { error: '物理思考DAGの解析処理中にエラーが発生しました。', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}