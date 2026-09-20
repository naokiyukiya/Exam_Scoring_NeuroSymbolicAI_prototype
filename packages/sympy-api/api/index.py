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
        
        diff = sympy.simplify(e1 - e2)
        is_equal = bool(diff == 0)
        
        return {"is_equal": is_equal}
    except Exception as e:
        return {"error": str(e)}