import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';

export async function GET(request: NextRequest) {
  // FAILSAFE: Always return valid JSON, never crash
  try {
    console.log(`🔍 Profile API called at ${new Date().toISOString()}`);

    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      console.log('❌ No wallet address provided');
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    console.log(`👤 Fetching profile for wallet: ${walletAddress.slice(0, 8)}...`);

    // STEP 1: Get basic player info (with maximum safety)
    let player = null;
    try {
      console.log('🔍 Querying players table...');
      const playerResult = await db`
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
      
      console.log(`✅ Player query returned ${playerResult.length} results`);
      
      if (playerResult.length > 0) {
        player = playerResult[0];
        console.log(`👤 Found player: ${player.username} (ID: ${player.id})`);
      }
    } catch (playerError) {
      console.error('❌ Error querying players table:', playerError);
      // Continue with player creation attempt
    }

    // STEP 2: Create player if not found (with maximum safety)
    if (!player) {
      console.log(`🆕 Creating new player for ${walletAddress.slice(0, 8)}...`);
      try {
        const newUsername = `Player${walletAddress.slice(0, 4)}`;
        const newPlayerResult = await db`
          INSERT INTO players (wallet_address, username, avatar_url, phone_number)
          VALUES (${walletAddress}, ${newUsername}, '', NULL)
          RETURNING id, username, avatar_url, phone_number
        `;

        if (newPlayerResult.length > 0) {
          player = {
            id: newPlayerResult[0].id,
            username: newPlayerResult[0].username,
            avatar_url: newPlayerResult[0].avatar_url,
            phone_number: newPlayerResult[0].phone_number,
            sms_notifications_enabled: false,
            sms_opted_in_at: null
          };
          console.log(`✅ Created new player: ${player.username}`);
        }
      } catch (createError) {
        console.error('❌ Error creating player:', createError);
        // Return fallback response instead of crashing
        return NextResponse.json({
          username: `Player${walletAddress.slice(0, 4)}`,
          avatar_url: '',
          phone_number: null,
          sms_notifications_enabled: false,
          games_played: 0,
          games_won: 0,
          total_winnings: 0,
          error: 'Could not create or retrieve player'
        });
      }
    }

    // FAILSAFE: If still no player, return fallback
    if (!player) {
      console.error('❌ No player data available, returning fallback');
      return NextResponse.json({
        username: `Player${walletAddress.slice(0, 4)}`,
        avatar_url: '',
        phone_number: null,
        sms_notifications_enabled: false,
        games_played: 0,
        games_won: 0,
        total_winnings: 0,
        error: 'Player data unavailable'
      });
    }

    // STEP 3: Get stats (with maximum safety)
    let stats = {
      games_played: 0,
      games_won: 0,
      total_winnings: 0
    };

    try {
      console.log(`📊 Querying stats for player ${player.id}...`);
      const statsResult = await db`
        SELECT 
          COALESCE(games_played, 0) as games_played,
          COALESCE(games_won, 0) as games_won,
          COALESCE(total_winnings, 0) as total_winnings
        FROM player_stats 
        WHERE player_id = ${player.id}
        LIMIT 1
      `;

      if (statsResult.length > 0) {
        const rawStats = statsResult[0];
        stats = {
          games_played: parseInt(rawStats.games_played?.toString() || '0') || 0,
          games_won: parseInt(rawStats.games_won?.toString() || '0') || 0,
          total_winnings: parseFloat(rawStats.total_winnings?.toString() || '0') || 0
        };
        console.log(`📊 Found stats: ${stats.games_played} games, ${stats.games_won} wins, ${stats.total_winnings} SOL`);
      } else {
        console.log('📊 No stats found, attempting to create...');
        // Try to create stats record
        try {
          await db`
            INSERT INTO player_stats (player_id, games_played, games_won, total_winnings)
            VALUES (${player.id}, 0, 0, 0)
            ON CONFLICT (player_id) DO NOTHING
          `;
          console.log('✅ Created initial stats record');
        } catch (createStatsError) {
          console.warn('⚠️ Could not create stats record:', createStatsError);
          // Use default stats (already set above)
        }
      }
    } catch (statsError) {
      console.error('❌ Error querying stats:', statsError);
      // Use default stats (already set above)
    }

    // STEP 4: Build response (with maximum safety)
    const response = {
      username: player.username || `Player${walletAddress.slice(0, 4)}`,
      avatar_url: player.avatar_url || '',
      phone_number: player.phone_number || null,
      sms_notifications_enabled: player.sms_notifications_enabled || false,
      sms_opted_in_at: player.sms_opted_in_at || null,
      games_played: stats.games_played,
      games_won: stats.games_won,
      total_winnings: stats.total_winnings
    };

    console.log(`✅ Returning profile for ${walletAddress.slice(0, 8)}:`, {
      username: response.username,
      games_played: response.games_played,
      games_won: response.games_won,
      total_winnings: response.total_winnings
    });

    return NextResponse.json(response);

  } catch (fatalError) {
    // ABSOLUTE FAILSAFE: Even if everything else fails, return valid JSON
    console.error('💥 FATAL ERROR in profile API:', fatalError);
    console.error('Error stack:', fatalError instanceof Error ? fatalError.stack : 'No stack trace');
    
    const walletFromUrl = request.url.split('walletAddress=')[1]?.split('&')[0] || 'unknown';
    
    return NextResponse.json({
      username: `Player${walletFromUrl.slice(0, 4)}`,
      avatar_url: '',
      phone_number: null,
      sms_notifications_enabled: false,
      games_played: 0,
      games_won: 0,
      total_winnings: 0,
      error: 'Profile service temporarily unavailable'
    }, { status: 200 }); // Return 200 even on error to avoid crashes
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