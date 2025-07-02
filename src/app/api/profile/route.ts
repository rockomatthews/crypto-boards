import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get('walletAddress');

  if (!walletAddress) {
    return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
  }

  try {
    console.log(`📊 Fetching profile for wallet: ${walletAddress}`);

    // Get the basic profile first
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
    `;

    if (playerResult.length === 0) {
      console.log(`👤 Creating new profile for ${walletAddress}`);
      
      // Create new profile if it doesn't exist
      const newProfile = await db`
        INSERT INTO players (wallet_address, username, avatar_url, phone_number)
        VALUES (${walletAddress}, ${`Player${walletAddress.slice(0, 4)}`}, '', NULL)
        RETURNING id, username, avatar_url, phone_number
      `;

      if (newProfile.length > 0) {
        // Create initial player stats record
        try {
          await db`
            INSERT INTO player_stats (player_id, games_played, games_won, total_winnings)
            VALUES (${newProfile[0].id}, 0, 0, 0)
          `;
          console.log(`✅ Created initial player stats for new user`);
        } catch (statsError) {
          console.warn('Failed to create initial player stats:', statsError);
        }

        return NextResponse.json({
          username: newProfile[0].username,
          avatar_url: newProfile[0].avatar_url,
          phone_number: newProfile[0].phone_number,
          sms_notifications_enabled: false,
          games_played: 0,
          games_won: 0,
          total_winnings: 0,
        });
      } else {
        console.error('❌ Failed to create new profile');
        return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
      }
    }

    const player = playerResult[0];
    console.log(`👤 Found existing player: ${player.username} (ID: ${player.id})`);

    // Get player stats separately with better error handling
    let statsResult;
    try {
      statsResult = await db`
        SELECT 
          games_played,
          games_won,
          total_winnings
        FROM player_stats 
        WHERE player_id = ${player.id}
      `;
    } catch (statsQueryError) {
      console.error('❌ Error querying player stats:', statsQueryError);
      // Return profile data with zero stats if stats query fails
      return NextResponse.json({
        username: player.username,
        avatar_url: player.avatar_url,
        phone_number: player.phone_number,
        sms_notifications_enabled: player.sms_notifications_enabled || false,
        sms_opted_in_at: player.sms_opted_in_at,
        games_played: 0,
        games_won: 0,
        total_winnings: 0,
      });
    }

    // If no stats exist, create them
    let gamesPlayed = 0;
    let gamesWon = 0; 
    let totalWinnings = 0;
    
    if (statsResult.length === 0) {
      console.log(`📊 No stats found - creating initial stats for player ${player.id}`);
      try {
        await db`
          INSERT INTO player_stats (player_id, games_played, games_won, total_winnings)
          VALUES (${player.id}, 0, 0, 0)
        `;
        console.log(`✅ Created initial player stats for ${walletAddress}`);
      } catch (statsError) {
        console.warn('Failed to create player stats:', statsError);
      }
    } else {
      const stats = statsResult[0];
      gamesPlayed = parseInt(stats.games_played?.toString() || '0') || 0;
      gamesWon = parseInt(stats.games_won?.toString() || '0') || 0;
      totalWinnings = parseFloat(stats.total_winnings?.toString() || '0') || 0;
      
      console.log(`📊 Player stats: ${gamesPlayed} games, ${gamesWon} wins, ${totalWinnings} SOL`);
    }

    const profileData = {
      username: player.username,
      avatar_url: player.avatar_url,
      phone_number: player.phone_number,
      sms_notifications_enabled: player.sms_notifications_enabled || false,
      sms_opted_in_at: player.sms_opted_in_at,
      games_played: gamesPlayed,
      games_won: gamesWon,
      total_winnings: totalWinnings,
    };

    console.log(`✅ Returning profile data for ${walletAddress}:`, profileData);
    return NextResponse.json(profileData);

  } catch (error) {
    console.error('❌ Error fetching profile:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      walletAddress
    });
    
    // Return a more detailed error in development
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? {
        message: error instanceof Error ? error.message : 'Unknown error',
        walletAddress
      } : undefined
    }, { status: 500 });
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