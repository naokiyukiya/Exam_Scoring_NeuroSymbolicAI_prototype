'use client';

import React from 'react';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

interface FormattedTextProps {
  text: string;
  onTheoremClick?: (theoremId: string) => void;
}

// 内部リンク（Wikipedia方式）でクリックしたときに遷移させるキーワードと定理IDの対応表
const THEOREM_KEYWORD_MAP: Record<string, string> = {
  水圧: 'law_fluid_pressure', // ※水圧の定理ID（ご自身のphysics.jsonのIDに合わせて調整してください）
  浮力: 'law_buoyancy_archimedes',
  アルキメデスの原理: 'law_buoyancy_archimedes',
};

export default function FormattedText({ text, onTheoremClick }: FormattedTextProps) {
  if (!text) return null;

  // 1. エスケープ処理
  const unescapedText = text.replace(/\\\\/g, '\\');

  // 2. 数式（$$...$$ または $...$）で分割
  const mathParts = unescapedText.split(/(\$\$[\s\S]+?\$\$|\$[\s\S]+?\$)/g);

  return (
    <span>
      {mathParts.map((part, index) => {
        // ブロック数式
        if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
          const mathContent = part.slice(2, -2).trim();
          return <BlockMath key={index} math={mathContent} />;
        }
        // インライン数式
        if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
          const mathContent = part.slice(1, -1).trim();
          return <InlineMath key={index} math={mathContent} />;
        }

        // 3. 通常テキスト部分に対して Wikipedia リンクキーワードの置換処理
        const keywords = Object.keys(THEOREM_KEYWORD_MAP);
        if (keywords.length === 0 || !onTheoremClick) {
          return <span key={index}>{part}</span>;
        }

        // キーワードでテキストをさらに分割
        const keywordRegex = new RegExp(`(${keywords.join('|')})`, 'g');
        const textSubParts = part.split(keywordRegex);

        return (
          <span key={index}>
            {textSubParts.map((subPart, subIdx) => {
              const targetTheoremId = THEOREM_KEYWORD_MAP[subPart];
              if (targetTheoremId) {
                return (
                  <button
                    key={subIdx}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTheoremClick(targetTheoremId);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#38bdf8',
                      textDecoration: 'underline',
                      textUnderlineOffset: '3px',
                      cursor: 'pointer',
                      padding: 0,
                      font: 'inherit',
                      fontWeight: '500',
                    }}
                  >
                    {subPart}
                  </button>
                );
              }
              return <span key={subIdx}>{subPart}</span>;
            })}
          </span>
        );
      })}
    </span>
  );
}