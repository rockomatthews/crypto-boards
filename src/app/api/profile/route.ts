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
        p.avatar_url,
        p.phone_number
      FROM players p
      WHERE p.wallet_address = ${walletAddress}
    `;

    if (result.length > 0) {
      return NextResponse.json({
        username: result[0].username,
        avatar_url: result[0].avatar_url,
        phone_number: result[0].phone_number,
        games_played: 0,
        games_won: 0,
        total_winnings: 0,
      });
    } else {
      // Create new profile if it doesn't exist
      const newProfile = await db`
        INSERT INTO players (wallet_address, username, avatar_url, phone_number)
        VALUES (${walletAddress}, ${`Player${walletAddress.slice(0, 4)}`}, '', NULL)
        RETURNING username, avatar_url, phone_number
      `;

      if (newProfile.length > 0) {
        return NextResponse.json({
          username: newProfile[0].username,
          avatar_url: newProfile[0].avatar_url,
          phone_number: newProfile[0].phone_number,
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
    const { walletAddress, username, phoneNumber } = await request.json();

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    // Build dynamic update query based on provided fields
    const updates = [];
    const values = [];
    
    if (username) {
      updates.push('username = $' + (values.length + 2)); // +2 because walletAddress is $1
      values.push(username);
    }
    
    if (phoneNumber !== undefined) { // Allow setting to null/empty
      updates.push('phone_number = $' + (values.length + 2));
      values.push(phoneNumber || null);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const query = `
      UPDATE players
      SET ${updates.join(', ')}
      WHERE wallet_address = $1
      RETURNING username, phone_number
    `;

    const result = await db.query(query, [walletAddress, ...values]);

    if (result.length > 0) {
      return NextResponse.json({ 
        username: result[0].username,
        phone_number: result[0].phone_number 
      });
    } else {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 