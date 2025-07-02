import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    message: 'Deployment test successful!',
    timestamp: new Date().toISOString(),
    version: '2024-12-20-fixes',
    profileApiFix: 'DEPLOYED',
    directSolPaymentFix: 'DEPLOYED'
  });
} 