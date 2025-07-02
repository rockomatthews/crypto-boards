import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get('avatar') as File;
    const walletAddress = formData.get('walletAddress') as string;

    if (!image || !walletAddress) {
      return NextResponse.json({ error: 'Avatar and wallet address are required' }, { status: 400 });
    }

    // Validate file type
    if (!image.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Validate file size (max 5MB)
    if (image.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image size must be less than 5MB' }, { status: 400 });
    }

    // Convert image to base64 for storage
    const arrayBuffer = await image.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const dataUrl = `data:${image.type};base64,${base64}`;

    // Update the player's avatar_url in the database
    const result = await db`
      UPDATE players
      SET avatar_url = ${dataUrl}
      WHERE wallet_address = ${walletAddress}
      RETURNING avatar_url
    `;

    if (result.length > 0) {
      return NextResponse.json({ avatar_url: result[0].avatar_url });
    } else {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error uploading avatar:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 