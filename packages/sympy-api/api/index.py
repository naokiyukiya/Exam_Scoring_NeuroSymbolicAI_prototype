from fastapi import FastAPI
from pydantic import BaseModel
import sympy

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
        # 文字列をSymPyの数式に変換（※簡易的な実装です）
        e1 = sympy.sympify(req.expr1)
        e2 = sympy.sympify(req.expr2)
        
        # 式の差をとり、展開・簡約して0になれば等価と判定
        diff = sympy.simplify(e1 - e2)
        is_equal = bool(diff == 0)
        
        return {"is_equal": is_equal}
    except Exception as e:
        return {"error": str(e)}