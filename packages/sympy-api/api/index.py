from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import sympy
from sympy.parsing.sympy_parser import parse_expr, standard_transformations, implicit_multiplication_application, convert_equals_signs, rationalize
import uuid

app = FastAPI()

# ==========================================
# 既存API: ヘルスチェック & 代数検証
# ==========================================
class VerifyRequest(BaseModel):
    expr1: str
    expr1_or: Optional[str] = None
    expr2: str
    domain: Optional[str] = None

@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "SymPy API is running"}

@app.post("/api/verify")
def verify_expressions(req: VerifyRequest):
    # (あなたが作成した既存のverifyロジック。長いため中略せずにそのまま入れます)
    try:
        transformations = standard_transformations + (implicit_multiplication_application, convert_equals_signs, rationalize)
        
        e1_and = parse_expr(req.expr1, transformations=transformations).doit()
        e1_or = parse_expr(req.expr1_or, transformations=transformations).doit() if req.expr1_or else None
        e2 = parse_expr(req.expr2, transformations=transformations).doit()

        def get_diff(expr):
            if isinstance(expr, sympy.core.relational.Relational):
                return expr.lhs - expr.rhs
            elif isinstance(expr, sympy.logic.boolalg.BooleanTrue) or expr is True:
                return sympy.Integer(0)
            elif isinstance(expr, sympy.logic.boolalg.BooleanFalse) or expr is False:
                return sympy.Integer(1)
            elif isinstance(expr, sympy.logic.boolalg.BooleanFunction):
                return None
            return expr

        diff1 = get_diff(e1_and)
        diff2 = get_diff(e2)
        is_eq = False
        
        if diff1 is not None and diff2 is not None:
            num1, _ = sympy.fraction(sympy.cancel(diff1))
            num2, _ = sympy.fraction(sympy.cancel(diff2))
            check1 = sympy.simplify(num1 - num2)
            check2 = sympy.simplify(num1 + num2)
            if check1.is_zero or check1 == 0 or check2.is_zero or check2 == 0:
                is_eq = True

        if not is_eq:
            domain_expr = None
            if req.domain:
                try:
                    domain_expr = parse_expr(req.domain, transformations=transformations).doit()
                except:
                    pass

            vars1 = e1_and.free_symbols if hasattr(e1_and, 'free_symbols') else set()
            vars2 = e2.free_symbols if hasattr(e2, 'free_symbols') else set()
            if e1_or:
                vars_or = e1_or.free_symbols if hasattr(e1_or, 'free_symbols') else set()
                vars1 = vars1.union(vars_or)
                
            all_vars = list(vars1.union(vars2))
            
            if all_vars:
                test_points = [
                    sympy.Rational(-101, 10), sympy.Rational(-3, 1), sympy.Rational(-1, 1),
                    sympy.Rational(-1, 2), sympy.Rational(0, 1), sympy.Rational(1, 1),
                    sympy.Rational(19, 10), sympy.Rational(2, 1), sympy.Rational(21, 10),
                    sympy.Rational(5, 2), sympy.Rational(8, 3), sympy.Rational(27, 10),
                    sympy.Rational(3, 1), sympy.Rational(101, 10)
                ]
                
                for e1_test in [e1_and, e1_or]:
                    if e1_test is None:
                        continue
                        
                    points_matched = True
                    valid_test_count = 0
                    
                    for pt in test_points:
                        try:
                            subs_dict = {v: pt + sympy.Rational(i, 10) for i, v in enumerate(all_vars)}
                            if domain_expr is not None:
                                if not bool(domain_expr.subs(subs_dict)):
                                    continue
                            val1 = bool(e1_test.subs(subs_dict))
                            val2 = bool(e2.subs(subs_dict))
                            
                            valid_test_count += 1
                            if val1 != val2:
                                points_matched = False
                                break
                        except Exception:
                            continue
                    
                    if points_matched and valid_test_count > 0:
                        is_eq = True
                        break

        return {"is_equal": is_eq}

    except Exception as e:
        return {"error": str(e)}

# ==========================================
# 既存API: DAGの連立方程式ソルバー（メンバー担当部分）
# ==========================================
class SolveRequest(BaseModel):
    formula_ast: list
    symbol_registry: dict
    target_unknowns: list
    dag_equations: list

