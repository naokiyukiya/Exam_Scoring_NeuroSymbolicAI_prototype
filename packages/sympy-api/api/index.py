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
        # rationalizeを追加し、1/6などの分数を小数(0.166...)にせず厳密な分数として処理する
        transformations = standard_transformations + (implicit_multiplication_application, convert_equals_signs, rationalize)
        
        e1 = parse_expr(req.expr1, transformations=transformations).doit()
        e2 = parse_expr(req.expr2, transformations=transformations).doit()
        
        # 等式(A=B)の場合は、(A - B) の形にしてから比較する関数
        def get_diff(expr):
            if isinstance(expr, sympy.core.relational.Equality):
                return expr.lhs - expr.rhs
            return expr
            
        diff1 = get_diff(e1)
        diff2 = get_diff(e2)
        
        # 2つの式の差分をとって、それが0になるか（変形が正しいか）チェック
        check1 = sympy.simplify(diff1 - diff2)
        check2 = sympy.simplify(diff1 + diff2)
        
        is_eq = False
        if check1.is_zero or check1 == 0:
            is_eq = True
        elif check2.is_zero or check2 == 0:
            is_eq = True
        else:
            # 念のため、微小な誤差を吸収する equals(0) も試す
            try:
                if check1.equals(0) or check2.equals(0):
                    is_eq = True
            except:
                pass
                
        return {"is_equal": is_eq}
        
    except Exception as e:
        # エラーの内容をそのままNext.jsに返す
        return {"error": str(e)}