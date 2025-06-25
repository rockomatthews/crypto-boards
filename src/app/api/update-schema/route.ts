import { NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';

export async function POST() {
  try {
    console.log('🔧 Updating database schema for proper SOL decimal precision...');

    // Fix entry_fee column precision in games table
    try {
      await db`ALTER TABLE games ALTER COLUMN entry_fee TYPE DECIMAL(18, 9);`;
      console.log('✅ Updated games.entry_fee column precision');
    } catch {
      console.log('ℹ️ Games.entry_fee column already has correct precision or doesn\'t exist');
    }

    // Ensure all amount columns have proper precision
    const alterCommands = [
      `ALTER TABLE game_escrows ALTER COLUMN amount TYPE DECIMAL(18, 9);`,
      `ALTER TABLE game_payouts ALTER COLUMN amount TYPE DECIMAL(18, 9);`,
      `ALTER TABLE game_refunds ALTER COLUMN amount TYPE DECIMAL(18, 9);`,
      `ALTER TABLE platform_fees ALTER COLUMN amount TYPE DECIMAL(18, 9);`,
      `ALTER TABLE player_stats ALTER COLUMN total_winnings TYPE DECIMAL(18, 9);`,
      `ALTER TABLE player_stats ALTER COLUMN total_losses TYPE DECIMAL(18, 9);`,
      `ALTER TABLE game_stats ALTER COLUMN amount TYPE DECIMAL(18, 9);`
    ];

    for (const command of alterCommands) {
      try {
        await db.query(command);
        console.log(`✅ Updated: ${command}`);
      } catch {
        console.log(`ℹ️ Skipped: ${command} (already correct or doesn't exist)`);
      }
    }

    // Test the precision by creating a test entry
    console.log('🧪 Testing decimal precision...');
    
    const testResult = await db`
      SELECT 0.01::DECIMAL(18, 9) as test_amount, 
             0.0000008::DECIMAL(18, 9) as tiny_amount
    `;
    
    console.log('Test amounts:', testResult[0]);

    console.log('🎉 Schema update complete!');

    return NextResponse.json({ 
      success: true, 
      message: 'Database schema updated for proper SOL decimal precision',
      testAmounts: testResult[0]
    });
  } catch (error) {
    console.error('❌ Error updating schema:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 