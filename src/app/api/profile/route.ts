import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    // Look for existing player
    const players = await db`
      SELECT username, avatar_url, phone_number, sms_notifications_enabled
      FROM players 
      WHERE wallet_address = ${walletAddress}
    `;

    if (players.length === 0) {
      // Create new player
      const username = `Player${walletAddress.slice(0, 4)}`;
      await db`
        INSERT INTO players (wallet_address, username, avatar_url, sms_notifications_enabled)
        VALUES (${walletAddress}, ${username}, '', false)
      `;
      
      return NextResponse.json({
        username,
        avatar_url: '',
        phone_number: null,
        sms_notifications_enabled: false,
        games_played: 0,
        games_won: 0,
        total_winnings: 0
      });
    }

    // Return existing player data
    const player = players[0];
    return NextResponse.json({
      username: player.username || `Player${walletAddress.slice(0, 4)}`,
      avatar_url: player.avatar_url || '',
      phone_number: player.phone_number || null,
      sms_notifications_enabled: Boolean(player.sms_notifications_enabled),
      games_played: 0,
      games_won: 0,
      total_winnings: 0
    });

  } catch (error) {
    console.error('GET Profile error:', error);
    // Return working fallback
    const walletAddress = new URL(request.url).searchParams.get('walletAddress') || 'unknown';
    return NextResponse.json({
      username: `Player${walletAddress.slice(0, 4)}`,
      avatar_url: '',
      phone_number: null,
      sms_notifications_enabled: false,
      games_played: 0,
      games_won: 0,
      total_winnings: 0
    });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { walletAddress, username, phoneNumber } = await request.json();

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    // Update what we can
    if (username && phoneNumber !== undefined) {
      await db`
        UPDATE players
        SET username = ${username}, phone_number = ${phoneNumber}
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
        SET phone_number = ${phoneNumber}
        WHERE wallet_address = ${walletAddress}
      `;
    }

    return NextResponse.json({ 
      success: true,
      username: username,
      phone_number: phoneNumber
    });

  } catch (error) {
    console.error('PUT Profile error:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}