import React from 'react';
import TheoremDetailRenderer from '@/components/theorems/TheoremDetailRenderer';

export default function TheoremStandalonePage({ params }: { params: { id: string } }) {
  return (
    <div className="min-h-screen bg-slate-950 py-10 px-4">
      <TheoremDetailRenderer theoremId={params.id} />
    </div>
  );
}