def ast_to_sympy(ast_node, registry):
    if isinstance(ast_node, (int, float)):
        return sympy.sympify(ast_node)
    
    if isinstance(ast_node, str):
        try:
            float(ast_node)
            return sympy.sympify(ast_node)
        except ValueError:
            if ast_node in registry:
                display_name = registry[ast_node]["display_name"]
                return sympy.Symbol(display_name, positive=True)
            return sympy.Symbol(ast_node)
            
    if isinstance(ast_node, list) and len(ast_node) > 0:
        operator = ast_node[0]
        operands = [ast_to_sympy(child, registry) for child in ast_node[1:]]
        
        if operator == "Equal": return sympy.Eq(operands[0], operands[1])
        elif operator == "Add": return sympy.Add(*operands)
        elif operator == "Subtract": return operands[0] - operands[1]
        elif operator == "Multiply": return sympy.Mul(*operands)
        elif operator == "Divide": return operands[0] / operands[1]
        elif operator == "Power": return operands[0] ** operands[1]
        elif operator == "Sin": return sympy.sin(operands[0])
        elif operator == "Cos": return sympy.cos(operands[0])
        
    return ast_node

@app.post("/api/solve_dag")
def solve_dag_equations(req: SolveRequest):
    try:
        registry = req.symbol_registry.get("symbols", {})
        new_equation = ast_to_sympy(req.formula_ast, registry)
        
        transformations = standard_transformations + (implicit_multiplication_application, convert_equals_signs, rationalize)
        all_equations = [new_equation]
        for eq_str in req.dag_equations:
            all_equations.append(parse_expr(eq_str, transformations=transformations).doit())
            
        target_symbols = []
        for target_id in req.target_unknowns:
            if target_id in registry:
                target_symbols.append(sympy.Symbol(registry[target_id]["display_name"], positive=True))
            else:
                target_symbols.append(sympy.Symbol(target_id))
                
        solution = sympy.solve(all_equations, target_symbols, dict=True)
        
        is_fully_solved = False
        parsed_solution = {}
        if solution and len(solution) > 0:
            if all(sym in solution[0] for sym in target_symbols):
                is_fully_solved = True
                parsed_solution = {str(k): str(v) for k, v in solution[0].items()}

        return {
            "status": "valid",
            "new_equation_str": str(new_equation),
            "is_fully_solved": is_fully_solved,
            "solution": parsed_solution
        }
    except Exception as e:
        return {"status": "error", "error_message": str(e)}

# ==========================================
# 新規API: ステップバイステップ推論エンジン (あなたの担当部分)
# ==========================================
class SituationData(BaseModel):
    objects: Optional[List[Dict[str, Any]]] = []
    forces: Optional[List[Dict[str, Any]]] = []
    states: Optional[Dict[str, Any]] = {}
    motion_states: Optional[Dict[str, Any]] = {}
    coordinate_system: Optional[Dict[str, Any]] = {}

class StepByStepRequest(BaseModel):
    situation: SituationData
    applied_laws: List[str] = []

def ast_eq(lhs, rhs): return ["Equal", lhs, rhs]
def ast_add(*args): return ["Add", *args]
def ast_mul(*args): return ["Multiply", *args]

def create_inference_node(law_name: str, ast: list, inputs: Dict[str, str], derived_eq: str, justification: str) -> dict:
    return {
        "id": f"inf_{uuid.uuid4().hex[:8]}",
        "type": "inference",
        "label": law_name,
        "formula_ast": ast,
        "inputs_used": inputs,
        "outputs_derived": {"equation": derived_eq},
        "justification": justification
    }

@app.post("/api/get_next_node")
def get_next_node(req: StepByStepRequest):
    try:
        ai_data = req.situation.dict()
        applied = req.applied_laws
        candidate_nodes = []

        if ai_data.get("motion_states"):
            for axis, info in ai_data["motion_states"].items():
                state = info.get("state")
                f_net_sym = f"F_net_{axis}"
                
                law_label = f"{axis}方向の力のつりあい"
                if state == "stationary" and law_label not in applied:
                    node = create_inference_node(
                        law_name=law_label,
                        ast=ast_eq(0, f_net_sym),
                        inputs={"axis": axis, "net_force": f_net_sym},
                        derived_eq=f"0 = {f_net_sym}",
                        justification=f"物体が{axis}方向に静止しているため、{law_label}を立式する。"
                    )
                    candidate_nodes.append(node)
                    
                law_label = f"{axis}方向の運動方程式"
                if state == "accelerating" and law_label not in applied:
                    a_sym = info.get("acceleration_symbol", "a")
                    node = create_inference_node(
                        law_name=law_label,
                        ast=ast_eq(ast_mul("m", a_sym), f_net_sym),
                        inputs={"mass": "m", "acceleration": a_sym, "net_force": f_net_sym},
                        derived_eq=f"m * {a_sym} = {f_net_sym}",
                        justification=f"物体が{axis}方向に加速しているため、{law_label}を立式する。"
                    )
                    candidate_nodes.append(node)

        if not candidate_nodes:
            return {"status": "complete", "message": "適用できる定理はありません。"}
            
        return {"status": "success", "next_node": candidate_nodes[0]}

    except Exception as e:
        return {"status": "error", "error_message": str(e)}

