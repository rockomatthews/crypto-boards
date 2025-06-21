import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    // Get current user's ID
    const currentUserResult = await db`
      SELECT id FROM players WHERE wallet_address = ${walletAddress}
    `;

    if (currentUserResult.length === 0) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const currentUserId = currentUserResult[0].id;

    // Update current user's online status
    await db`
      INSERT INTO online_users (player_id, last_seen, is_online)
      VALUES (${currentUserId}, CURRENT_TIMESTAMP, true)
      ON CONFLICT (player_id) 
      DO UPDATE SET last_seen = CURRENT_TIMESTAMP, is_online = true
    `;

    // Get all users with their online status and friendship status
    const users = await db`
      SELECT 
        p.id,
        p.username,
        p.wallet_address,
        p.avatar_url,
        COALESCE(ou.is_online, false) as is_online,
        COALESCE(ou.last_seen, p.created_at) as last_seen,
        CASE 
          WHEN f.status = 'accepted' THEN true
          ELSE false
        END as is_friend
      FROM players p
      LEFT JOIN online_users ou ON p.id = ou.player_id
      LEFT JOIN friendships f ON (
        (f.player_id = ${currentUserId} AND f.friend_id = p.id) OR
        (f.friend_id = ${currentUserId} AND f.player_id = p.id)
      )
      WHERE p.id != ${currentUserId}
      ORDER BY 
        COALESCE(ou.is_online, false) DESC,
        CASE WHEN f.status = 'accepted' THEN 0 ELSE 1 END,
        p.username ASC
    `;

    // Mark users as offline if they haven't been seen in the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    await db`
      UPDATE online_users 
      SET is_online = false 
      WHERE last_seen < ${fiveMinutesAgo.toISOString()} AND is_online = true
    `;

    // Update the online status in our results
    const updatedUsers = users.map(user => ({
      ...user,
      is_online: user.is_online && new Date(user.last_seen) > fiveMinutesAgo
    }));

    return NextResponse.json(updatedUsers);
  } catch (error) {
    console.error('Error fetching online users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 