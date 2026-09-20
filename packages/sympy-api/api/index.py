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
        transformations = standard_transformations + (implicit_multiplication_application, convert_equals_signs)
        
        # 【変更】 .doit() を追加し、シグマ(Sum)や微分積分などを先に計算させておく！
        e1 = parse_expr(req.expr1, transformations=transformations).doit()
        e2 = parse_expr(req.expr2, transformations=transformations).doit()
        
        if isinstance(e2, sympy.core.relational.Equality):
            diff = sympy.simplify(e2.lhs - e2.rhs)
            return {"is_equal": bool(diff == 0)}
            
        if isinstance(e1, sympy.core.relational.Equality):
            diff = sympy.simplify(e1.lhs - e1.rhs)
            return {"is_equal": bool(diff == 0)}
        
        diff = sympy.simplify(e1 - e2)
        return {"is_equal": bool(diff == 0)}
        
    except Exception as e:
        return {"error": str(e)}