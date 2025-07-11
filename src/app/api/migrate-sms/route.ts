import { NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';

export async function POST() {
  try {
    console.log('🔧 SMS Database Migration Starting...');

    // Check if columns already exist
    let columnsExist = false;
    try {
      await db`
        SELECT sms_notifications_enabled, sms_opted_in_at 
        FROM players 
        LIMIT 1
      `;
      columnsExist = true;
      console.log('✅ SMS columns already exist');
    } catch {
      console.log('📝 SMS columns do not exist, will create them');
    }

    if (!columnsExist) {
      // Add SMS notification columns
      console.log('🔧 Adding sms_notifications_enabled column...');
      await db`
        ALTER TABLE players 
        ADD COLUMN sms_notifications_enabled BOOLEAN NOT NULL DEFAULT false
      `;

      console.log('🔧 Adding sms_opted_in_at column...');
      await db`
        ALTER TABLE players 
        ADD COLUMN sms_opted_in_at TIMESTAMP WITH TIME ZONE
      `;

      console.log('✅ SMS columns added successfully');
    }

    // Create SMS invitations table if it doesn't exist
    console.log('🔧 Creating sms_invitations table...');
    await db`
      CREATE TABLE IF NOT EXISTS sms_invitations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_wallet TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        lobby_id TEXT NOT NULL,
        message TEXT NOT NULL,
        sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // Test the columns work
    console.log('🧪 Testing SMS functionality...');
    const testResult = await db`
      SELECT 
        COUNT(*) as total_players,
        COUNT(CASE WHEN sms_notifications_enabled = true THEN 1 END) as sms_enabled_count
      FROM players
    `;

    const stats = testResult[0];
    console.log(`📊 Migration Results:`);
    console.log(`   Total players: ${stats.total_players}`);
    console.log(`   SMS enabled: ${stats.sms_enabled_count}`);

    return NextResponse.json({
      success: true,
      message: 'SMS database migration completed successfully! 📱',
      stats: {
        totalPlayers: parseInt(stats.total_players.toString()),
        smsEnabledCount: parseInt(stats.sms_enabled_count.toString()),
        columnsExisted: columnsExist
      },
      next_steps: [
        '✅ SMS preferences toggle should now work in profile',
        '✅ SMS invitations should work in lobby creation',
        '✅ All SMS functionality is now active'
      ]
    });
    
  } catch (error) {
    console.error('❌ SMS migration error:', error);
    return NextResponse.json({ 
      error: 'SMS migration failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      suggestion: 'Check database permissions and try again'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'SMS Migration Endpoint',
    instructions: 'Send POST request to run SMS database migration',
    purpose: 'Adds SMS notification columns to production database'
  });
} 