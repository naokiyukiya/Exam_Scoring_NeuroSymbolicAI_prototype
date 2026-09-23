'use client';

import React from 'react';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

interface FormattedTextProps {
  text: any; // オブジェクト等が渡された場合も受け取れるよう安全化
  onTheoremClick?: (theoremId: string) => void;
}

const THEOREM_KEYWORD_MAP: Record<string, string> = {
  水圧: 'law_fluid_pressure',
  浮力: 'law_buoyancy_archimedes',
  アルキメデスの原理: 'law_buoyancy_archimedes',
};

export default function FormattedText({ text, onTheoremClick }: FormattedTextProps) {
  if (text === null || text === undefined) return null;

  // 入力が文字列でない（オブジェクトや数値など）場合は文字列に変換して防御
  const stringText = typeof text === 'string' ? text : String(text);

  if (!stringText) return null;

  // 1. エスケープ処理
  const unescapedText = stringText.replace(/\\\\/g, '\\');

  // 2. 数式（$$...$$ または $...$）で分割
  const mathParts = unescapedText.split(/(\$\$[\s\S]+?\$\$|\$[\s\S]+?\$)/g);

  return (
    <span>
      {mathParts.map((part, index) => {
        if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
          const mathContent = part.slice(2, -2).trim();
          return <BlockMath key={index} math={mathContent} />;
        }
        if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
          const mathContent = part.slice(1, -1).trim();
          return <InlineMath key={index} math={mathContent} />;
        }

        const keywords = Object.keys(THEOREM_KEYWORD_MAP);
        if (keywords.length === 0 || !onTheoremClick) {
          return <span key={index}>{part}</span>;
        }

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