# ================================================================
# DAG v2.2: 安全な、追加専用の数式構造化・検証API
# 上の既存API（相方担当を含む）の挙動は変更しない。
# ================================================================
from fastapi import HTTPException
from sympy.core.relational import Relational, Equality, Unequality, StrictLessThan, LessThan, StrictGreaterThan, GreaterThan
import re

class DagAstRequest(BaseModel):
    graph: Dict[str, Any]

class AstError(ValueError):
    pass

_AST_EXPR = {'symbol','rational','constant','add','sub','mul','div','pow_int','sqrt','sin','cos'}
_AST_REL = {'eq','neq','lt','le','gt','ge'}
_AST_MAX_DEPTH = 48
_AST_MAX_NODES = 1200


def _dag_registry(graph):
    data = graph.get('symbol_registry') or {}
    entries = data.get('symbols') if isinstance(data, dict) else None
    if not isinstance(entries, list):
        raise AstError('symbol_registry.symbols must be an array')
    result = {}
    for entry in entries:
        if not isinstance(entry, dict) or not isinstance(entry.get('symbol_id'), str):
            raise AstError('invalid symbol entry')
        key = entry['symbol_id']
        if key in result or entry.get('sort') not in ('Real','Time','Object','Bool'):
            raise AstError('duplicated symbol_id or invalid sort')
        result[key] = entry
    return result


def _validate_dag_ast(node, registry, depth=0, counter=None, logical=True):
    if counter is None: counter = [0]
    counter[0] += 1
    if depth > _AST_MAX_DEPTH or counter[0] > _AST_MAX_NODES:
        raise AstError('AST complexity limit exceeded')
    if not isinstance(node, dict) or not isinstance(node.get('kind'), str):
        raise AstError('missing AST kind')
    kind = node['kind']
    if kind in _AST_REL:
        if not logical: raise AstError('comparison in arithmetic expression')
        _validate_dag_ast(node.get('lhs'), registry, depth+1, counter, False)
        _validate_dag_ast(node.get('rhs'), registry, depth+1, counter, False)
    elif kind in _AST_EXPR:
        if logical: raise AstError('arithmetic expression where formula expected')
        if kind == 'symbol':
            if node.get('symbol_id') not in registry: raise AstError('unregistered symbol')
            if registry[node['symbol_id']]['sort'] not in ('Real','Time'):
                raise AstError('non-numeric symbol in arithmetic')
        elif kind == 'rational':
            if (type(node.get('numerator')) is not int or type(node.get('denominator')) is not int
                or node['denominator'] == 0 or abs(node['numerator']) > 10**15
                or abs(node['denominator']) > 10**15):
                raise AstError('invalid rational')
        elif kind == 'constant':
            if node.get('name') != 'pi': raise AstError('unsupported constant')
        elif kind in ('add','mul'):
            args = node.get('args')
            if not isinstance(args,list) or len(args) < 2: raise AstError('invalid argument list')
            for arg in args: _validate_dag_ast(arg, registry, depth+1, counter, False)
        elif kind == 'sub':
            _validate_dag_ast(node.get('left'), registry, depth+1, counter, False)
            _validate_dag_ast(node.get('right'), registry, depth+1, counter, False)
        elif kind == 'div':
            _validate_dag_ast(node.get('numerator'), registry, depth+1, counter, False)
            _validate_dag_ast(node.get('denominator'), registry, depth+1, counter, False)
        elif kind == 'pow_int':
            if type(node.get('exponent')) is not int or not -32 <= node['exponent'] <= 32:
                raise AstError('unsupported exponent')
            _validate_dag_ast(node.get('base'), registry, depth+1, counter, False)
        else:
            _validate_dag_ast(node.get('argument'), registry, depth+1, counter, False)
    else:
        raise AstError('unsupported AST kind: '+kind)


