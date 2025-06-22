import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';

export async function POST(request: NextRequest) {
  try {
    const { walletAddress, phoneNumbers } = await request.json();

    if (!walletAddress || !phoneNumbers || !Array.isArray(phoneNumbers)) {
      return NextResponse.json({ 
        error: 'Wallet address and phone numbers array required' 
      }, { status: 400 });
    }

    // Get current user's ID
    const currentUserResult = await db`
      SELECT id FROM players WHERE wallet_address = ${walletAddress}
    `;

    if (currentUserResult.length === 0) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const currentUserId = currentUserResult[0].id;

    // Find users with matching phone numbers (excluding current user)
    const matchingUsers = await db`
      SELECT 
        p.id,
        p.username,
        p.wallet_address,
        p.avatar_url,
        p.phone_number,
        CASE 
          WHEN f.status = 'accepted' THEN 'friend'
          WHEN f.status = 'pending' AND f.player_id = ${currentUserId} THEN 'request_sent'
          WHEN f.status = 'pending' AND f.friend_id = ${currentUserId} THEN 'request_received'
          ELSE 'not_friend'
        END as friendship_status
      FROM players p
      LEFT JOIN friendships f ON (
        (f.player_id = ${currentUserId} AND f.friend_id = p.id) OR
        (f.friend_id = ${currentUserId} AND f.player_id = p.id)
      )
      WHERE p.phone_number = ANY(${phoneNumbers}) 
      AND p.id != ${currentUserId}
      AND p.phone_number IS NOT NULL
      ORDER BY p.username ASC
    `;

    // Format the response to include the matched phone number
    const formattedResults = matchingUsers.map(user => ({
      id: user.id,
      username: user.username,
      wallet_address: user.wallet_address,
      avatar_url: user.avatar_url,
      phone_number: user.phone_number, // Include for matching purposes
      friendship_status: user.friendship_status,
      can_add_friend: user.friendship_status === 'not_friend'
    }));

    return NextResponse.json({
      found_users: formattedResults,
      total_found: formattedResults.length,
      total_searched: phoneNumbers.length
    });
  } catch (error) {
    console.error('Error finding friends by phone:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 