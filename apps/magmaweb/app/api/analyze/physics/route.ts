import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { supabase } from '../../../../lib/supabase';
import physicsLibrary from '../../../../lib/constants/physics.json';

export const maxDuration = 300;

const physicsData: any = physicsLibrary;
const theoremVersion = physicsData?.version || '2.4.2';
const PROMPT_VERSION = `${theoremVersion}_dag_v2_2_hybrid_ast_evidence_v2_gemini38_low`;
const GEMINI_MODEL = 'gemini-3.8-flash';
const GEMINI_THINKING_LEVEL = 'LOW' as const;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

type AstNormalization = {
  propositions: Array<{
    node_id: string;
    formula_ast: Record<string, unknown> | null;
    status: 'validated_by_parser' | 'validated_by_parser_and_ai' | 'candidate_unconfirmed' | 'unknown';
    reason?: string;
  }>;
};

async function generateWithRetry(params: any, maxRetries = 5, initialDelayMs = 2000) {
  let delay = initialDelayMs;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const isOverloaded = err?.status === 503 || errMsg.includes('high demand') ||
        errMsg.includes('UNAVAILABLE') || errMsg.includes('503') ||
        err?.status === 429 || errMsg.includes('429');
      if (isOverloaded && attempt < maxRetries) {
        console.warn(`[Gemini API Overloaded] リトライ (${attempt}/${maxRetries})... ${delay}ms待機`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      } else throw err;
    }
  }
}

// JSONの途中切れを「正しい数式」として受け入れない。
// 構文修復は既存処理の互換用だが、後続の構造検査は常に行う。
function repairTruncatedJson(jsonStr: string): string {
  let cleaned = jsonStr.trim();
  const lastValidIndex = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'), cleaned.lastIndexOf('"'));
  if (lastValidIndex !== -1 && lastValidIndex < cleaned.length - 1) cleaned = cleaned.slice(0, lastValidIndex + 1);
  cleaned = cleaned.replace(/,\s*"[^"]*"\s*:\s*"?[^"]*$/, '').replace(/,\s*$/, '');
  let inString = false, escape = false;
  const stack: string[] = [];
  for (const char of cleaned) {
    if (escape) { escape = false; continue; }
    if (char === '\\') { escape = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (!inString) {
      if (char === '{' || char === '[') stack.push(char);
      else if (char === '}' && stack[stack.length - 1] === '{') stack.pop();
      else if (char === ']' && stack[stack.length - 1] === '[') stack.pop();
    }
  }
  if (inString) cleaned += '"';
  while (stack.length) cleaned += stack.pop() === '{' ? '}' : ']';
  return cleaned;
}

function assertGraphShape(graph: any) {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges) ||
      !Array.isArray(graph.symbol_registry?.symbols) || !Array.isArray(graph.evidence_sources)) {
    throw new Error('Geminiの出力がDAG v2.2の必須構造を満たしていません');
  }
  const ids = new Set<string>();
  for (const node of graph.nodes) {
    if (!node || typeof node.id !== 'string' || ids.has(node.id) ||
        !['proposition', 'theorem', 'inference'].includes(node.type)) {
      throw new Error('DAGに不正または重複したノードがあります');
    }
    ids.add(node.id);
  }
  const seenEdges = new Set<string>();
  for (const edge of graph.edges) {
    const key = JSON.stringify([edge.from, edge.to]);
    if (!ids.has(edge.from) || !ids.has(edge.to) || seenEdges.has(key)) {
      throw new Error('DAGに参照不明または重複した辺があります');
    }
    seenEdges.add(key);
  }
  // Cycle detection. Without this an output node can be its own premise.
  const indegree = new Map([...ids].map(id => [id, 0]));
  const outgoing = new Map([...ids].map(id => [id, [] as string[]]));
  for (const edge of graph.edges) {
    indegree.set(edge.to, (indegree.get(edge.to) || 0) + 1);
    outgoing.get(edge.from)!.push(edge.to);
  }
  const q = [...ids].filter(id => indegree.get(id) === 0);
  let visited = 0;
  while (q.length) {
    const id = q.pop()!; visited++;
    for (const next of outgoing.get(id) || []) {
      indegree.set(next, (indegree.get(next) || 0) - 1);
      if (indegree.get(next) === 0) q.push(next);
    }
  }
  if (visited !== ids.size) throw new Error('DAGに循環が存在します');
}