def _ast_to_safe_sympy(node, registry):
    kind = node['kind']
    if kind == 'symbol': return sympy.Symbol(node['symbol_id'], real=True)
    if kind == 'rational': return sympy.Rational(node['numerator'],node['denominator'])
    if kind == 'constant': return sympy.pi
    if kind == 'add': return sympy.Add(*(_ast_to_safe_sympy(a,registry) for a in node['args']))
    if kind == 'mul': return sympy.Mul(*(_ast_to_safe_sympy(a,registry) for a in node['args']))
    if kind == 'sub': return _ast_to_safe_sympy(node['left'],registry)-_ast_to_safe_sympy(node['right'],registry)
    if kind == 'div': return _ast_to_safe_sympy(node['numerator'],registry)/_ast_to_safe_sympy(node['denominator'],registry)
    if kind == 'pow_int': return _ast_to_safe_sympy(node['base'],registry)**node['exponent']
    if kind == 'sqrt': return sympy.sqrt(_ast_to_safe_sympy(node['argument'],registry))
    if kind == 'sin': return sympy.sin(_ast_to_safe_sympy(node['argument'],registry))
    if kind == 'cos': return sympy.cos(_ast_to_safe_sympy(node['argument'],registry))
    raise AstError('unsupported expression')


def _formula_to_sympy(node, registry):
    cls = {'eq':sympy.Eq,'neq':sympy.Ne,'lt':sympy.Lt,
           'le':sympy.Le,'gt':sympy.Gt,'ge':sympy.Ge}[node['kind']]
    return cls(_ast_to_safe_sympy(node['lhs'],registry), _ast_to_safe_sympy(node['rhs'],registry), evaluate=False)


def _canonical_symbol_label(label):
    if not isinstance(label,str): return ''
    s=label.strip().strip('$')
    s=re.sub(r'\\(?:mathrm|text)\{([^{}]*)\}', r'\1', s)
    return re.sub(r'\s+', '', s)


def _from_sympy_expr(expr, registry):
    if expr is sympy.pi: return {'kind':'constant','name':'pi'}
    if expr.is_Symbol:
        name = str(expr)
        candidates = [sid for sid, info in registry.items()
                      if _canonical_symbol_label(info.get('display_name')) == name
                      or _canonical_symbol_label(sid) == name]
        if len(set(candidates)) != 1: raise AstError('ambiguous/unregistered LaTeX symbol: '+name)
        return {'kind':'symbol','symbol_id':candidates[0]}
    if expr.is_Integer or expr.is_Rational:
        return {'kind':'rational','numerator':int(expr.p),'denominator':int(expr.q)}
    if expr.is_Float:
        exact=sympy.Rational(str(expr))
        if abs(int(exact.p))>10**15 or abs(int(exact.q))>10**15:
            raise AstError('decimal precision exceeds rational limit')
        return {'kind':'rational','numerator':int(exact.p),'denominator':int(exact.q)}
    if expr.is_Add:
        return {'kind':'add','args':[_from_sympy_expr(x,registry) for x in expr.args]}
    if expr.is_Mul:
        return {'kind':'mul','args':[_from_sympy_expr(x,registry) for x in expr.args]}
    if expr.is_Pow:
        base, power = expr.args
        if power == sympy.Rational(1,2):
            return {'kind':'sqrt','argument':_from_sympy_expr(base,registry)}
        if power.is_Integer and -32 <= int(power) <= 32:
            return {'kind':'pow_int','base':_from_sympy_expr(base,registry),'exponent':int(power)}
        raise AstError('unsupported fractional power')
    if expr.func in (sympy.sin,sympy.cos):
        return {'kind':expr.func.__name__,'argument':_from_sympy_expr(expr.args[0],registry)}
    raise AstError('unsupported SymPy expression: '+str(expr.func))


def _from_sympy_formula(expr, registry):
    mapping = {Equality:'eq', Unequality:'neq', StrictLessThan:'lt', LessThan:'le',
               StrictGreaterThan:'gt', GreaterThan:'ge'}
    for typ, kind in mapping.items():
        if isinstance(expr,typ):
            return {'kind':kind,'lhs':_from_sympy_expr(expr.lhs,registry),
                    'rhs':_from_sympy_expr(expr.rhs,registry)}
    raise AstError('LaTeX expression is not a relation')


