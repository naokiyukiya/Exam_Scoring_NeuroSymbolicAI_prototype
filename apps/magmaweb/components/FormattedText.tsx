'use client';

import React from 'react';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

interface FormattedTextProps {
  text: string;
}

// 数式テキスト（$...$ または $$...$$）を KaTeX で表示する共通コンポーネント
export default function FormattedText({ text }: FormattedTextProps) {
  if (!text) return null;

  // エスケープ文字の調整（\\rho -> \rho）
  const unescapedText = text.replace(/\\\\/g, '\\');
  
  // $$...$$ (ブロック) または $...$ (インライン) で分割
  const parts = unescapedText.split(/(\$\$[\s\S]+?\$\$|\$[\s\S]+?\$)/g);

  return (
    <span>
      {parts.map((part, index) => {
        // ブロック数式 ($$ ... $$)
        if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
          const mathContent = part.slice(2, -2).trim();
          return <BlockMath key={index} math={mathContent} />;
        }
        // インライン数式 ($ ... $)
        if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
          const mathContent = part.slice(1, -1).trim();
          return <InlineMath key={index} math={mathContent} />;
        }
        // 通常テキスト
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
}