async function normalizePropositions(graph: any): Promise<string | null> {
  const url = process.env.SYMPY_API_URL;
  if (!url) {
    for (const n of graph.nodes) if (n.type === 'proposition') n.ast_validation = 'unknown';
    return 'SYMPY_API_URL未設定: ASTは未検証です';
  }
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/api/normalize_ast`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ graph }), cache: 'no-store', signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) throw new Error(`normalizer HTTP ${response.status}`);
    const data = await response.json() as AstNormalization;
    const byId = new Map(data.propositions.map(p => [p.node_id, p]));
    for (const n of graph.nodes) {
      if (n.type !== 'proposition') continue;
      const r = byId.get(n.id);
      n.formula_ast = r?.formula_ast ?? null;
      n.ast_validation = r?.status ?? 'unknown';
      n.ast_validation_reason = r?.reason ?? null;
    }
    return null;
  } catch (err: any) {
    for (const n of graph.nodes) if (n.type === 'proposition') n.ast_validation = 'unknown';
    return `AST正規化APIの呼び出しに失敗: ${err.message || String(err)}`;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const answerId = searchParams.get('answerId');
  if (!answerId) return NextResponse.json({ error: 'Missing answerId' }, { status: 400 });

  // 計測単位はミリ秒。モデル入力・答案・URL・APIキーなどの内容は記録しない。
  const requestId = crypto.randomUUID();
  const requestStartedAt = performance.now();
  let previousStageAt = requestStartedAt;
  const logStage = (stage: string, details: Record<string, string | number | boolean | null> = {}) => {
    const now = performance.now();
    console.info('[PhysicsAnalyzeTiming]', JSON.stringify({
      requestId,
      stage,
      elapsedMs: Math.round(now - requestStartedAt),
      stepMs: Math.round(now - previousStageAt),
      ...details
    }));
    previousStageAt = now;
  };
  logStage('request_started', { model: GEMINI_MODEL, thinkingLevel: GEMINI_THINKING_LEVEL });

  try {
    const { data: answer, error: answerError } = await supabase.from('posts')
      .select('id, image_url, parent_id').eq('id', answerId).single();
    if (answerError || !answer?.image_url) {
      console.error('[API Error] 答案画像URL取得失敗:', answerError);
      return NextResponse.json({ error: '答案画像URLを取得できませんでした' }, { status: 404 });
    }
    let problemImageUrl = answer.image_url;
    if (answer.parent_id) {
      const { data: problem } = await supabase.from('posts').select('image_url')
        .eq('id', answer.parent_id).maybeSingle();
      if (problem?.image_url) problemImageUrl = problem.image_url;
    }

    // preserved=true の既存グラフは上書きしない。
    const { data: existingGraph } = await supabase.from('logic_graphs')
      .select('graph_data, construction_process, prompt_version, theorem_version, preserved')
      .eq('post_id', answerId).maybeSingle();
    if (existingGraph) {
      const isVersionMatch = existingGraph.prompt_version === PROMPT_VERSION &&
        existingGraph.theorem_version === theoremVersion;
      if (existingGraph.preserved || isVersionMatch) {
        logStage('cache_hit', { preserved: Boolean(existingGraph.preserved) });
        return NextResponse.json({
          imageUrl: answer.image_url, graph: existingGraph.graph_data,
          constructionProcess: existingGraph.construction_process,
          metadata: { promptVersion: existingGraph.prompt_version,
            theoremVersion: existingGraph.theorem_version,
            cached: true, preserved: existingGraph.preserved }
        });
      }
    }

    // Geminiには物理定理の識別用情報だけを渡す。FOL/Z3実装は渡さない。
    const geminiTheoremCatalog = (physicsData?.theorems || [])
      .filter((t: any) => t.verification_metadata?.status !== 'legacy_alias')
      .map((t: any) => {
        const d = t.prompt_data || {};
        return { id: t.id, name: t.name, category: d.type || 'unknown',
          variables: d.variables || {}, inputs: d.inputs || {}, outputs: d.outputs || {} };
      });
    const theoremListString = JSON.stringify(geminiTheoremCatalog);
    const [problemRes, answerRes] = await Promise.all([fetch(problemImageUrl), fetch(answer.image_url)]);
    if (!problemRes.ok || !answerRes.ok) {
      return NextResponse.json({ error: '画像の取得に失敗しました',
        details: `Problem HTTP ${problemRes.status}, Answer HTTP ${answerRes.status}` }, { status: 500 });
    }
    const [problemBuffer, answerBuffer] = await Promise.all([problemRes.arrayBuffer(), answerRes.arrayBuffer()]);
    const problemBase64 = Buffer.from(problemBuffer).toString('base64');
    const answerBase64 = Buffer.from(answerBuffer).toString('base64');
    const problemMimeType = problemRes.headers.get('content-type') || 'image/jpeg';
    const answerMimeType = answerRes.headers.get('content-type') || 'image/jpeg';
    logStage('images_ready', { problemBytes: problemBuffer.byteLength, answerBytes: answerBuffer.byteLength });

    const semanticRoleCatalog = (physicsData?.semantic_roles?.roles || []).map((r: any) => ({
      role_id: r.role_id, description: r.description, expected_sort: r.expected_sort
    }));
    const physicalVocabularyCatalog = {
      functions: (physicsData?.physical_vocabulary?.functions || []).map((f: any) => ({
        name: f.name, args: f.args, returns: f.returns, meaning: f.meaning
      })),
      predicates: (physicsData?.physical_vocabulary?.predicates || []).map((p: any) => ({
        name: p.name, args: p.args, meaning: p.meaning
      }))
    };

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
   - 使用した命題node_idをinputs_used.node_ids、導出した命題node_idをoutputs_derived.node_idsへ必ず記録してください。

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
Graphにはcontract_version="2.2.0", nodes, edges, symbol_registry, evidence_sourcesを必ず含めてください。edgesのキーはfrom/toです。
idは全ノードで一意、typeはproposition / theorem / inference。sub_questionを小問ごとに設定し、is_final_answerは答案上の最終答のみtrue。

【propositionノード】
- labelは表示用の文章・LaTeXのまま正確に記録してください。
- 数式が1つ特定できる場合、math_exprに数式部分のみをLaTeXで入れてください（両辺を含む式：例 F_{net}=-Sgx）。数式でない場合null。
- formula_ast_jsonは任意のAI候補です。ASTを確実に書ける場合だけ、JSONオブジェクトをシリアライズした文字列を入れてください。難しい場合はnullにしてください。
- AI候補は後でプログラムがLaTeXを独立解析し、照合します。候補のJSONを正しいと断定してはいけません。
- validity_scopeはpointwise / throughout_motion_domain / interval / unspecified。根拠不明ならunspecified。
- scope_evidenceはその成立範囲を裏づけるevidence_sourcesのID配列。根拠がなければ[]。
- provenanceはsource_kind（problem_statement / answer / derived）とsource_ids（evidence_sourcesのID）を記録してください。
- 答案が導出した式を、検証前に独立した与件として扱わないでください。

【inferenceノード】
- label、theorem_id、inputs_used、outputs_derived、subject_symbol_idを記録してください。
- 入力・出力のnode_idsとgraph.edgesの接続は必ず対応させてください。
- 1つのinferenceで単振動の同定、復元力定数Kの係数比較、周期の計算をまとめないでください。答案に実際に書かれた段階を別ノードにします。

【theoremノード】
- id、theorem_id、labelは定理カタログのcanonical定義と一致させてください。
- inferenceに使用したtheoremノードをtheorem→inferenceで接続してください。

【symbol_registry】
- registry_idとsymbols配列。各symbolはsymbol_id, display_name, sort, semantic_roleを含めてください。
- sortはReal / Bool / Object / Time。semantic_roleは許可role_idまたはunresolved。
- roleの根拠は問題文の記載、記号の定義、検証済みの先行推論に求めてください。
- semantic_role_evidenceには根拠となるevidence_sourcesのIDを入れてください。証拠なしなら[]。
- たとえばxが単なる位置座標か、つりあい位置からの変位かを曖昧にしないでください。
- 時間依存と位置依存を混同しないでください。temporal_behaviorはconstant/time_dependent/unspecifiedのみ。分からなければunspecified。
- K>0や摩擦なし等を暗黙の前提としてsymbol_registryへ追加せず、画像に明示されていればproposition化してください。
- 各記号のdisplay_nameはLaTeXパーサーが読める簡潔な表記を優先します。symbol_idは一意にしてください。

【evidence_sourcesと循環防止】
- id, source_kind, textを記録してください。source_kindはproblem_statement / given_fact / derived_fact / physics_library。
- derived_factには元となるsource_node_idsを付与してください。答案自身の結論は独立した与件ではありません。
- 今まさに検証する推論の結論を、その推論の適用条件の証拠に使用してはいけません。
- 物理定理の利用には定理カタログのidを参照してください。問題に書いていない条件を法則から勝手に補わないでください。

【単振動の厳密化】
- 単振動同定は対象物体の合力F_netと、つりあい位置からの変位xi（またはx-x0）についての関係です。
- F_net=-Kxi、K>0、運動領域全体での成立、Kの時間一定性、対象物体との対応が必要です。
- 物理的に判定できない条件を捏造せず、scope_evidenceを具体的に記録してください。
- 単振動定理の結論はSimpleHarmonicMotion(object)のみ。Kの係数抽出は別の代数操作、周期公式の適用は別の物理定理です。
- 「ma=-Kx」を単振動同定定理の直接入力にしてはいけません。合力の関係を別の推論で導く必要があります。

【AIによるAST候補の書き方（任意）】
式F_{net}=-Kxの候補:
{"kind":"eq","lhs":{"kind":"symbol","symbol_id":"F_net"},"rhs":{"kind":"mul","args":[{"kind":"rational","numerator":-1,"denominator":1},{"kind":"symbol","symbol_id":"K"},{"kind":"symbol","symbol_id":"x"}]}}
kindはeq/neq/lt/le/gt/ge、symbol、rational、constant、add、sub、mul、div、pow_int、sqrt、sin、cosを使用できます。
AST候補を出すために画像に書かれていない式を補わないこと。候補がない場合、formula_ast_json=nullです。

[許可された意味役割ID]
${JSON.stringify(semanticRoleCatalog)}

[利用可能な物理関数・述語]
${JSON.stringify(physicalVocabularyCatalog)}

[出力形式]
JSONのみを出力してください。Markdownコードフェンスや説明文を付けないでください。

[定理カタログ]
${theoremListString}
`.trim();

    logStage('gemini_call_started', { model: GEMINI_MODEL, thinkingLevel: GEMINI_THINKING_LEVEL });
    const response = await generateWithRetry({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts: [
        { text: '【1枚目画像: 問題文】' },
        { inlineData: { mimeType: problemMimeType, data: problemBase64 } },
        { text: '【2枚目画像: 解答答案】' },
        { inlineData: { mimeType: answerMimeType, data: answerBase64 } },
        { text: promptText }
      ] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT', properties: {
            graph: { type: 'OBJECT', properties: {
              contract_version: { type: 'STRING', enum: ['2.2.0'] },
              symbol_registry: { type: 'OBJECT', properties: {
                registry_id: { type: 'STRING' },
                symbols: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
                  symbol_id: { type: 'STRING' }, display_name: { type: 'STRING' },
                  sort: { type: 'STRING', enum: ['Real','Bool','Object','Time'] },
                  semantic_role: { type: 'STRING' },
                  subject_symbol_id: { type: 'STRING', nullable: true },
                  temporal_behavior: { type: 'STRING', enum: ['constant','time_dependent','unspecified'], nullable: true },
                  unit: { type: 'STRING', nullable: true },
                  physical_dimension: { type: 'ARRAY', items: { type: 'INTEGER' }, nullable: true },
                  semantic_role_evidence: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true }
                }, required: ['symbol_id','display_name','sort','semantic_role'] } }
              }, required: ['registry_id','symbols'] },
              evidence_sources: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
                id: { type: 'STRING' },
                source_kind: { type: 'STRING', enum: ['problem_statement','given_fact','derived_fact','physics_library'] },
                text: { type: 'STRING' },
                source_node_ids: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true }
              }, required: ['id','source_kind','text'] } },
              nodes: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
                id: { type: 'STRING' },
                type: { type: 'STRING', enum: ['proposition','theorem','inference'] },
                label: { type: 'STRING' },
                theorem_id: { type: 'STRING', nullable: true },
                sub_question: { type: 'STRING' }, is_final_answer: { type: 'BOOLEAN' },
                math_expr: { type: 'STRING', nullable: true },
                formula_ast_json: { type: 'STRING', nullable: true },
                inputs_used: { type: 'OBJECT', properties: {
                  node_ids: { type: 'ARRAY', items: { type: 'STRING' } },
                  expressions: { type: 'ARRAY', items: { type: 'STRING' } }
                }, required: ['node_ids', 'expressions'], nullable: true },
                outputs_derived: { type: 'OBJECT', properties: {
                  node_ids: { type: 'ARRAY', items: { type: 'STRING' } },
                  expressions: { type: 'ARRAY', items: { type: 'STRING' } }
                }, required: ['node_ids', 'expressions'], nullable: true },
                subject_symbol_id: { type: 'STRING', nullable: true },
                validity_scope: { type: 'STRING', enum: ['pointwise','throughout_motion_domain','interval','unspecified'], nullable: true },
                scope_evidence: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
                provenance: { type: 'OBJECT', properties: {
                  source_kind: { type: 'STRING', enum: ['problem_statement','answer','derived'] },
                  source_ids: { type: 'ARRAY', items: { type: 'STRING' } }
                }, required: ['source_kind','source_ids'], nullable: true }
              }, required: ['id','type','label','sub_question','is_final_answer','theorem_id'] } },
              edges: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
                from: { type: 'STRING' }, to: { type: 'STRING' }
              }, required: ['from','to'] } }
            }, required: ['contract_version','symbol_registry','evidence_sources','nodes','edges'] },
            construction_process: { type: 'ARRAY', items: { type: 'STRING' } }
          }, required: ['graph','construction_process']
        },
        temperature: 0.1,
        maxOutputTokens: 16384,
        thinkingConfig: { thinkingLevel: GEMINI_THINKING_LEVEL }
      }
    });

    logStage('gemini_response_received', {
      responseCharacters: response?.text?.length ?? 0,
      promptTokenCount: response?.usageMetadata?.promptTokenCount ?? null,
      candidatesTokenCount: response?.usageMetadata?.candidatesTokenCount ?? null,
      thoughtsTokenCount: response?.usageMetadata?.thoughtsTokenCount ?? null
    });

    const rawText = response?.text || '';
    let parsedData: any;
    let cleanText = rawText.trim();
    if (cleanText.startsWith('```json')) cleanText = cleanText.replace(/^```json/, '').replace(/```$/, '').trim();
    else if (cleanText.startsWith('```')) cleanText = cleanText.replace(/^```/, '').replace(/```$/, '').trim();
    try {
      parsedData = JSON.parse(cleanText);
    } catch {
      try { parsedData = JSON.parse(repairTruncatedJson(cleanText)); }
      catch {
        return NextResponse.json({ error: 'Geminiの出力データがJSONとして不適正です', rawText }, { status: 500 });
      }
    }
    const graph = parsedData?.graph;
    assertGraphShape(graph);
    graph.contract_version = '2.2.0';
    const theoremById = new Map<string, any>((physicsData?.theorems || []).map((t: any) => [t.id, t]));
    const evidenceIds = new Set(graph.evidence_sources.map((x: any) => x.id));
    const symbolIds = new Set(graph.symbol_registry.symbols.map((x: any) => x.symbol_id));
    const allowedRoles = new Set((physicsData?.semantic_roles?.roles || []).map((r: any) => r.role_id));
    const allowedSorts = new Set(['Real', 'Bool', 'Object', 'Time']);
    const symbolIdList = graph.symbol_registry.symbols.map((x: any) => x.symbol_id);
    if (symbolIds.size !== symbolIdList.length ||
        graph.symbol_registry.symbols.some((x: any) =>
          typeof x.symbol_id !== 'string' || !allowedSorts.has(x.sort))) {
      throw new Error('symbol_registry のsymbol_idが重複またはsortが不正です');
    }
    for (const symbol of graph.symbol_registry.symbols) {
      const rawEvidence = Array.isArray(symbol.semantic_role_evidence) ? symbol.semantic_role_evidence : [];
      const independentEvidence = rawEvidence.filter((id: string) =>
        evidenceIds.has(id) && graph.evidence_sources.some((e: any) =>
          e.id === id && ['problem_statement', 'given_fact'].includes(e.source_kind)));
      symbol.semantic_role_evidence = rawEvidence.filter((id: string) => evidenceIds.has(id));
      if (!allowedRoles.has(symbol.semantic_role) || independentEvidence.length === 0) {
        symbol.semantic_role = 'unresolved';
        symbol.semantic_role_validation = 'unknown';
      } else symbol.semantic_role_validation = 'candidate_grounded_in_given';
    }
    for (const ev of graph.evidence_sources) {
      if (ev.source_kind === 'derived_fact' &&
          (!Array.isArray(ev.source_node_ids) || ev.source_node_ids.length === 0)) {
        ev.evidence_validation = 'unconfirmed_derived_fact';
      }
    }

    // 元々の行単位のノードや表示用LaTeXは維持し、検証用メタデータだけ正規化する。
    for (const node of graph.nodes) {
      if (typeof node.label === 'string') node.label = node.label.replace(/[\x00-\x1F\x7F]/g, '');
      if (node.type === 'proposition') {
        node.formula_ast = null;
        if (typeof node.formula_ast_json === 'string') {
          try { node.formula_ast = JSON.parse(node.formula_ast_json); } catch { node.formula_ast = null; }
        }
        delete node.formula_ast_json;
        node.ast_validation = 'unknown';
        if (!node.provenance || !Array.isArray(node.provenance.source_ids) ||
            !node.provenance.source_ids.every((id: string) => evidenceIds.has(id))) {
          node.provenance = null;
          node.provenance_validation = 'unknown';
        }
        node.scope_evidence = Array.isArray(node.scope_evidence) ?
          node.scope_evidence.filter((id: string) => evidenceIds.has(id)) : [];
        node.validity_scope = node.validity_scope || 'unspecified';
        if (node.validity_scope !== 'unspecified' && node.scope_evidence.length === 0) {
          node.validity_scope = 'unspecified';
          node.scope_validation = 'unknown';
        }
      } else node.formula_ast = null;
      if (node.type === 'inference') {
        for (const key of ['inputs_used', 'outputs_derived']) {
          if (typeof node[key] === 'string') {
            try { node[key] = JSON.parse(node[key]); } catch { node[key] = { value: node[key] }; }
          }
          if (!node[key] || typeof node[key] !== 'object') node[key] = {};
          if (!Array.isArray(node[key].node_ids)) node[key].node_ids = [];
          if (!Array.isArray(node[key].expressions)) node[key].expressions = [];
        }
        if (node.subject_symbol_id && !symbolIds.has(node.subject_symbol_id)) node.subject_symbol_id = null;
      }
      if (node.type === 'theorem') {
        const t = theoremById.get(node.theorem_id);
        if (t && t.verification_metadata?.status !== 'legacy_alias') node.label = t.name;
      }
    }

    // Existing fallback: inference without an incoming theorem gets an algebraic theorem.
    // Preserve legacy UI behavior, but record that the ID is a fallback, not confirmed physics.
    const currentNodes = [...graph.nodes];
    const additionalNodes: any[] = [];
    const usedIds = new Set(currentNodes.map((n: any) => n.id));
    let autoTheoremCount = 1;
    for (const node of currentNodes) {
      if (node.type !== 'inference') continue;
      const hasTheorem = graph.edges.some((e: any) => e.to === node.id &&
        currentNodes.some((n: any) => n.id === e.from && n.type === 'theorem'));
      if (hasTheorem) continue;
      let newTheoremId = `t_auto_${autoTheoremCount++}`;
      while (usedIds.has(newTheoremId)) newTheoremId = `t_auto_${autoTheoremCount++}`;
      usedIds.add(newTheoremId);
      node.theorem_id_original = node.theorem_id || null;
      node.theorem_id = 'algebraic_simplification';
      node.theorem_assignment = 'fallback_unconfirmed';
      additionalNodes.push({ id: newTheoremId, type: 'theorem',
        theorem_id: 'algebraic_simplification', label: '代数計算・連立方程式の消去',
        sub_question: node.sub_question || '共通', is_final_answer: false, formula_ast: null });
      graph.edges.push({ from: newTheoremId, to: node.id });
    }
    graph.nodes.push(...additionalNodes);
    assertGraphShape(graph);
    // Rebuild node references from actual edges, not from AI-provided free text.
    // This records the dependency already present in the graph; no new step is invented.
    const nodeById = new Map<string, any>(graph.nodes.map((n: any) => [n.id, n]));
    for (const inf of graph.nodes.filter((n: any) => n.type === 'inference')) {
      const inputIds = graph.edges.filter((e: any) => e.to === inf.id &&
        nodeById.get(e.from)?.type === 'proposition').map((e: any) => e.from);
      const outputIds = graph.edges.filter((e: any) => e.from === inf.id &&
        nodeById.get(e.to)?.type === 'proposition').map((e: any) => e.to);
      inf.inputs_used.node_ids = inputIds;
      inf.outputs_derived.node_ids = outputIds;
      inf.inputs_used.expressions = inputIds.map((id: string) =>
        nodeById.get(id)?.math_expr || nodeById.get(id)?.label || '');
      inf.outputs_derived.expressions = outputIds.map((id: string) =>
        nodeById.get(id)?.math_expr || nodeById.get(id)?.label || '');
      inf.dependency_validation = inputIds.length > 0 && outputIds.length > 0
        ? 'connected' : 'incomplete';
    }
    logStage('dag_validated_and_formatted', {
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      propositionCount: graph.nodes.filter((n: any) => n.type === 'proposition').length
    });
    const astWarning = await normalizePropositions(graph);
    logStage('ast_normalization_completed', {
      astWarning: Boolean(astWarning),
      verifiedAstCount: graph.nodes.filter((n: any) =>
        n.type === 'proposition' && String(n.ast_validation).startsWith('validated_by_')).length
    });

    let dbSaveError: any = null;
    try {
      const { data: existing } = await supabase.from('logic_graphs')
        .select('id, preserved').eq('post_id', answerId).maybeSingle();
      const payload = { graph_data: graph, construction_process: parsedData.construction_process || [],
        status: 'unverified', prompt_version: PROMPT_VERSION, theorem_version: theoremVersion,
        updated_at: new Date().toISOString() };
      if (existing) {
        if (!existing.preserved) {
          const { error } = await supabase.from('logic_graphs').update(payload).eq('id', existing.id);
          if (error) dbSaveError = error;
        }
      } else {
        const { error } = await supabase.from('logic_graphs').insert({ post_id: answerId, ...payload });
        if (error) dbSaveError = error;
      }
    } catch (e: any) { dbSaveError = e; }
    logStage('supabase_save_completed', { saved: !dbSaveError, dbError: Boolean(dbSaveError) });
    return NextResponse.json({ imageUrl: answer.image_url, graph,
      constructionProcess: parsedData.construction_process || [],
      metadata: { promptVersion: PROMPT_VERSION, theoremVersion, cached: false,
        astWarning, verifiedAstCount: graph.nodes.filter((n: any) =>
          n.type === 'proposition' && String(n.ast_validation).startsWith('validated_by_')).length },
      dbSaved: !dbSaveError, dbError: dbSaveError?.message || null });
  } catch (err: any) {
    logStage('request_failed', { errorType: err?.name || 'Error' });
    console.error('[API Catch Error] 致命的エラーが発生しました:', err);
    return NextResponse.json({ error: 'APIリクエストで致命的なエラーが発生しました',
      details: err?.message || String(err) }, { status: 500 });
  }
}
