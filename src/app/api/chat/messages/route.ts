import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    // Get recent global chat messages (last 50)
    const messages = await db`
      SELECT 
        cm.id,
        cm.sender_id,
        cm.content,
        cm.message_type,
        cm.created_at,
        cm.is_global,
        cm.recipient_id,
        p.username as sender_username,
        p.avatar_url as sender_avatar
      FROM chat_messages cm
      JOIN players p ON cm.sender_id = p.id
      WHERE cm.is_global = true
      ORDER BY cm.created_at DESC
      LIMIT 50
    `;

    // Reverse to show oldest first
    const reversedMessages = messages.reverse();

    return NextResponse.json(reversedMessages);
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { walletAddress, content, messageType = 'text', isGlobal = true, recipientId } = await request.json();

    if (!walletAddress || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get sender player ID
    const playerResult = await db`
      SELECT id FROM players WHERE wallet_address = ${walletAddress}
    `;

    if (playerResult.length === 0) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const senderId = playerResult[0].id;

    // Insert the message
    const messageResult = await db`
      INSERT INTO chat_messages (sender_id, content, message_type, is_global, recipient_id)
      VALUES (${senderId}, ${content}, ${messageType}, ${isGlobal}, ${recipientId || null})
      RETURNING *
    `;

    // Update player's online status
    await db`
      INSERT INTO online_users (player_id, last_seen, is_online)
      VALUES (${senderId}, CURRENT_TIMESTAMP, true)
      ON CONFLICT (player_id) 
      DO UPDATE SET last_seen = CURRENT_TIMESTAMP, is_online = true
    `;

    return NextResponse.json(messageResult[0]);
  } catch (error) {
    console.error('Error sending chat message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 