from fastapi import FastAPI
from pydantic import BaseModel
import sympy
from sympy.parsing.sympy_parser import parse_expr, standard_transformations, implicit_multiplication_application, convert_equals_signs

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
        # 省略された掛け算（ab -> a*b）や、"=" を "Eq" に変換する設定
        transformations = standard_transformations + (implicit_multiplication_application, convert_equals_signs)
        
        e1 = parse_expr(req.expr1, transformations=transformations)
        e2 = parse_expr(req.expr2, transformations=transformations)
        
        # 【追加】もしAIが「A = B」という形（等式）で送ってきた場合の特別対応
        if isinstance(e2, sympy.core.relational.Equality):
            # 等式の左辺(lhs)と右辺(rhs)が同じものか検証してあげる
            diff = sympy.simplify(e2.lhs - e2.rhs)
            return {"is_equal": bool(diff == 0)}
            
        if isinstance(e1, sympy.core.relational.Equality):
            diff = sympy.simplify(e1.lhs - e1.rhs)
            return {"is_equal": bool(diff == 0)}
        
        # 通常の処理（式と式の比較）
        diff = sympy.simplify(e1 - e2)
        return {"is_equal": bool(diff == 0)}
        
    except Exception as e:
        return {"error": str(e)}