def _parse_latex_formula(latex, registry):
    # LaTeX is NOT executable Python; parse via a grammar, never eval/parse_expr.
    from sympy.parsing.latex import parse_latex
    if not isinstance(latex,str) or len(latex)>2000: raise AstError('invalid LaTeX length')
    tex = latex.strip().strip('$').replace('\\left','').replace('\\right','')
    tex = re.sub(r'\\(?:mathrm|text)\{([^{}]*)\}',r'\1',tex)
    # SymPy 1.14 Lark grammar does not accept \pi. Use an otherwise absent
    # Greek placeholder, then restore the exact constant after grammar parsing.
    has_pi = r'\pi' in tex
    if has_pi:
        if r'\theta' in tex or r'\vartheta' in tex:
            raise AstError('pi-placeholder collision')
        tex = tex.replace(r'\pi', r'\vartheta')
    parsed = parse_latex(tex,backend='lark')
    if has_pi:
        parsed = parsed.xreplace({sympy.Symbol('theta'): sympy.pi})
    ast = _from_sympy_formula(parsed,registry)
    _validate_dag_ast(ast,registry)
    return ast


def _compare_candidate_to_parsed(candidate, parsed, registry):
    if candidate.get('kind') != parsed.get('kind'): return False
    # Equality operands may be algebraically reordered. Comparing both sides
    # individually avoids accepting multiplication by an unproven nonzero factor.
    a=_formula_to_sympy(candidate,registry)
    b=_formula_to_sympy(parsed,registry)
    return bool(sympy.simplify(a.lhs-b.lhs)==0 and sympy.simplify(a.rhs-b.rhs)==0) or bool(
        candidate['kind'] in ('eq','neq') and sympy.simplify(a.lhs-b.rhs)==0 and sympy.simplify(a.rhs-b.lhs)==0)


@app.post('/api/normalize_ast')
def normalize_ast(req: DagAstRequest):
    graph=req.graph
    try: registry=_dag_registry(graph)
    except AstError as e: raise HTTPException(422,str(e))
    outputs=[]
    for node in graph.get('nodes',[]):
        if node.get('type')!='proposition': continue
        candidate=node.get('formula_ast')
        latex=node.get('math_expr')
        if not latex:
            # Extract only a single explicitly delimited mathematical formula.
            chunks=re.findall(r'\$([^$]+)\$',node.get('label') or '')
            latex=chunks[0] if len(chunks)==1 else None
        result={'node_id':node['id'],'formula_ast':None,'status':'unknown'}
        parsed=None
        if latex:
            try: parsed=_parse_latex_formula(latex,registry)
            except Exception as e: result['reason']='latex_parse_failed: '+str(e)[:180]
        if isinstance(candidate,dict) and candidate:
            try: _validate_dag_ast(candidate,registry)
            except AstError as e:
                candidate=None
                result['reason']='AI_AST_invalid: '+str(e)
        else: candidate=None
        if parsed is not None and candidate is not None:
            if _compare_candidate_to_parsed(candidate,parsed,registry):
                result.update(formula_ast=parsed,status='validated_by_parser_and_ai')
            else: result['reason']='latex_AST_conflict'
        elif parsed is not None:
            result.update(formula_ast=parsed,status='validated_by_parser')
        elif candidate is not None:
            # AI-only AST can be displayed, but is not promoted to a trusted solver input.
            result.update(formula_ast=candidate,status='candidate_unconfirmed')
        elif 'reason' not in result:
            result['reason']='no_parseable_math'
        outputs.append(result)
    return {'propositions':outputs}


def _z3_formula(expr, variables, registry):
    import z3
    k=expr['kind']
    if k in _AST_REL:
        l=_z3_expr(expr['lhs'],variables,registry)
        r=_z3_expr(expr['rhs'],variables,registry)
        return {'eq':lambda:l==r,'neq':lambda:l!=r,'lt':lambda:l<r,'le':lambda:l<=r,
                'gt':lambda:l>r,'ge':lambda:l>=r}[k]()
    raise AstError('unsupported logical formula')


def _z3_expr(ast, variables, registry):
    import z3
    kind=ast['kind']
    if kind=='symbol':
        sid=ast['symbol_id']
        if registry[sid]['sort']!='Real': raise AstError('not a Real symbol')
        if sid not in variables: variables[sid]=z3.Real(sid)
        return variables[sid]
    if kind=='rational':return z3.RealVal(ast['numerator'])/z3.RealVal(ast['denominator'])
    if kind=='add':return sum((_z3_expr(x,variables,registry) for x in ast['args']),z3.RealVal(0))
    if kind=='mul':
        v=z3.RealVal(1)
        for x in ast['args']:v=v*_z3_expr(x,variables,registry)
        return v
    if kind=='sub':return _z3_expr(ast['left'],variables,registry)-_z3_expr(ast['right'],variables,registry)
    if kind=='div':
        # Without proof that denominator!=0, cannot soundly translate real division.
        raise AstError('division_nonzero_condition_unproven')
    if kind=='pow_int':
        if ast['exponent']<0:raise AstError('negative_exponent_domain_unproven')
        return _z3_expr(ast['base'],variables,registry)**ast['exponent']
    raise AstError('unsupported Z3 arithmetic')


