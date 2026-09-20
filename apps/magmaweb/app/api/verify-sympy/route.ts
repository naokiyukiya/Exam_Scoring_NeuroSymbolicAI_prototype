// apps/magmaweb/app/api/verify-sympy/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // クライアントから検証したい2つの式を受け取る
    const body = await request.json();
    const { expr1, expr2 } = body;

    if (!expr1 || !expr2) {
      return NextResponse.json({ error: 'expr1 and expr2 are required' }, { status: 400 });
    }

    // 環境変数からSymPy APIのURLを取得
    const sympyApiUrl = process.env.SYMPY_API_URL;
    if (!sympyApiUrl) {
      return NextResponse.json({ error: 'SYMPY_API_URL is not configured' }, { status: 500 });
    }

    // 新しく作ったSymPyサーバーへPOSTリクエストを送信
    const response = await fetch(`${sympyApiUrl}/api/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expr1, expr2 }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('SymPy API Error:', errorData);
      return NextResponse.json({ error: 'Failed to verify with SymPy API' }, { status: response.status });
    }

    // 検証結果を受け取ってフロントエンドに返す
    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('Verify error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}