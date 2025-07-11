import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';

export async function PUT(request: NextRequest) {
  try {
    const { walletAddress, smsNotificationsEnabled } = await request.json();

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    if (typeof smsNotificationsEnabled !== 'boolean') {
      return NextResponse.json({ error: 'SMS notifications enabled flag is required' }, { status: 400 });
    }

    console.log(`📱 Updating SMS preferences for ${walletAddress.slice(0, 8)}... to ${smsNotificationsEnabled}`);

    // First, ensure SMS columns exist in the database
    try {
      await db`
        ALTER TABLE players 
        ADD COLUMN IF NOT EXISTS sms_notifications_enabled BOOLEAN NOT NULL DEFAULT false
      `;
      await db`
        ALTER TABLE players 
        ADD COLUMN IF NOT EXISTS sms_opted_in_at TIMESTAMP WITH TIME ZONE
      `;
      console.log('✅ Ensured SMS columns exist');
    } catch (alterError) {
      console.warn('⚠️ Could not add SMS columns (they might already exist):', alterError);
    }

    // Check if player exists
    const playerResult = await db`
      SELECT id, phone_number FROM players WHERE wallet_address = ${walletAddress}
    `;

    if (playerResult.length === 0) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const player = playerResult[0];

    // Check if player has a phone number when trying to enable SMS
    if (smsNotificationsEnabled && !player.phone_number) {
      return NextResponse.json({ 
        error: 'Phone number is required to enable SMS notifications' 
      }, { status: 400 });
    }

    // Update SMS preferences
    const updateResult = smsNotificationsEnabled 
      ? await db`
          UPDATE players
          SET 
            sms_notifications_enabled = ${smsNotificationsEnabled},
            sms_opted_in_at = CURRENT_TIMESTAMP
          WHERE wallet_address = ${walletAddress}
          RETURNING sms_notifications_enabled, sms_opted_in_at
        `
      : await db`
          UPDATE players
          SET 
            sms_notifications_enabled = ${smsNotificationsEnabled},
            sms_opted_in_at = NULL
          WHERE wallet_address = ${walletAddress}
          RETURNING sms_notifications_enabled, sms_opted_in_at
        `;

    if (updateResult.length > 0) {
      console.log(`✅ SMS preferences updated successfully`);
      return NextResponse.json({
        sms_notifications_enabled: updateResult[0].sms_notifications_enabled,
        sms_opted_in_at: updateResult[0].sms_opted_in_at,
      });
    } else {
      return NextResponse.json({ error: 'Failed to update SMS preferences' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error updating SMS preferences:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 