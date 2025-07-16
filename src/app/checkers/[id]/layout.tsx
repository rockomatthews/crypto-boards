import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id: gameId } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://crypto-boards.vercel.app';
  const canonicalUrl = `${baseUrl}/checkers/${gameId}`;
  
  return {
    title: `Checkers Game ${gameId} - Bet SOL | Crypto Boards`,
    description: `Join live Checkers game ${gameId} and bet SOL! Play against real opponents with crypto rewards on Solana blockchain. Winner takes all in this strategic board game.`,
    keywords: ['checkers game', 'crypto checkers', 'SOL betting', 'live checkers', 'blockchain gaming', 'solana games'],
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `Live Checkers Game - Bet SOL`,
      description: `Join this exciting Checkers game and bet SOL! Strategic gameplay with real crypto rewards.`,
      images: ['/images/checkers.png'],
      type: 'website',
      url: canonicalUrl,
    },
    twitter: {
      card: 'summary_large_image',
      title: `Live Checkers Game - Bet SOL`,
      description: `Strategic Checkers with SOL betting! Join the action 🏆`,
      images: ['/images/checkers.png'],
    },
  };
}

export default function CheckersGameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}