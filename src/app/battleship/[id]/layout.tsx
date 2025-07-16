import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id: gameId } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://crypto-boards.vercel.app';
  const canonicalUrl = `${baseUrl}/battleship/${gameId}`;
  
  return {
    title: `Battleship Game ${gameId} - Naval Combat with SOL Betting | Crypto Boards`,
    description: `Command your fleet in Battleship game ${gameId}! Strategic naval warfare with SOL betting on Solana blockchain. Sink enemy ships and claim crypto rewards!`,
    keywords: ['battleship game', 'crypto battleship', 'naval combat', 'SOL betting', 'strategy game', 'blockchain gaming', 'solana battleship'],
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `Naval Battleship Combat - Bet SOL`,
      description: `Strategic naval warfare with SOL betting! Command your fleet and destroy the enemy.`,
      images: ['/images/battleship.png'],
      type: 'website',
      url: canonicalUrl,
    },
    twitter: {
      card: 'summary_large_image',
      title: `Battleship Naval Combat - Bet SOL`,
      description: `Strategic naval warfare with crypto rewards! 🚢💥`,
      images: ['/images/battleship.png'],
    },
  };
}

export default function BattleshipGameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}