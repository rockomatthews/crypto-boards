import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get('walletAddress');

  if (!walletAddress) {
    return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
  }

  try {
    // First, try to get the basic profile
    const result = await db`
      SELECT 
        p.username,
        p.avatar_url
      FROM players p
      WHERE p.wallet_address = ${walletAddress}
    `;

    if (result.length > 0) {
      return NextResponse.json({
        username: result[0].username,
        avatar_url: result[0].avatar_url,
        games_played: 0,
        games_won: 0,
        total_winnings: 0,
      });
    } else {
      // Create new profile if it doesn't exist
      const newProfile = await db`
        INSERT INTO players (wallet_address, username, avatar_url)
        VALUES (${walletAddress}, ${`Player${walletAddress.slice(0, 4)}`}, '')
        RETURNING username, avatar_url
      `;

      if (newProfile.length > 0) {
        return NextResponse.json({
          username: newProfile[0].username,
          avatar_url: newProfile[0].avatar_url,
          games_played: 0,
          games_won: 0,
          total_winnings: 0,
        });
      }
    }

    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { walletAddress, username } = await request.json();

    if (!walletAddress || !username) {
      return NextResponse.json({ error: 'Wallet address and username are required' }, { status: 400 });
    }

    const result = await db`
      UPDATE players
      SET username = ${username}
      WHERE wallet_address = ${walletAddress}
      RETURNING username
    `;

    if (result.length > 0) {
      return NextResponse.json({ username: result[0].username });
    } else {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 