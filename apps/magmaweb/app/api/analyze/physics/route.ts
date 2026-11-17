import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { supabase } from '../../../../lib/supabase';
import physicsLibrary from '../../../../lib/constants/physics.json';

export const maxDuration = 60;

const physicsData: any = physicsLibrary;
const theoremVersion = physicsData?.version || "2.4.2";
const PROMPT_VERSION = `${theoremVersion}_dag_v2_2_neural_catalog_v1`;

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

    // キャッシュチェック（preserved と双方のバージョン情報を取得）
    const { data: existingGraph } = await supabase
      .from('logic_graphs')
      .select('graph_data, construction_process, prompt_version, theorem_version, preserved')
      .eq('post_id', answerId)
      .maybeSingle();

    if (existingGraph) {
      // preserved=true のデータはバージョンにかかわらず保護する。
      // それ以外は prompt_version と theorem_version が一致する場合のみキャッシュを返す。
      const isVersionMatch = (
        existingGraph.prompt_version === PROMPT_VERSION &&
        existingGraph.theorem_version === theoremVersion
      );

      if (existingGraph.preserved || isVersionMatch) {
        return NextResponse.json({
          imageUrl: answer.image_url,
          graph: existingGraph.graph_data,
          constructionProcess: existingGraph.construction_process,
          metadata: {
            promptVersion: existingGraph.prompt_version,
            theoremVersion: existingGraph.theorem_version,
            cached: true,
            preserved: existingGraph.preserved
          }
        });
      }
    }

    // physics.json からGemini向けcanonical定理カタログを生成する。
    // legacy_alias のみを除外し、その他のcanonical theoremは候補に残す。
    const geminiTheoremCatalog = (physicsData?.theorems || [])
      .filter((t: any) => t.verification_metadata?.status !== 'legacy_alias')
      .map((t: any) => {
        const data = t.prompt_data || {};
        return {
          id: t.id,
          name: t.name,
          category: data.type || 'unknown',
          variables: data.variables || {},
          inputs: data.inputs || {},
          outputs: data.outputs || {}
        };
      });

    // Geminiへ送るカタログはcompact JSONにする。
    const theoremListString = JSON.stringify(geminiTheoremCatalog);

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

    // Geminiにはニューラル側に必要な意味情報のみを渡す。
    const semanticRoleCatalog = (physicsData?.semantic_roles?.roles || []).map((r: any) => ({
      role_id: r.role_id,
      description: r.description,
      expected_sort: r.expected_sort
    }));
    const semanticRoleCatalogString = JSON.stringify(semanticRoleCatalog);

    const physicalVocabularyCatalog = {
      functions: (physicsData?.physical_vocabulary?.functions || []).map((f: any) => ({
        name: f.name,
        args: f.args,
        returns: f.returns,
        meaning: f.meaning
      })),
      predicates: (physicsData?.physical_vocabulary?.predicates || []).map((p: any) => ({
        name: p.name,
        args: p.args,
        meaning: p.meaning
      }))
    };
    const physicalVocabularyCatalogString = JSON.stringify(physicalVocabularyCatalog);

    const promptText = `
[役割 (Persona)]
あなたは高校物理の答案を、記述内容に忠実な推論DAGへ変換する厳格な物理AIエンジンです。
あなたの役割は答案の読解・構造化であり、物理的正しさの最終判定や未記述内容の補完ではありません。

[目的 (Purpose)]
【1枚目画像: 問題文】の設定・与件と、【2枚目画像: 解答答案】に実際に書かれている物理的思考・計算ステップを抽出し、答案の順序と依存関係を保持した1つの有向非巡回グラフ（DAG）を作成してください。

[最重要原則]
1. 【答案の全ステップの微細ノード化（省略の絶対禁止）】
   - 答案に書かれているすべての式、計算変形、代入、立式、条件設定を、可能な限り1ステップずつ個別のinferenceノードとpropositionノードに分解してください。
   - 複数の計算・代入を1つの推論ノードにまとめて飛ばしてはいけません。
   - 答案に書かれた展開順序と依存関係を保持してください。
   - 途中式が答案に明示されていない場合、正しそうな途中式を追加してはいけません。

2. 【未記述の補完・捏造禁止】
   - 生徒が書いていない思考ステップ、式、文字、条件、物理法則を追加してはいけません。
   - 問題文に明記された与件と答案に明記された内容を区別してください。
   - 判読不能・曖昧な箇所は推測で確定せず、labelに判読上の不確実性を明示し、対応するASTや意味役割を無理に作らないでください。

3. 【Inputs / Outputs の徹底記録】
   - 各inferenceノードには、必ず inputs_used と outputs_derived を付けてください。
   - inputs_usedには、その推論で実際に使われた直前の命題・与件・変数を記録してください。
   - outputs_derivedには、その推論によって新たに得られた式・関係・値を記録してください。
   - 答案に書かれていない入力や中間結果を補ってはいけません。

4. 【LaTeX表現と小問の一貫性】
   - 数式を含むlabelはLaTeXで記述してください（例: $E = \\frac{1}{2}mv^2$）。
   - 小問(1),(2)等がある場合もgraphは1つに統合し、各ノードにsub_questionを設定してください。
   - 最終的な解答として答案上で明示された命題にのみis_final_answer: trueを設定してください。
   - 最終答が複数ある場合は、それぞれに設定してください。

5. 【定理ラベル・IDの厳密一致】
   - theoremノードには、下記の定理カタログに存在するcanonicalな定理だけを使用してください。
   - theoremノードのtheorem_idは定理カタログのidと完全一致させてください。
   - labelは対応する定理カタログのnameと一字一句同じにしてください。
   - 定理名・定理IDを創作、改名、短縮してはいけません。
   - 定理カタログに適切な物理法則が見つからない場合、別の物理法則を捏造してはいけません。

[定理選択と推論の区別]
- 物理法則・定理の適用と、単なる代数計算を区別してください。
- 物理法則を適用した推論では、対応する物理定理IDをinference.theorem_idに設定し、その定理ノードを接続してください。
- 式の整理、代入、展開、因数分解、連立方程式の消去など、物理法則を新たに適用しない代数操作には、定理カタログの「algebraic_simplification」を使用してください。
- 「algebraic_simplification」は代数処理を表す登録済みノードであり、物理法則ではありません。物理法則の適用を代数計算として偽装してはいけません。
- 物理法則を使ったか、単なる代数変形かを答案から判別できない場合は、根拠なく物理法則を選択せず、代数定理を便宜的に割り当てることも避けてください。
- 「pattern_restoring_force」は旧定義の互換エイリアスであり、選択してはいけません。単振動の同定にはcanonical ID「pattern_restoring_force_direct」のみを使用してください。
- 定理候補の入力条件を答案・問題文から確認できない場合、適用条件を満たすと断定しないでください。DAGには確認できた式と証拠だけを記録します。

[DAG contract v2.2.0]
Graphには次のフィールドを必ず含めてください。
- contract_version: "2.2.0"
- nodes: ノード配列
- edges: 有向辺配列
- symbol_registry: この問題・答案に固有のシンボル登録簿
- evidence_sources: 与件・答案記述の根拠一覧

【ノード共通】
- idはgraph内で一意な文字列にしてください。
- typeはproposition / theorem / inferenceのいずれかです。
- sub_questionは従来どおり設定してください（小問がない場合は"共通"）。
- is_final_answerは従来どおりbooleanで設定してください。

【propositionノード】
- id, type, label, formula_astを含めてください。theorem_idはnullにしてください。
- labelは答案または問題文に基づく命題の表示です。
- formula_astは下記AST仕様に従ってください。
- ASTへ安全に変換できない文章的命題、判読不能な式、登録語彙で表現できない内容では、formula_astをnullにしてください。未知の述語や関数を創作してはいけません。
- validity_scopeは根拠がある場合のみ設定し、値はpointwise / throughout_motion_domain / interval / unspecifiedのいずれかです。
- scope_evidenceは、その範囲が問題文・答案のどの記述に基づくかを示すevidence_sourcesのID配列です。根拠がなければ空配列にしてください。
- provenanceにはsource_kindとsource_idsを記録してください。source_kindはproblem_statement / answer / derivedのいずれかです。
- is_final_answer等の既存UIフィールドも保持してください。

【inferenceノード】
- id, type, theorem_idを必ず含めてください。formula_astはnullにしてください。
- label, sub_question, is_final_answer, inputs_used, outputs_derivedも従来どおり保持してください。
- theorem_idは使用した定理カタログのIDと完全一致させてください。
- subject_symbol_idは対象物体を答案・問題文から一意に対応づけられる場合だけ設定してください。
- construction_processの各ステップとDAGのノード・辺は矛盾しないようにしてください。

【theoremノード】
- id, type, theorem_id, label, sub_question, is_final_answerを含めてください。formula_astはnullにしてください。
- theorem_idとlabelは定理カタログに完全一致させてください。
- theoremノードは表示・参照用です。推論の実行対象は対応するinferenceノードのtheorem_idです。

【symbol_registry】
- registry_idとsymbolsを含めてください。
- symbolsは答案・問題文中に現れる、または明示的に定義された物理量・対象物体だけを登録してください。
- 各symbolはsymbol_id, display_name, sort, semantic_roleを含めてください。
- sortはReal / Bool / Object / Timeから選んでください。
- semantic_roleは、下記の許可されたrole_id、またはunresolvedを設定してください。
- 変数名の見た目、単位、次元、式の形だけからsemantic_roleを確定してはいけません。意味が根拠から明らかな場合のみ候補を設定し、曖昧ならunresolvedにしてください。
- 必要に応じてsubject_symbol_id, temporal_behavior, unit, physical_dimension, semantic_role_evidenceを設定してください。
- temporal_behaviorはconstant / time_dependent / unspecifiedから選んでください。答案・問題文に根拠がなければunspecifiedです。
- K>0、質量が正、摩擦なし等の物理的仮定をsymbol_registryへ勝手に埋め込んではいけません。明示された条件はpropositionとして記録してください。
- symbol_idは一意にし、display_nameの一致だけで異なる記号を同一視してはいけません。

【evidence_sources】
- 各要素はid, source_kind, textを含めてください。
- source_kindはproblem_statement / given_fact / derived_fact / physics_libraryから選んでください。
- textには画像から実際に読み取れる短い根拠記述を記録してください。
- 問題文・答案にない事実を根拠として作ってはいけません。
- physics_libraryを使う場合は、該当する定理IDとその適用対象を明記してください。
- evidence_sourcesのIDはgraph内で一意にしてください。

[formula_ast仕様]
ASTはJSONオブジェクトで、各ノードにkindを設定してください。

式ノード:
- symbol: {"kind":"symbol","symbol_id":"登録済みsymbol_id"}
- rational: {"kind":"rational","numerator":整数,"denominator":0以外の整数}
- constant: {"kind":"constant","name":"pi"}
- function: {"kind":"function","name":"登録済み関数名","args":[式AST...]}
- add: {"kind":"add","args":[式AST,式AST,...]}
- sub: {"kind":"sub","left":式AST,"right":式AST}
- mul: {"kind":"mul","args":[式AST,式AST,...]}
- div: {"kind":"div","numerator":式AST,"denominator":式AST}
- pow_int: {"kind":"pow_int","base":式AST,"exponent":整数}
- sqrt: {"kind":"sqrt","argument":式AST}
- sin / cos: {"kind":"sin"または"cos","argument":式AST}

論理式ノード:
- eq / neq / lt / le / gt / ge: {"kind":"eq","lhs":式AST,"rhs":式AST}（kindは対応する演算子）
- predicate: {"kind":"predicate","name":"登録済み述語名","args":[式AST...]}
- and / or: {"kind":"and"または"or","args":[論理AST,...]}
- not: {"kind":"not","argument":論理AST}

DAGのformula_astでは、問題固有の記号は必ずsymbolノードで参照してください。parameterは定理テンプレート専用であり、DAGでは使用禁止です。variableは量化された束縛変数専用であり、通常の答案記号には使用禁止です。

この段階ではformula_astを構文的に生成するだけです。物理的な意味役割、正値性、定数性、運動範囲全体での成立、定理適用の正しさを独断で証明してはいけません。

[許可された意味役割ID]
${semanticRoleCatalogString}

[利用可能な物理関数・述語]
${physicalVocabularyCatalogString}

[出力形式]
JSONのみを出力してください。Markdownコードフェンスや説明文を付けないでください。

[定理カタログ]
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
                contract_version: { type: 'STRING', enum: ['2.2.0'] },
                symbol_registry: {
                  type: 'OBJECT',
                  properties: {
                    registry_id: { type: 'STRING' },
                    symbols: {
                      type: 'ARRAY',
                      items: {
                        type: 'OBJECT',
                        properties: {
                          symbol_id: { type: 'STRING' },
                          display_name: { type: 'STRING' },
                          sort: { type: 'STRING', enum: ['Real', 'Bool', 'Object', 'Time'] },
                          semantic_role: { type: 'STRING' },
                          subject_symbol_id: { type: 'STRING', nullable: true },
                          temporal_behavior: { type: 'STRING', enum: ['constant', 'time_dependent', 'unspecified'], nullable: true },
                          unit: { type: 'STRING', nullable: true },
                          physical_dimension: { type: 'ARRAY', items: { type: 'INTEGER' }, nullable: true },
                          semantic_role_evidence: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true }
                        },
                        required: ['symbol_id', 'display_name', 'sort', 'semantic_role']
                      }
                    }
                  },
                  required: ['registry_id', 'symbols']
                },
                evidence_sources: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      id: { type: 'STRING' },
                      source_kind: { type: 'STRING', enum: ['problem_statement', 'given_fact', 'derived_fact', 'physics_library'] },
                      text: { type: 'STRING' }
                    },
                    required: ['id', 'source_kind', 'text']
                  }
                },
                nodes: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      id: { type: 'STRING' },
                      type: { type: 'STRING', enum: ['proposition', 'theorem', 'inference'] },
                      label: { type: 'STRING' },
                      theorem_id: { type: 'STRING', nullable: true },
                      sub_question: { type: 'STRING' },
                      is_final_answer: { type: 'BOOLEAN' },
                      inputs_used: { type: 'OBJECT', nullable: true },
                      outputs_derived: { type: 'OBJECT', nullable: true },
                      subject_symbol_id: { type: 'STRING', nullable: true },
                      formula_ast: { type: 'OBJECT', nullable: true },
                      validity_scope: { type: 'STRING', enum: ['pointwise', 'throughout_motion_domain', 'interval', 'unspecified'], nullable: true },
                      scope_evidence: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
                      provenance: {
                        type: 'OBJECT',
                        properties: {
                          source_kind: { type: 'STRING', enum: ['problem_statement', 'answer', 'derived'] },
                          source_ids: { type: 'ARRAY', items: { type: 'STRING' } }
                        },
                        required: ['source_kind', 'source_ids'],
                        nullable: true
                      }
                    },
                    required: ['id', 'type', 'label', 'sub_question', 'theorem_id', 'formula_ast']
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
              required: ['contract_version', 'symbol_registry', 'evidence_sources', 'nodes', 'edges']
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

    // --- パース済みデータのデータ構造・文字列サニタイズ処理 ---
    // TODO(DAG v2.2): formula_ast の再帰validatorを logic_schema.json v2.2.0 に
    // 照らして実装する。現時点ではこのrouteでASTの意味・型安全性を保証しない。
    if (parsedData && parsedData.graph && Array.isArray(parsedData.graph.nodes)) {
      parsedData.graph.nodes = parsedData.graph.nodes.map((node: any) => {
        if (typeof node.label === 'string') {
          node.label = node.label.replace(/[\x00-\x1F\x7F]/g, '');
        }

        ['inputs_used', 'outputs_derived'].forEach((key) => {
          if (typeof node[key] === 'string') {
            try {
              node[key] = JSON.parse(node[key]);
            } catch {
              node[key] = { value: node[key] };
            }
          }
        });

        return node;
      });
    }

    // theoremノードが接続されていないinferenceに限り、代数定理ノードを補填する。
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
            node.theorem_id = 'algebraic_simplification';
            additionalNodes.push({
              id: newTheoremId,
              type: 'theorem',
              theorem_id: 'algebraic_simplification',
              label: '代数計算・連立方程式の消去',
              sub_question: node.sub_question || '共通',
              is_final_answer: false
            });
            edges.push({ from: newTheoremId, to: node.id });
          }
        }
      });

      parsedData.graph.nodes = [...currentNodes, ...additionalNodes];
    }

    let dbSaveError: any = null;
    if (parsedData && parsedData.graph) {
      try {
        const { data: existing } = await supabase
          .from('logic_graphs')
          .select('id, preserved')
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
          if (existing.preserved) {
            console.log(`[Info] post_id: ${answerId} は preserved が有効なため、更新をスキップしました。`);
          } else {
            const { error } = await supabase.from('logic_graphs').update(payload).eq('id', existing.id);
            if (error) dbSaveError = error;
          }
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
      error: 'APIリクエストで致命的なエラーが発生しました',
      details: err?.message || String(err)
    }, { status: 500 });
  }
}