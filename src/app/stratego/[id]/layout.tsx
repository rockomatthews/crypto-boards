import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id: gameId } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://crypto-boards.vercel.app';
  const canonicalUrl = `${baseUrl}/stratego/${gameId}`;
  
  return {
    title: `Stratego Game ${gameId} - Military Strategy with SOL Betting | Crypto Boards`,
    description: `Lead your army in Stratego game ${gameId}! Classic military strategy with SOL betting on Solana. Capture the flag and win crypto rewards!`,
    keywords: ['stratego game', 'crypto stratego', 'military strategy', 'SOL betting', 'tactical game', 'blockchain gaming', 'solana stratego'],
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `Stratego Military Strategy - Bet SOL`,
      description: `Classic military strategy with SOL betting! Deploy your forces and capture the enemy flag.`,
      images: ['/images/stratego.png'],
      type: 'website',
      url: canonicalUrl,
    },
    twitter: {
      card: 'summary_large_image',
      title: `Stratego Military Strategy - Bet SOL`,
      description: `Military strategy with crypto rewards! Deploy, attack, conquer! 🏴⚔️`,
      images: ['/images/stratego.png'],
    },
  };
}

export default function StrategoGameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}