import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    // Get or create player
    const player = await db`
      SELECT username, avatar_url, phone_number, sms_notifications_enabled, sms_opted_in_at
      FROM players 
      WHERE wallet_address = ${walletAddress}
    `;

    if (player.length === 0) {
      // Create new player
      const username = `Player${walletAddress.slice(0, 4)}`;
      await db`
        INSERT INTO players (wallet_address, username, avatar_url)
        VALUES (${walletAddress}, ${username}, '')
      `;
      
      return NextResponse.json({
        username,
        avatar_url: '',
        phone_number: null,
        sms_notifications_enabled: false,
        sms_opted_in_at: null,
        games_played: 0,
        games_won: 0,
        total_winnings: 0
      });
    }

    const playerData = player[0];
    
    return NextResponse.json({
      username: playerData.username,
      avatar_url: playerData.avatar_url || '',
      phone_number: playerData.phone_number,
      sms_notifications_enabled: playerData.sms_notifications_enabled || false,
      sms_opted_in_at: playerData.sms_opted_in_at,
      games_played: 0,
      games_won: 0,
      total_winnings: 0
    });

  } catch (error) {
    console.error('Profile GET error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { walletAddress, username, phoneNumber } = await request.json();

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    // Simple update
    if (username && phoneNumber !== undefined) {
      await db`
        UPDATE players
        SET username = ${username}, phone_number = ${phoneNumber || null}
        WHERE wallet_address = ${walletAddress}
      `;
    } else if (username) {
      await db`
        UPDATE players
        SET username = ${username}
        WHERE wallet_address = ${walletAddress}
      `;
    } else if (phoneNumber !== undefined) {
      await db`
        UPDATE players
        SET phone_number = ${phoneNumber || null}
        WHERE wallet_address = ${walletAddress}
      `;
    }

    return NextResponse.json({ 
      success: true,
      username: username || 'updated',
      phone_number: phoneNumber
    });

  } catch (error) {
    console.error('Profile PUT error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}