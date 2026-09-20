from fastapi import FastAPI
from pydantic import BaseModel
import sympy
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
        
        def get_diff(expr_str):
            # 1. パースする（まだ計算はしない）
            expr = parse_expr(expr_str, transformations=transformations)
            
            # 2. 等式なら「左辺 - 右辺」の形にする
            if isinstance(expr, sympy.core.relational.Equality):
                diff = expr.lhs - expr.rhs
            elif isinstance(expr, sympy.logic.boolalg.BooleanTrue) or expr is True:
                diff = sympy.Integer(0) # 常に成り立つ等式なら差分は0
            elif isinstance(expr, sympy.logic.boolalg.BooleanFalse) or expr is False:
                diff = sympy.Integer(1) # 成り立たない等式なら差分は0以外
            else:
                diff = expr
                
            # 3. ここで初めてdoit()を実行し、シグマなどを計算する
            return diff.doit()

        diff1 = get_diff(req.expr1)
        diff2 = get_diff(req.expr2)
        
        check1 = sympy.simplify(diff1 - diff2)
        check2 = sympy.simplify(diff1 + diff2)
        
        is_eq = False
        if check1.is_zero or check1 == 0:
            is_eq = True
        elif check2.is_zero or check2 == 0:
            is_eq = True
        else:
            try:
                if check1.equals(0) or check2.equals(0):
                    is_eq = True
            except:
                pass
                
        return {"is_equal": is_eq}
        
    except Exception as e:
        return {"error": str(e)}