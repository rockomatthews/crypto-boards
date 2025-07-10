import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';

export async function GET(request: NextRequest) {
  try {
  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get('walletAddress');

  if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
  }

    console.log(`📡 GET: Fetching profile for wallet ${walletAddress.slice(0, 8)}`);

    // Get player data from players table
    const players = await db`
      SELECT wallet_address, username, phone_number, avatar_url
      FROM players 
      WHERE wallet_address = ${walletAddress}
    `;

    console.log(`🔍 GET: Database query returned ${players.length} rows:`, players);

    if (players.length === 0) {
      console.log(`⚠️ GET: No player found, creating new player for wallet ${walletAddress.slice(0, 8)}`);
      
      const shortWallet = walletAddress.slice(0, 8);
      const defaultUsername = `Player${shortWallet}`;
      
      // Create new player
      const newPlayers = await db`
        INSERT INTO players (wallet_address, username, phone_number, avatar_url)
        VALUES (${walletAddress}, ${defaultUsername}, null, '')
        ON CONFLICT (wallet_address) DO UPDATE SET username = ${defaultUsername}
        RETURNING wallet_address, username, phone_number, avatar_url
      `;
      
      console.log(`✅ GET: Created new player:`, newPlayers[0]);

        return NextResponse.json({
        username: newPlayers[0].username,
        avatar_url: newPlayers[0].avatar_url || '',
        phone_number: newPlayers[0].phone_number,
        sms_notifications_enabled: false,
          games_played: 0,
          games_won: 0,
        total_winnings: 0
        });
      }

    const player = players[0];
    console.log(`✅ GET: Found existing player - username=${player.username}, phone=${player.phone_number}`);

    return NextResponse.json({
      username: player.username,
      avatar_url: player.avatar_url || '',
      phone_number: player.phone_number,
      sms_notifications_enabled: false,
      games_played: 0,
      games_won: 0,
      total_winnings: 0
    });

  } catch (error) {
    console.error('GET Profile error:', error);
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { walletAddress, username, phoneNumber } = await request.json();

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    console.log(`📝 PUT: Updating wallet ${walletAddress.slice(0, 8)} with username=${username}, phone=${phoneNumber}`);

    // Update what we can and verify it worked
    let updateResult;
    
    if (username && phoneNumber !== undefined) {
      updateResult = await db`
        UPDATE players
        SET username = ${username}, phone_number = ${phoneNumber}
        WHERE wallet_address = ${walletAddress}
        RETURNING username, phone_number
      `;
    } else if (username) {
      updateResult = await db`
        UPDATE players
        SET username = ${username}
        WHERE wallet_address = ${walletAddress}
        RETURNING username, phone_number
      `;
    } else if (phoneNumber !== undefined) {
      updateResult = await db`
        UPDATE players
        SET phone_number = ${phoneNumber}
        WHERE wallet_address = ${walletAddress}
        RETURNING username, phone_number
      `;
    } else {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    console.log(`✅ PUT: Database returned ${updateResult.length} rows:`, updateResult);

    if (updateResult.length === 0) {
      console.error(`❌ PUT: No rows updated - player not found for wallet ${walletAddress}`);
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const result = updateResult[0];
    console.log(`✅ PUT: Successfully updated to username=${result.username}, phone=${result.phone_number}`);

    return NextResponse.json({ 
      success: true,
      username: result.username,
      phone_number: result.phone_number
    });

  } catch (error) {
    console.error('PUT Profile error:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
} 