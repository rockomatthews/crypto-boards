import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';

interface StatsRecord {
  games_played?: number;
  games_won?: number;
  total_winnings?: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    console.log(`🔍 GET profile for wallet: ${walletAddress.slice(0, 8)}...`);

    // Get player info - with error handling
    let playerResult;
    try {
      playerResult = await db`
        SELECT 
          id,
          username,
          avatar_url,
          phone_number,
          sms_notifications_enabled,
          sms_opted_in_at
        FROM players 
        WHERE wallet_address = ${walletAddress}
        LIMIT 1
      `;
      console.log(`📊 Player query found ${playerResult.length} results`);
    } catch (playerQueryError) {
      console.error(`❌ Player query error:`, playerQueryError);
      return NextResponse.json({ error: 'Database query failed' }, { status: 500 });
    }

    if (playerResult.length === 0) {
      // Create new player if not found
      console.log(`🆕 Creating new player...`);
      try {
        const newUsername = `Player${walletAddress.slice(0, 4)}`;
        const newPlayerResult = await db`
          INSERT INTO players (wallet_address, username, avatar_url, phone_number)
          VALUES (${walletAddress}, ${newUsername}, '', NULL)
          RETURNING id, username, avatar_url, phone_number, sms_notifications_enabled, sms_opted_in_at
        `;
        
        if (newPlayerResult.length > 0) {
          const newPlayer = newPlayerResult[0];
          console.log(`✅ Created player: ${newPlayer.username}`);
          return NextResponse.json({
            username: newPlayer.username,
            avatar_url: newPlayer.avatar_url || '',
            phone_number: newPlayer.phone_number,
            sms_notifications_enabled: newPlayer.sms_notifications_enabled || false,
            sms_opted_in_at: newPlayer.sms_opted_in_at,
            games_played: 0,
            games_won: 0,
            total_winnings: 0
          });
        }
      } catch (createError) {
        console.error(`❌ Player creation error:`, createError);
        return NextResponse.json({ error: 'Failed to create player' }, { status: 500 });
      }
    }

    const player = playerResult[0];
    console.log(`👤 Found existing player: ${player.username} (ID: ${player.id})`);

    // Get stats with error handling
    let statsResult: StatsRecord[] = [];
    try {
      statsResult = await db`
        SELECT games_played, games_won, total_winnings
        FROM player_stats 
        WHERE player_id = ${player.id}
        LIMIT 1
      `;
    } catch (statsError) {
      console.error(`❌ Stats query error:`, statsError);
      // Continue with default stats
      statsResult = [];
    }

    const stats = statsResult.length > 0 ? statsResult[0] : {
      games_played: 0,
      games_won: 0,
      total_winnings: 0
    };

    const response = {
      username: player.username,
      avatar_url: player.avatar_url || '',
      phone_number: player.phone_number,
      sms_notifications_enabled: player.sms_notifications_enabled || false,
      sms_opted_in_at: player.sms_opted_in_at,
      games_played: parseInt(stats.games_played?.toString() || '0'),
      games_won: parseInt(stats.games_won?.toString() || '0'),
      total_winnings: parseFloat(stats.total_winnings?.toString() || '0')
    };

    console.log(`✅ Returning profile:`, { username: response.username, phone_number: response.phone_number });
    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Profile GET error:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    console.log('🔄 Profile PUT API called');
    const { walletAddress, username, phoneNumber } = await request.json();

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    console.log(`📝 Updating profile for ${walletAddress.slice(0, 8)}...`, { username, phoneNumber });

    // Update player with provided fields
    let updateQuery;
    
    if (username && phoneNumber !== undefined) {
      // Update both username and phone
      updateQuery = await db`
        UPDATE players
        SET username = ${username}, phone_number = ${phoneNumber || null}
        WHERE wallet_address = ${walletAddress}
        RETURNING username, phone_number
      `;
    } else if (username) {
      // Update only username
      updateQuery = await db`
        UPDATE players
        SET username = ${username}
        WHERE wallet_address = ${walletAddress}
        RETURNING username, phone_number
      `;
    } else if (phoneNumber !== undefined) {
      // Update only phone number
      updateQuery = await db`
        UPDATE players
        SET phone_number = ${phoneNumber || null}
        WHERE wallet_address = ${walletAddress}
        RETURNING username, phone_number
      `;
    } else {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    console.log(`✅ Update query returned ${updateQuery.length} rows`);

    if (updateQuery.length > 0) {
      const result = {
        username: updateQuery[0].username,
        phone_number: updateQuery[0].phone_number
      };
      console.log(`✅ Profile updated successfully:`, result);
      return NextResponse.json(result);
    } else {
      console.error(`❌ Profile not found for wallet ${walletAddress}`);
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('❌ Error updating profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}