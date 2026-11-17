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