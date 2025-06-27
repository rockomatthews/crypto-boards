#!/usr/bin/env node

// Test script to verify game completion works properly
// This simulates the API calls that happen when a game finishes

const API_BASE = 'https://www.solboardgames.com';

async function testGameCompletion() {
  console.log('🧪 Testing game completion flow...\n');
  
  try {
    // 1. Test escrow status for a completed game
    console.log('1️⃣ Testing escrow status...');
    const escrowResponse = await fetch(`${API_BASE}/api/games/83d46296-8103-4dde-986a-3b533731a9e8/escrow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'get_escrow_status'
      })
    });
    
    if (escrowResponse.ok) {
      const escrowData = await escrowResponse.json();
      console.log('✅ Escrow status retrieved:', escrowData);
    } else {
      console.log('❌ Escrow status failed:', escrowResponse.status, await escrowResponse.text());
    }
    
    console.log('');
    
    // 2. Test player stats retrieval
    console.log('2️⃣ Testing player stats...');
    
    // Test with a sample wallet (you'll need to replace with actual wallet addresses)
    const testWallets = [
      'CHyQpdkGgoQbQDdm9vgjc3NpiBQ9wQ8Fu8LHQaPwoNdN', // Platform wallet
      // Add more test wallets if available
    ];
    
    for (const wallet of testWallets) {
      try {
        const statsResponse = await fetch(`${API_BASE}/api/profile/stats?wallet=${wallet}`);
        
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          console.log(`✅ Stats for ${wallet.slice(0, 8)}...:`);
          console.log(`   Games: ${statsData.summary.totalGames}, Wins: ${statsData.summary.wins}, Winnings: ${statsData.summary.totalWinnings} SOL`);
        } else {
          console.log(`❌ Stats failed for ${wallet.slice(0, 8)}...:`, statsResponse.status);
        }
      } catch (error) {
        console.log(`❌ Stats error for ${wallet.slice(0, 8)}...:`, error.message);
      }
    }
    
    console.log('');
    
    // 3. Test profile data
    console.log('3️⃣ Testing profile data...');
    
    for (const wallet of testWallets) {
      try {
        const profileResponse = await fetch(`${API_BASE}/api/profile?walletAddress=${wallet}`);
        
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          console.log(`✅ Profile for ${wallet.slice(0, 8)}...:`);
          console.log(`   Username: ${profileData.username}, Games: ${profileData.games_played}, Winnings: ${profileData.total_winnings} SOL`);
        } else {
          console.log(`❌ Profile failed for ${wallet.slice(0, 8)}...:`, profileResponse.status);
        }
      } catch (error) {
        console.log(`❌ Profile error for ${wallet.slice(0, 8)}...:`, error.message);
      }
    }
    
    console.log('');
    
    // 4. Test game feed
    console.log('4️⃣ Testing game feed...');
    
    try {
      const feedResponse = await fetch(`${API_BASE}/api/games/feed?limit=5`);
      
      if (feedResponse.ok) {
        const feedData = await feedResponse.json();
        console.log(`✅ Game feed retrieved: ${feedData.feed.length} recent games`);
        
        if (feedData.feed.length > 0) {
          const latest = feedData.feed[0];
          console.log(`   Latest: ${latest.winner.username} beat ${latest.loser.username} in ${latest.gameType} for ${latest.entryFee} SOL`);
        }
      } else {
        console.log('❌ Game feed failed:', feedResponse.status);
      }
    } catch (error) {
      console.log('❌ Game feed error:', error.message);
    }
    
    console.log('');
    
    // 5. Test database setup (should already be done)
    console.log('5️⃣ Testing database setup...');
    
    try {
      const setupResponse = await fetch(`${API_BASE}/api/setup-db`, {
        method: 'POST'
      });
      
      if (setupResponse.ok) {
        const setupData = await setupResponse.json();
        console.log('✅ Database setup confirmed:', setupData.tables.length, 'tables exist');
      } else {
        console.log('❌ Database setup failed:', setupResponse.status);
      }
    } catch (error) {
      console.log('❌ Database setup error:', error.message);
    }
    
    console.log('\n🎉 Test completed! Check the results above to see if game completion is working properly.');
    console.log('💡 If escrow and stats APIs are working, your next checkers game should complete properly and update player stats!');
    
  } catch (error) {
    console.error('❌ Test script failed:', error);
  }
}

testGameCompletion(); 