import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';
import twilio from 'twilio';

// Initialize Twilio client with validation
const twilioClient = (() => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
  
  if (!accountSid || !authToken || !phoneNumber) {
    console.warn('⚠️ Twilio credentials missing. SMS functionality will be disabled.');
    return null;
  }
  
  return twilio(accountSid, authToken);
})();

// Twilio SMS service
const sendSMS = async (phoneNumber: string, message: string) => {
  // Check if Twilio is configured
  if (!twilioClient) {
    throw new Error('Twilio is not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER environment variables.');
  }
  
  try {
    // Ensure phone number has country code
    const formattedNumber = phoneNumber.startsWith('+') ? phoneNumber : `+1${phoneNumber}`;
    
    console.log(`📱 Sending SMS to ${formattedNumber}: ${message}`);
    
    const twilioResponse = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER, // Your Twilio phone number
      to: formattedNumber
    });
    
    console.log(`✅ SMS sent successfully. SID: ${twilioResponse.sid}`);
    
    return {
      success: true,
      messageId: twilioResponse.sid,
      status: twilioResponse.status,
      to: twilioResponse.to
    };
  } catch (error) {
    console.error('❌ Twilio SMS error:', error);
    throw new Error(`Failed to send SMS: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export async function POST(request: NextRequest) {
  try {
    const { 
      senderWalletAddress, 
      phoneNumbers, 
      gameType, 
      entryFee, 
      lobbyId 
    } = await request.json();

    if (!senderWalletAddress || !phoneNumbers || !Array.isArray(phoneNumbers)) {
      return NextResponse.json({ 
        error: 'Sender wallet address and phone numbers are required' 
      }, { status: 400 });
    }

    // Check if Twilio is configured
    if (!twilioClient) {
      return NextResponse.json({ 
        error: 'SMS service is not configured. Please contact administrator.',
        details: 'Twilio credentials are missing from server configuration.'
      }, { status: 503 });
    }

    // Get sender info
    const senderResult = await db`
      SELECT username FROM players WHERE wallet_address = ${senderWalletAddress}
    `;

    if (senderResult.length === 0) {
      return NextResponse.json({ error: 'Sender not found' }, { status: 404 });
    }

    const senderUsername = senderResult[0].username;

    // Create SMS message
    const gameTypeDisplay = gameType.charAt(0).toUpperCase() + gameType.slice(1);
    const message = `🎮 ${senderUsername} invited you to play ${gameTypeDisplay} for ${entryFee} SOL! Join at solboardgames.com/lobby/${lobbyId}`;

    // Send SMS to each phone number
    const results = [];
    for (const phoneNumber of phoneNumbers) {
      try {
        // Clean phone number (remove any formatting)
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        
        if (cleanPhone.length < 10) {
          results.push({ 
            phoneNumber, 
            success: false, 
            error: 'Invalid phone number' 
          });
          continue;
        }

        const smsResult = await sendSMS(cleanPhone, message);
        results.push({ 
          phoneNumber, 
          success: true, 
          messageId: smsResult.messageId,
          status: smsResult.status 
        });

        // Log the invitation in database (optional)
        await db`
          INSERT INTO sms_invitations (
            sender_wallet, 
            phone_number, 
            lobby_id, 
            message, 
            sent_at
          ) VALUES (
            ${senderWalletAddress}, 
            ${cleanPhone}, 
            ${lobbyId}, 
            ${message}, 
            CURRENT_TIMESTAMP
          )
        `;

      } catch (error) {
        console.error(`Error sending SMS to ${phoneNumber}:`, error);
        results.push({ 
          phoneNumber, 
          success: false, 
          error: 'Failed to send SMS' 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount
      },
      message: `Sent ${successCount} SMS invitation${successCount !== 1 ? 's' : ''}${failureCount > 0 ? `, ${failureCount} failed` : ''}`
    });

  } catch (error) {
    console.error('Error sending SMS invitations:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 