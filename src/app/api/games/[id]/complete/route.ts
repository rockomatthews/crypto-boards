/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';
import smsService from '@/lib/sms';
import { 
  Connection, 
  PublicKey, 
  LAMPORTS_PER_SOL,
  Keypair,
  Transaction,
  SystemProgram
} from '@solana/web3.js';

// Direct SOL transfer function
async function sendSOLDirectly(
  fromPrivateKey: string,
  toWallet: string,
  amount: number,
  gameId: string
): Promise<{ success: boolean; signature?: string; error?: string; debugLogs?: string[] }> {
  const debugLogs: string[] = [];
  
  const log = (message: string) => {
    console.log(message);
    debugLogs.push(message);
  };
  
  const logError = (message: string, error?: any) => {
    const fullMessage = error ? `${message}: ${error}` : message;
    console.error(fullMessage);
    debugLogs.push(fullMessage);
  };
  
  log(`🚀 ENTERED sendSOLDirectly function with params: ${JSON.stringify({
    toWallet: toWallet.slice(0, 8) + '...',
    amount,
    gameId,
    keyLength: fromPrivateKey.length
  })}`);
  
  // LOG THE ACTUAL ENVIRONMENT VARIABLE FORMAT
  log(`🔍 RAW PRIVATE KEY ANALYSIS:`);
  log(`🔍 Length: ${fromPrivateKey.length}`);
  log(`🔍 Starts with [: ${fromPrivateKey.startsWith('[')}`);
  log(`🔍 Ends with ]: ${fromPrivateKey.endsWith(']')}`);
  log(`🔍 First 50 chars: "${fromPrivateKey.slice(0, 50)}"`);
  log(`🔍 Last 20 chars: "${fromPrivateKey.slice(-20)}"`);
  
  // Check if it's base58, base64, hex, or JSON
  if (fromPrivateKey.startsWith('[') && fromPrivateKey.endsWith(']')) {
    try {
      const parsed = JSON.parse(fromPrivateKey);
      log(`🔍 JSON array with ${parsed.length} elements`);
      log(`🔍 First 10 elements: ${parsed.slice(0, 10)}`);
      log(`🔍 Last 10 elements: ${parsed.slice(-10)}`);
    } catch (e) {
      logError(`🔍 Failed to parse as JSON:`, e);
    }
  } else {
    log(`🔍 Not a JSON array - might be base58/base64/hex`);
  }
  
  try {
    log(`💰 DIRECT SOL TRANSFER: ${amount} SOL to ${toWallet} for game ${gameId}`);

    // Get connection
    const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    log(`🔗 Using RPC: ${RPC_URL}`);
    const connection = new Connection(RPC_URL, 'confirmed');

    // Parse private key
    let privateKeyBytes: Uint8Array;
    log(`🔑 Parsing private key (length: ${fromPrivateKey.length})`);
    log(`🔑 First 20 chars: ${fromPrivateKey.slice(0, 20)}...`);
    log(`🔑 Last 20 chars: ...${fromPrivateKey.slice(-20)}`);
    
    try {
      // Try JSON array format first (most common)
      if (fromPrivateKey.startsWith('[') && fromPrivateKey.endsWith(']')) {
        log(`🔑 Parsing as JSON array`);
        const keyArray = JSON.parse(fromPrivateKey);
        privateKeyBytes = new Uint8Array(keyArray);
        log(`🔑 JSON array has ${keyArray.length} elements`);
        log(`🔑 First 10 bytes: ${Array.from(privateKeyBytes.slice(0, 10))}`);
      } 
      // Try base58 format first for 88-character strings (standard Solana format)
      else if (fromPrivateKey.length === 88) {
        log(`🔑 Parsing as base58 (length ${fromPrivateKey.length}) - Standard Solana format`);
        log(`🔑 Base58 string sample: "${fromPrivateKey.slice(0, 20)}...${fromPrivateKey.slice(-10)}"`);
        
        try {
          const bs58 = await import('bs58');
          privateKeyBytes = bs58.default.decode(fromPrivateKey);
          log(`✅ Base58 decoded to ${privateKeyBytes.length} bytes`);
          log(`🔑 Decoded first 10 bytes: ${Array.from(privateKeyBytes.slice(0, 10))}`);
          log(`🔑 Decoded last 10 bytes: ${Array.from(privateKeyBytes.slice(-10))}`);
        } catch (base58Error) {
          logError(`❌ Base58 decoding failed, trying base64 fallback`, base58Error);
          
          // Fallback to base64 if base58 fails
          try {
            privateKeyBytes = new Uint8Array(Buffer.from(fromPrivateKey, 'base64'));
            log(`✅ Base64 fallback decoded to ${privateKeyBytes.length} bytes`);
          } catch (base64Error) {
            logError(`❌ Both base58 and base64 decoding failed`, base64Error);
            throw new Error(`Failed to decode 88-char key as base58 or base64: ${base58Error}`);
          }
        }
      }
      // Try base64 format for other lengths
      else if (fromPrivateKey.length === 44) {
        log(`🔑 Parsing as base64 (length ${fromPrivateKey.length})`);
        log(`🔑 Base64 string sample: "${fromPrivateKey.slice(0, 20)}...${fromPrivateKey.slice(-10)}"`);
        
        try {
          privateKeyBytes = new Uint8Array(Buffer.from(fromPrivateKey, 'base64'));
          log(`✅ Base64 decoded to ${privateKeyBytes.length} bytes`);
          log(`🔑 Decoded first 10 bytes: ${Array.from(privateKeyBytes.slice(0, 10))}`);
          log(`🔑 Decoded last 10 bytes: ${Array.from(privateKeyBytes.slice(-10))}`);
        } catch (base64Error) {
          logError(`❌ Base64 decoding failed`, base64Error);
          throw new Error(`Failed to decode base64 private key: ${base64Error}`);
        }
      }
      // Try hex format  
      else if (fromPrivateKey.length === 128) {
        log(`🔑 Parsing as hex string (length ${fromPrivateKey.length})`);
        privateKeyBytes = new Uint8Array(Buffer.from(fromPrivateKey, 'hex'));
      }
      // Try bs58 format
      else {
        log(`🔑 Parsing as bs58 (length ${fromPrivateKey.length})`);
        const bs58 = await import('bs58');
        privateKeyBytes = bs58.default.decode(fromPrivateKey);
      }
      
      log(`🔑 Parsed key bytes length: ${privateKeyBytes.length}`);
      
      // Handle different key lengths
      if (privateKeyBytes.length === 64) {
        // Perfect - standard ed25519 keypair (32 private + 32 public)
        log(`✅ Standard 64-byte ed25519 keypair`);
      } else if (privateKeyBytes.length === 66) {
        // Common case: 64 bytes + 2 header bytes - remove the headers
        log(`🔧 66-byte key detected - removing header bytes`);
        
        // Check if first 2 bytes look like headers (often [0,0] or similar)
        const firstTwoBytes = Array.from(privateKeyBytes.slice(0, 2));
        const lastTwoBytes = Array.from(privateKeyBytes.slice(-2));
        log(`🔧 First 2 bytes: ${firstTwoBytes}`);
        log(`🔧 Last 2 bytes: ${lastTwoBytes}`);
        
        // Try removing first 2 bytes (most common)
        privateKeyBytes = privateKeyBytes.slice(2, 66);
        log(`🔧 Removed first 2 bytes, new length: ${privateKeyBytes.length}`);
      } else if (privateKeyBytes.length === 96) {
        // Sometimes includes public key at end - extract first 64 bytes
        log(`🔧 96-byte key detected - extracting first 64 bytes`);
        privateKeyBytes = privateKeyBytes.slice(0, 64);
      } else if (privateKeyBytes.length === 32) {
        // This is just the private key portion - need to generate public key
        log(`🔧 32-byte private key detected - this is only half the keypair!`);
        throw new Error(`32-byte private key provided - Solana needs full 64-byte keypair (private + public)`);
      } else {
        throw new Error(`Unsupported key length: ${privateKeyBytes.length} bytes (expected 64 for full keypair)`);
      }
      
      log(`✅ Final key length: ${privateKeyBytes.length} bytes`);
      log(`🔑 Final first 10 bytes: ${Array.from(privateKeyBytes.slice(0, 10))}`);
      log(`🔑 Final last 10 bytes: ${Array.from(privateKeyBytes.slice(-10))}`);
      
    } catch (keyError) {
      logError(`❌ Private key parsing failed`, keyError);
      throw new Error(`Invalid private key format: ${keyError}`);
    }
    
    // Try to create the keypair with the full 64-byte array
    let platformKeypair: Keypair;
    try {
      log(`🔑 Creating keypair from ${privateKeyBytes.length}-byte array...`);
      platformKeypair = Keypair.fromSecretKey(privateKeyBytes);
      log(`✅ Successfully created keypair!`);
    } catch (keypairError) {
      logError(`❌ Keypair creation failed`, keypairError);
      
      const errorMessage = keypairError instanceof Error ? keypairError.message : 'Unknown keypair error';
      
      // If it's a 66-byte key that failed, try removing last 2 bytes instead
      if (fromPrivateKey.startsWith('[') && fromPrivateKey.endsWith(']')) {
        try {
          const keyArray = JSON.parse(fromPrivateKey);
          
          if (keyArray.length === 66) {
            log(`🔧 Trying to remove LAST 2 bytes instead of first 2...`);
            const alternativeBytes = new Uint8Array(keyArray.slice(0, 64));
            log(`🔧 Alternative array length: ${alternativeBytes.length}`);
            
            platformKeypair = Keypair.fromSecretKey(alternativeBytes);
            log(`✅ SUCCESS with removing last 2 bytes!`);
          } else {
            throw new Error(`Can't create alternative - array length ${keyArray.length}`);
          }
        } catch (alternativeError) {
          logError(`❌ Alternative parsing also failed`, alternativeError);
          throw new Error(`All key parsing attempts failed: ${errorMessage}`);
        }
      } else {
        throw new Error(`Keypair creation failed: ${errorMessage}`);
      }
    }
    
    const platformPublicKey = platformKeypair.publicKey.toString();
    log(`💳 Platform wallet: ${platformPublicKey}`);
    
    let winnerWallet: PublicKey;
    try {
      winnerWallet = new PublicKey(toWallet);
      log(`🏆 Winner wallet: ${winnerWallet.toString()}`);
    } catch (walletError) {
      logError(`❌ Invalid winner wallet address`, walletError);
      throw new Error(`Invalid winner wallet address: ${toWallet}`);
    }

    // Check balance
    log(`💰 Checking platform wallet balance...`);
    const balance = await connection.getBalance(platformKeypair.publicKey);
    const requiredLamports = Math.floor(amount * LAMPORTS_PER_SOL);
    
    log(`💰 Platform balance: ${balance / LAMPORTS_PER_SOL} SOL (${balance} lamports)`);
    log(`💰 Sending: ${amount} SOL (${requiredLamports} lamports)`);
    
    if (balance < requiredLamports) {
      const errorMsg = `Insufficient balance: ${balance / LAMPORTS_PER_SOL} SOL < ${amount} SOL required`;
      logError(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }

    // Create transaction
    log(`📝 Creating transaction...`);
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: platformKeypair.publicKey,
        toPubkey: winnerWallet,
        lamports: requiredLamports,
      })
    );

    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = platformKeypair.publicKey;
    log(`📝 Transaction created with blockhash: ${blockhash}`);

    // Send transaction
    log(`🚀 Sending transaction...`);
    const signature = await connection.sendTransaction(transaction, [platformKeypair], {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: 3
    });

    log(`⏳ Transaction sent: ${signature}`);

    // Confirm transaction
    log(`⏳ Confirming transaction...`);
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    
    if (confirmation.value?.err) {
      const errorMsg = `Transaction failed: ${JSON.stringify(confirmation.value.err)}`;
      logError(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    log(`✅ REAL SOL TRANSFER CONFIRMED: ${amount} SOL to ${toWallet}`);
    log(`🔗 Signature: ${signature}`);
    
    return { success: true, signature, debugLogs: debugLogs };

  } catch (error) {
    logError('❌ Direct SOL transfer failed', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      debugLogs: debugLogs
    };
  }
}

