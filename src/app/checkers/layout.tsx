import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Live Checkers Game - Crypto Boards',
  description: 'Join this exciting checkers match! Real-time multiplayer gaming with SOL betting on Solana blockchain.',
  openGraph: {
    title: '🏁 Live Checkers Game - Play & Earn SOL',
    description: 'Join this exciting checkers match! Real-time multiplayer gaming with SOL betting on Solana blockchain. 🎮💰',
    images: [
      {
        url: '/images/checkers.png',
        width: 1200,
        height: 630,
        alt: 'Live Checkers Game - Crypto Boards',
      }
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '🏁 Live Checkers Game - Play & Earn SOL',
    description: 'Join this exciting checkers match! Real-time multiplayer gaming with SOL betting 🎮💰',
    images: ['/images/checkers.png'],
  },
};

export default function CheckersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 