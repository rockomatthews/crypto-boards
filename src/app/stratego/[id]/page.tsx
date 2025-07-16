'use client';

import { StrategoBoard } from '../../../components/StrategoBoard';
import { useParams } from 'next/navigation';

export default function StrategoGamePage() {
  const params = useParams();
  const gameId = params.id as string;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#1a1a2e' }}>
      <StrategoBoard gameId={gameId} />
    </div>
  );
}
