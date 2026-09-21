from fastapi import FastAPI
from pydantic import BaseModel
import sympy
from sympy import Ne # ★これを通加
from sympy.parsing.sympy_parser import parse_expr, standard_transformations, implicit_multiplication_application, convert_equals_signs, rationalize

app = FastAPI()

class VerifyRequest(BaseModel):
    expr1: str
    expr2: str

@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "SymPy API is running"}

@app.post("/api/verify")
def verify_expressions(req: VerifyRequest):
    try:
        transformations = standard_transformations + (implicit_multiplication_application, convert_equals_signs, rationalize)
        
        e1 = parse_expr(req.expr1, transformations=transformations).doit()
        e2 = parse_expr(req.expr2, transformations=transformations).doit()

        # ==========================================
        # ステップ1: 代数検証 (分数の分母を払った形で比較)
        # ==========================================
        def get_diff(expr):
            if isinstance(expr, sympy.core.relational.Relational): # =, <, <=, >, >=, != を網羅
                return expr.lhs - expr.rhs
            elif isinstance(expr, sympy.logic.boolalg.BooleanTrue) or expr is True:
                return sympy.Integer(0)
            elif isinstance(expr, sympy.logic.boolalg.BooleanFalse) or expr is False:
                return sympy.Integer(1)
            elif isinstance(expr, sympy.logic.boolalg.BooleanFunction): # Or, And は引き算できないのでスキップ
                return None
            return expr

        diff1 = get_diff(e1)
        diff2 = get_diff(e2)
        is_eq = False
        
        if diff1 is not None and diff2 is not None:
            # cancelを使って分母をまとめ、分子(num)だけを比較する (6/(x-2) のような分数方程式対策)
            num1, _ = sympy.fraction(sympy.cancel(diff1))
            num2, _ = sympy.fraction(sympy.cancel(diff2))
            
            check1 = sympy.simplify(num1 - num2)
            check2 = sympy.simplify(num1 + num2)
            if check1.is_zero or check1 == 0 or check2.is_zero or check2 == 0:
                is_eq = True

        # ==========================================
        # ステップ2: 論理/数値テスト検証 (不等式・場合分け対策)
        # ==========================================
        if not is_eq:
            vars1 = e1.free_symbols if hasattr(e1, 'free_symbols') else set()
            vars2 = e2.free_symbols if hasattr(e2, 'free_symbols') else set()
            all_vars = list(vars1.union(vars2))
            
            if all_vars:
                x = all_vars[0]
                # 境界値やランダムな点を含むテストポイント
                test_points = [-10.1, -3.0, -1.0, -0.5, 0.0, 1.0, 2.0, 2.5, 2.6666, 3.0, 10.1]
                points_matched = True
                
                for pt in test_points:
                    try:
                        # 点を代入して、両辺の True/False が一致するかテストする
                        val1 = bool(e1.subs(x, pt))
                        val2 = bool(e2.subs(x, pt))
                        if val1 != val2:
                            points_matched = False
                            break
                    except Exception:
                        # 分母が0になる点 (x=2など) のエラーはスキップ
                        continue
                
                if points_matched:
                    is_eq = True

        return {"is_equal": is_eq}

    except Exception as e:
        return {"error": str(e)}