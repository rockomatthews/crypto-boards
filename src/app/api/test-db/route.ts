import { NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';

export async function GET() {
  try {
    console.log('🔍 Testing database operations...');

    const testWallet = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';

    // Test 1: Check if player exists
    console.log('📋 Step 1: Checking if player exists...');
    const existing = await db`
      SELECT id, username, wallet_address FROM players 
      WHERE wallet_address = ${testWallet}
    `;
    console.log('Existing player:', existing);

    // Test 2: Try to update directly
    console.log('📋 Step 2: Attempting direct update...');
    const updateResult = await db`
      UPDATE players 
      SET username = 'DirectUpdate_' || EXTRACT(EPOCH FROM NOW())::text
      WHERE wallet_address = ${testWallet}
      RETURNING id, username, wallet_address
    `;
    console.log('Update result:', updateResult);

    // Test 3: Verify the update
    console.log('📋 Step 3: Verifying update...');
    const verification = await db`
      SELECT id, username, wallet_address FROM players 
      WHERE wallet_address = ${testWallet}
    `;
    console.log('Verification result:', verification);

    // Test 4: Check database connection info
    console.log('📋 Step 4: Database connection test...');
    const dbTest = await db`SELECT NOW() as current_time, version() as db_version`;
    console.log('DB connection test:', dbTest);

    return NextResponse.json({
      success: true,
      tests: {
        existingPlayer: existing,
        updateResult: updateResult,
        verification: verification,
        dbConnection: dbTest[0]
      }
    });

  } catch (error) {
    console.error('❌ Database test failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ 
      error: 'Database test failed', 
      details: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
} 