def _prove_algebraic(premises, conclusion, registry):
    # Only verified AST nodes reach this function. No implicit physical facts.
    try:
        import z3
    except ImportError:
        return 'unknown','z3_not_installed',None
    variables={}
    try:
        ps=[_z3_formula(p,variables,registry) for p in premises]
        c=_z3_formula(conclusion,variables,registry)
        solver=z3.Solver()
        solver.set(timeout=2500)
        solver.add(*ps)
        check=solver.check()
        if check==z3.unsat: return 'unknown','inconsistent_premises',None
        if check!=z3.sat: return 'unknown','premise_satisfiability_unknown',None
        solver.push()
        solver.add(z3.Not(c))
        counter=solver.check()
        counterexample=str(solver.model())[:1000] if counter==z3.sat else None
        solver.pop()
        if counter==z3.unsat:return 'valid','entailment_proved',None
        if counter!=z3.sat:return 'unknown','z3_unknown',None
        solver.push()
        solver.add(c)
        satisfies=solver.check()
        solver.pop()
        if satisfies==z3.unsat:
            return 'invalid','conclusion_contradicts_premises',counterexample
        # Both the conclusion and its negation are consistent with the premises.
        # The graph lacks information; do not blame the student for that.
        return 'unknown','non_entailment_without_contradiction',counterexample
    except Exception as e:
        return 'unknown','unsupported_or_solver_error: '+str(e)[:160],None


@app.post('/api/verify_ast')
def verify_ast(req: DagAstRequest):
    graph=req.graph
    try: registry=_dag_registry(graph)
    except AstError as e: raise HTTPException(422,str(e))
    nodes=graph.get('nodes')
    edges=graph.get('edges')
    if not isinstance(nodes,list) or not isinstance(edges,list):raise HTTPException(422,'nodes/edges arrays required')
    id_map={}
    for node in nodes:
        if not isinstance(node,dict) or not isinstance(node.get('id'),str) or node['id'] in id_map:
            raise HTTPException(422,'invalid or duplicate DAG node id')
        id_map[node['id']]=node
    incoming={}
    outgoing={}
    for edge in edges:
        if edge.get('from') not in id_map or edge.get('to') not in id_map:
            raise HTTPException(422,'unknown graph endpoint')
        incoming.setdefault(edge['to'],[]).append(edge['from'])
        outgoing.setdefault(edge['from'],[]).append(edge['to'])
    evidence=graph.get('evidence_sources') or []
    # Evidence (including a student's unverified conclusion) is never automatically
    # promoted to a solver premise: only explicit incoming proposition edges count.
    results=[]
    for node in nodes:
        if node.get('type')!='inference':continue
        src=[id_map[x] for x in incoming.get(node['id'],[]) if id_map[x].get('type')=='proposition']
        dst=[id_map[x] for x in outgoing.get(node['id'],[]) if id_map[x].get('type')=='proposition']
        status='unknown';reason='not_enough_verified_premises';counter=None
        theorem_id=node.get('theorem_id')
        if len(src)<1 or len(dst)!=1:
            reason='expected_at_least_one_input_and_one_output_proposition'
        elif theorem_id!='algebraic_simplification':
            # Formal physics rules require theorem-specific applicability checks.
            # A mere algebraic identity never establishes their physical validity.
            reason='physics_applicability_not_implemented'
        elif any(p.get('ast_validation') not in ('validated_by_parser','validated_by_parser_and_ai') for p in src+dst):
            reason='unconfirmed_AST'
        else:
            try:
                asts=[p.get('formula_ast') for p in src+dst]
                for ast in asts:_validate_dag_ast(ast,registry)
                status,reason,counter=_prove_algebraic(asts[:-1],asts[-1],registry)
            except Exception as e:reason='AST_validation_error: '+str(e)[:160]
        results.append({'node_id':node['id'],'status':status,'reason':reason,
                        'counterexample':counter,'theorem_id':theorem_id})
    return {'inferences':results,'status':('invalid' if any(x['status']=='invalid' for x in results)
            else 'unknown' if any(x['status']=='unknown' for x in results) else 'valid'),
            'engine':'formal_ast_v1'}
