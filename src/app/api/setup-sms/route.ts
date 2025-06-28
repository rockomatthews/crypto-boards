import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Adding SMS notification fields to database...');

    // Add SMS notification fields to players table
    await db`
      ALTER TABLE players 
      ADD COLUMN IF NOT EXISTS sms_notifications_enabled BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS sms_opted_in_at TIMESTAMP WITH TIME ZONE
    `;

    console.log('✅ SMS notification fields added successfully');
    
    // Check current state
    const playerCount = await db`
      SELECT COUNT(*) as count FROM players
    `;
    
    const smsEnabledCount = await db`
      SELECT COUNT(*) as count FROM players 
      WHERE sms_notifications_enabled = true
    `;

    console.log(`📊 Database Status:`);
    console.log(`   Total players: ${playerCount[0].count}`);
    console.log(`   SMS enabled: ${smsEnabledCount[0].count}`);
    
    return NextResponse.json({
      success: true,
      message: 'SMS database setup completed successfully',
      stats: {
        totalPlayers: parseInt(playerCount[0].count),
        smsEnabled: parseInt(smsEnabledCount[0].count)
      }
    });
    
  } catch (error) {
    console.error('❌ Error setting up SMS database:', error);
    return NextResponse.json({ 
      error: 'Failed to setup SMS database',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
