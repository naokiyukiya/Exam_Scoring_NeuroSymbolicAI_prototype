import dynamic from 'next/dynamic';
import React from 'react';

export const theoremComponentMap: Record<string, React.ComponentType<any>> = {
  law_buoyancy_archimedes: dynamic(
    () => import('./content/law_buoyancy_archimedes')
  ),
  // 今後新しく追加する定理もここに追加していくだけ
};