export async function POST(
  request: NextRequest,
  context: any
) {
  // MASTER ERROR HANDLER - CATCH EVERYTHING
  try {
    console.log(`🚀 POST /api/games/[id]/complete called`);
    console.log(`📝 Context:`, context);
    console.log(`📝 Request headers:`, Object.fromEntries(request.headers.entries()));
    
    let requestBody;
    try {
      requestBody = await request.json();
      console.log(`📝 Request body parsed successfully:`, requestBody);
    } catch (jsonError) {
      console.error(`❌ Failed to parse request JSON:`, jsonError);
      return NextResponse.json({ 
        error: 'Invalid JSON in request body',
        details: jsonError instanceof Error ? jsonError.message : 'Unknown JSON error'
      }, { status: 400 });
    }
    
    const gameId = context?.params?.id;
    console.log(`🎮 Extracted game ID: ${gameId}`);

    if (!gameId) {
      console.error(`❌ No game ID provided`);
      return NextResponse.json({ error: 'Game ID is required' }, { status: 400 });
    }

    console.log(`🏁 Starting game completion for ${gameId}...`);
    console.log(`📝 Request data:`, requestBody);

    if (!gameId) {
      return NextResponse.json({ error: 'Game ID is required' }, { status: 400 });
    }

    // Handle both old format (winnerWallet, loserWallet) and new format (winner, playerId, walletAddress)
    let winnerWallet: string;
    let loserWallet: string;
    
    if (requestBody.winner && requestBody.playerId && requestBody.walletAddress) {
      // New Stratego format
      console.log(`🎯 New format: winner=${requestBody.winner}, playerId=${requestBody.playerId}`);
      
      try {
        // Get game players to determine winner and loser wallets
        console.log(`🔍 Querying players for game ${gameId}...`);
        const playersResult = await db`
          SELECT 
            p.wallet_address,
            p.username,
            gp.player_id
          FROM game_players gp
          JOIN players p ON gp.player_id = p.id
          WHERE gp.game_id = ${gameId}
          ORDER BY gp.joined_at ASC
        `;
        
        console.log(`🔍 Found ${playersResult.length} players:`, playersResult.map(p => ({ 
          wallet: p.wallet_address.slice(0, 8) + '...', 
          username: p.username,
          playerId: p.player_id
        })));
        
        if (playersResult.length < 2) {
          console.error(`❌ Not enough players: ${playersResult.length}`);
          return NextResponse.json({ error: 'Not enough players in game' }, { status: 400 });
        }
        
        // In Stratego: red = player 1, blue = player 2
        if (requestBody.winner === 'red') {
          winnerWallet = playersResult[0].wallet_address;
          loserWallet = playersResult[1].wallet_address;
        } else if (requestBody.winner === 'blue') {
          winnerWallet = playersResult[1].wallet_address;
          loserWallet = playersResult[0].wallet_address;
        } else {
          console.error(`❌ Invalid winner color: ${requestBody.winner}`);
          return NextResponse.json({ error: 'Invalid winner color' }, { status: 400 });
        }
        
        console.log(`🏆 Determined: Winner=${winnerWallet.slice(0,8)}..., Loser=${loserWallet.slice(0,8)}...`);
      } catch (playersError) {
        console.error('❌ Error querying players:', playersError);
        return NextResponse.json({ 
          error: 'Failed to query game players',
          details: playersError instanceof Error ? playersError.message : 'Unknown error'
        }, { status: 500 });
      }
    } else if (requestBody.winnerWallet && requestBody.loserWallet) {
      // Old checkers format
      winnerWallet = requestBody.winnerWallet;
      loserWallet = requestBody.loserWallet;
      console.log(`🎯 Old format: Winner=${winnerWallet.slice(0,8)}..., Loser=${loserWallet.slice(0,8)}...`);
    } else {
      console.error('❌ Missing required completion data');
      return NextResponse.json({ 
        error: 'Either (winner, playerId, walletAddress) or (winnerWallet, loserWallet) are required',
        received: Object.keys(requestBody)
      }, { status: 400 });
    }

    console.log(`🏁 Completing game ${gameId} - Winner: ${winnerWallet.slice(0, 8)}..., Loser: ${loserWallet.slice(0, 8)}...`);

    // Get game details
    let game;
    try {
      console.log(`🔍 Querying game details for ${gameId}...`);
      const gameResult = await db`
        SELECT 
          g.id,
          g.game_type,
          g.entry_fee,
          g.status
        FROM games g
        WHERE g.id = ${gameId}
      `;

      if (gameResult.length === 0) {
        console.error(`❌ Game ${gameId} not found`);
        return NextResponse.json({ error: 'Game not found' }, { status: 404 });
      }

      game = gameResult[0];
      console.log(`🔍 Game details:`, {
        id: game.id,
        type: game.game_type,
        entryFee: game.entry_fee,
        status: game.status
      });
    } catch (gameError) {
      console.error('❌ Error querying game details:', gameError);
      return NextResponse.json({ 
        error: 'Failed to query game details',
        details: gameError instanceof Error ? gameError.message : 'Unknown error'
      }, { status: 500 });
    }
    
    // Calculate winnings (96% goes to winner, 4% platform fee)
    const totalPot = parseFloat(game.entry_fee) * 2;
    const platformFee = totalPot * 0.04;
    const winnerAmount = totalPot - platformFee;

    if (game.status === 'completed') {
      console.log(`⚠️ Game ${gameId} already completed - attempting direct payout...`);
      
      // Game already completed - try direct SOL transfer
      const privateKey = process.env.PLATFORM_WALLET_PRIVATE_KEY;
      console.log(`🔍 PLATFORM_WALLET_PRIVATE_KEY exists: ${!!privateKey}`);
      console.log(`🔍 Private key length: ${privateKey?.length || 'undefined'}`);
      
      if (privateKey) {
        console.log(`🔑 Platform private key found, attempting direct transfer of ${winnerAmount} SOL...`);
        console.log(`🚀 About to call sendSOLDirectly function...`);
        
        const directTransfer = await sendSOLDirectly(privateKey, winnerWallet, winnerAmount, gameId);
        
        console.log(`🔍 sendSOLDirectly returned:`, directTransfer);
        
        if (directTransfer.success) {
          console.log(`✅ Direct SOL transfer successful for completed game!`);
          
          return NextResponse.json({ 
            success: true,
            alreadyCompleted: true,
            winner: winnerWallet,
            loser: loserWallet,
            winnerAmount: winnerAmount,
            platformFee: platformFee,
            gameId: gameId,
            escrowReleased: true,
            escrowTransactionSignature: directTransfer.signature,
            message: `Game was already completed - payout of ${winnerAmount} SOL sent directly!`
          });
        } else {
          console.error(`❌ Direct SOL transfer failed for completed game:`, directTransfer.error);
          return NextResponse.json({ 
            success: true,
            alreadyCompleted: true,
            message: `Game was already completed but payout failed: ${directTransfer.error}`,
            gameId: gameId,
            escrowReleased: false,
            payoutError: directTransfer.error,
            debugInfo: {
              privateKeyExists: !!privateKey,
              privateKeyLength: privateKey?.length,
              winnerWallet: winnerWallet.slice(0, 8) + '...',
              winnerAmount: winnerAmount,
              errorDetails: directTransfer.error,
              serverLogs: `Check server logs for detailed debugging starting with: "🚀 ENTERED sendSOLDirectly" for game ${gameId}`,
              detailedLogs: directTransfer.debugLogs || []
            }
          });
        }
      } else {
        console.error(`❌ No PLATFORM_WALLET_PRIVATE_KEY found for completed game payout!`);
        return NextResponse.json({ 
          success: true,
          alreadyCompleted: true,
          message: 'Game was already completed but no platform wallet key configured',
          gameId: gameId,
          escrowReleased: false,
          payoutError: 'No platform wallet private key'
        });
      }
    }

    // Get player information for SMS notifications
    let playersResult;
    try {
      console.log(`🔍 Querying players for SMS notifications...`);
      playersResult = await db`
        SELECT 
          p.wallet_address,
          p.username,
          p.phone_number,
          p.sms_notifications_enabled,
          gp.player_id
        FROM game_players gp
        JOIN players p ON gp.player_id = p.id
        WHERE gp.game_id = ${gameId}
      `;
      console.log(`🔍 Found ${playersResult.length} players for SMS`);
    } catch (playersError) {
      console.error('❌ Error querying players for SMS:', playersError);
      return NextResponse.json({ 
        error: 'Failed to query players for SMS',
        details: playersError instanceof Error ? playersError.message : 'Unknown error'
      }, { status: 500 });
    }

    // Update game status
    try {
      console.log(`🔄 Updating game status to completed...`);
      await db`
        UPDATE games 
        SET status = 'completed', ended_at = CURRENT_TIMESTAMP
        WHERE id = ${gameId}
      `;
      console.log(`✅ Game status updated`);
    } catch (updateError) {
      console.error('❌ Error updating game status:', updateError);
      return NextResponse.json({ 
        error: 'Failed to update game status',
        details: updateError instanceof Error ? updateError.message : 'Unknown error'
      }, { status: 500 });
    }

    // Update game players - FIX THE BROKEN SQL
    try {
      console.log(`🔄 Updating game players...`);
      // First, set all players in this game as losers
      await db`
        UPDATE game_players 
        SET 
          game_status = 'completed',
          is_winner = false
        WHERE game_id = ${gameId}
      `;
      
      // Then, mark the winner as true
      await db`
        UPDATE game_players 
        SET is_winner = true
        WHERE game_id = ${gameId} 
          AND player_id = (
            SELECT id FROM players WHERE wallet_address = ${winnerWallet}
          )
      `;
      console.log(`✅ Game players updated`);
    } catch (playersUpdateError) {
      console.error('❌ Error updating game players:', playersUpdateError);
      return NextResponse.json({ 
        error: 'Failed to update game players',
        details: playersUpdateError instanceof Error ? playersUpdateError.message : 'Unknown error'
      }, { status: 500 });
    }

    console.log(`💰 Game completion: Total pot: ${totalPot} SOL, Winner gets: ${winnerAmount} SOL, Platform fee: ${platformFee} SOL`);

    // Send SMS notifications
    try {
      for (const player of playersResult) {
        if (player.phone_number && player.sms_notifications_enabled) {
          const isWinner = player.wallet_address === winnerWallet;
          await smsService.sendGameCompleted(
            player.phone_number,
            game.game_type,
            isWinner,
            isWinner ? winnerAmount : undefined
          );
          console.log(`📱 Game completion SMS sent to ${player.username} (${isWinner ? 'winner' : 'loser'})`);
        }
      }
    } catch (smsError) {
      console.error('Failed to send SMS notifications:', smsError);
      // Don't fail the completion if SMS fails
    }

    // Create game stats for both players
    const winnerPlayer = playersResult.find(p => p.wallet_address === winnerWallet);
    const loserPlayer = playersResult.find(p => p.wallet_address === loserWallet);

    if (winnerPlayer && loserPlayer) {
      try {
        // Winner stats
        await db`
          INSERT INTO game_stats (game_id, player_id, game_type, result, amount, opponent_id)
          VALUES (${gameId}, ${winnerPlayer.player_id}, ${game.game_type}, 'win', ${winnerAmount}, ${loserPlayer.player_id})
        `;

        // Loser stats
        await db`
          INSERT INTO game_stats (game_id, player_id, game_type, result, amount, opponent_id)
          VALUES (${gameId}, ${loserPlayer.player_id}, ${game.game_type}, 'loss', ${-parseFloat(game.entry_fee)}, ${winnerPlayer.player_id})
        `;

        // Update player stats
        await db`
          INSERT INTO player_stats (player_id, games_played, games_won, total_winnings)
          VALUES (${winnerPlayer.player_id}, 1, 1, ${winnerAmount})
          ON CONFLICT (player_id) DO UPDATE SET
            games_played = player_stats.games_played + 1,
            games_won = player_stats.games_won + 1,
            total_winnings = player_stats.total_winnings + ${winnerAmount}
        `;

        await db`
          INSERT INTO player_stats (player_id, games_played, games_won, total_winnings)
          VALUES (${loserPlayer.player_id}, 1, 0, ${-parseFloat(game.entry_fee)})
          ON CONFLICT (player_id) DO UPDATE SET
            games_played = player_stats.games_played + 1,
            total_winnings = player_stats.total_winnings + ${-parseFloat(game.entry_fee)}
        `;

        console.log(`📊 Stats updated for both players`);
      } catch (statsError) {
        console.error('Failed to update game stats:', statsError);
        // Continue even if stats update fails
      }
    }

    // 🚀 DIRECT SOL TRANSFER TO WINNER (BYPASS COMPLEX ESCROW APIS)
    let payoutResult = null;
    const privateKey = process.env.PLATFORM_WALLET_PRIVATE_KEY;
    
    if (privateKey) {
      console.log(`💰 Sending ${winnerAmount} SOL directly to winner...`);
      payoutResult = await sendSOLDirectly(privateKey, winnerWallet, winnerAmount, gameId);
      
      if (payoutResult.success) {
        console.log(`✅ DIRECT SOL PAYOUT SUCCESSFUL!`);
        console.log(`🔗 Transaction: ${payoutResult.signature}`);
      } else {
        console.error(`❌ Direct SOL payout failed:`, payoutResult.error);
      }
    } else {
      console.warn(`⚠️ No PLATFORM_WALLET_PRIVATE_KEY - cannot send real SOL`);
    }

    return NextResponse.json({ 
      success: true,
      winner: winnerWallet,
      loser: loserWallet,
      winnerAmount: winnerAmount,
      platformFee: platformFee,
      gameId: gameId,
      escrowReleased: !!payoutResult?.success,
      escrowTransactionSignature: payoutResult?.signature,
      payout: payoutResult?.success ? {
        amount: winnerAmount,
        signature: payoutResult.signature
      } : null,
      message: payoutResult?.success 
        ? `Game completed! Winner received ${winnerAmount} SOL directly!`
        : `Game completed! Winner recorded but payout failed: ${payoutResult?.error || 'No private key configured'}`
    });

  } catch (error) {
    console.error('❌ MASTER ERROR - Game completion failed:', error);
    console.error('❌ Error type:', typeof error);
    console.error('❌ Error constructor:', error?.constructor?.name);
    
    // Extract detailed error information
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
      type: typeof error,
      stringified: String(error)
    };
    
    console.error('❌ Detailed error info:', errorDetails);
    
    // Return detailed error for debugging
    return NextResponse.json({ 
      error: 'Internal server error',
      debug: {
        message: errorDetails.message,
        type: errorDetails.type,
        name: errorDetails.name,
        timestamp: new Date().toISOString(),
        endpoint: '/api/games/[id]/complete',
        userAgent: request.headers.get('user-agent'),
        // Only include stack in development/testing
        ...(process.env.NODE_ENV !== 'production' && { 
          stack: errorDetails.stack,
          fullError: errorDetails.stringified 
        })
      }
    }, { status: 500 });
  }
} 