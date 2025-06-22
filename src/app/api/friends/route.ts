import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';

interface FriendRow {
  id: string;
  username: string;
  avatar_url: string;
  wallet_address: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get('walletAddress');

  if (!walletAddress) {
    return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
  }

  try {
    const result = (await db`
      SELECT 
        p.id,
        p.username,
        p.avatar_url,
        p.wallet_address
      FROM friendships f
      JOIN players p ON f.friend_id = p.id
      WHERE f.player_id = (
        SELECT id FROM players WHERE wallet_address = ${walletAddress}
      )
      AND f.status = 'accepted'
      ORDER BY p.username ASC
    `) as FriendRow[];

    const friends = result.map((row) => ({
      id: row.id,
      username: row.username,
      avatar_url: row.avatar_url,
      wallet_address: row.wallet_address,
      is_online: false, // Default value since column might not exist
      current_game: undefined, // Default value since column might not exist
    }));

    return NextResponse.json(friends);
  } catch (error) {
    console.error('Error fetching friends:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { walletAddress, friendAddress } = await request.json();

    if (!walletAddress || !friendAddress) {
      return NextResponse.json({ error: 'Wallet address and friend address are required' }, { status: 400 });
    }

    // Get the current user's ID
    const currentUserResult = await db`
      SELECT id FROM players WHERE wallet_address = ${walletAddress}
    `;

    if (currentUserResult.length === 0) {
      return NextResponse.json({ error: 'Current user not found' }, { status: 404 });
    }

    const currentUserId = currentUserResult[0].id;

    // First, ensure the friend exists in the players table
    const friendResult = await db`
      INSERT INTO players (wallet_address, username, avatar_url)
      VALUES (${friendAddress}, ${`Player${friendAddress.slice(0, 4)}`}, '')
      ON CONFLICT (wallet_address) DO UPDATE SET wallet_address = EXCLUDED.wallet_address
      RETURNING id
    `;

    let friendId;
    if (friendResult.length > 0) {
      friendId = friendResult[0].id;
    } else {
      // Friend already exists, get their ID
      const existingFriendResult = await db`
        SELECT id FROM players WHERE wallet_address = ${friendAddress}
      `;
      
      if (existingFriendResult.length === 0) {
        return NextResponse.json({ error: 'Failed to find or create friend' }, { status: 500 });
      }
      
      friendId = existingFriendResult[0].id;
    }

    // Add the friendship with status
    await db`
      INSERT INTO friendships (player_id, friend_id, status)
      VALUES (${currentUserId}, ${friendId}, 'accepted')
      ON CONFLICT (player_id, friend_id) DO NOTHING
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding friend:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get('walletAddress');
  const friendId = searchParams.get('friendId');

  if (!walletAddress || !friendId) {
    return NextResponse.json({ error: 'Wallet address and friend ID are required' }, { status: 400 });
  }

  try {
    await db`
      DELETE FROM friendships
      WHERE player_id = (SELECT id FROM players WHERE wallet_address = ${walletAddress})
      AND friend_id = ${friendId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing friend:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 