import React from 'react';
import TheoremDetailRenderer from '../../../components/theorems/TheoremDetailRenderer';

export default function TheoremStandalonePage({ params }: { params: { id: string } }) {
  return (
    <div style={styles.pageWrapper}>
      <TheoremDetailRenderer theoremId={params.id} isModal={false} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageWrapper: {
    width: '100%',
    minHeight: '100vh',
    backgroundColor: '#ffffff',
    padding: '20px 16px 80px 16px', // フッター（54px）に被らない余白
    boxSizing: 'border-box',
  },
};