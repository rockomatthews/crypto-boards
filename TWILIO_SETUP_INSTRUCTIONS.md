# 🚀 Twilio SMS Setup Instructions

## Step 1: Get Twilio Credentials

1. **Create Account**: Go to [twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. **Verify Phone**: Complete phone verification (required)
3. **Get Credentials** from Console Dashboard:
   - **Account SID**: Starts with "AC..." (copy this)
   - **Auth Token**: Click eye icon to reveal (copy this)

## Step 2: Buy Phone Number

1. **Navigate**: Console → Phone Numbers → Manage → Buy a number
2. **Select Country**: United States (recommended)
3. **Choose Number**: Any available number with SMS capability
4. **Purchase**: Complete the purchase
5. **Copy Number**: Format like +1234567890

## Step 3: Create Environment File

Create a `.env.local` file in your project root with:

```env
# Database (use your existing DATABASE_URL)
DATABASE_URL=your_existing_database_url

# SMS Configuration
SMS_PROVIDER=twilio
NEXT_PUBLIC_APP_URL=https://your-production-domain.com

# Twilio Credentials (replace with your actual values)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890

# Your existing MagicBlock config
MAGICBLOCK_OPERATOR_WALLET=your_existing_wallet
NEXT_PUBLIC_MAGICBLOCK_API_URL=https://api.magicblock.gg

# Your existing Solana config
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_NETWORK=devnet
```

## Step 4: Setup Database

After creating `.env.local`, run:

```bash
node scripts/setup-sms-database.mjs
```

## Step 5: Test Setup

1. **Start your app**: `npm run dev`
2. **Go to Profile**: Connect wallet → Profile page
3. **Add Phone**: Click "Add Phone Number" 
4. **Enable SMS**: Toggle "Text Notifications" ON
5. **Test**: Create a game and invite friends!

## 💰 Twilio Pricing

- **SMS**: $0.0075 per message (both sent and received)
- **Phone Number**: $1.00/month
- **Free Trial**: $15 credit to start

## 🔧 Troubleshooting

### Common Issues:

1. **"No database connection"**:
   - Make sure DATABASE_URL is set in `.env.local`
   - Check the URL format is correct

2. **"Twilio credentials not configured"**:
   - Verify TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are set
   - Check for typos in credential names

3. **SMS not sending**:
   - Verify phone number format: +1234567890
   - Check Twilio console for error logs
   - Ensure phone number has SMS capability

4. **"Invalid phone number"**:
   - Use international format: +1 for US numbers
   - Verify number is SMS-capable in Twilio console

### Testing Tips:

- **Start with your own number** for testing
- **Check Twilio logs** in console for delivery status
- **Verify webhook URLs** if using production domain
- **Test opt-out** by replying STOP to messages

## 🎯 Next Steps After Setup

1. **Deploy to production** with real domain in NEXT_PUBLIC_APP_URL
2. **Monitor usage** in Twilio console
3. **Set up billing alerts** to avoid surprises
4. **Consider upgrading** from trial for production use

## 📱 Message Examples

Once setup is complete, your users will receive:

**Game Invitation:**
```
🎮 PlayerABC invited you to play CHECKERS!

💰 Entry Fee: 0.5 SOL
🔗 Join: https://yoursite.com/lobby/abc123

Reply STOP to opt out.
```

**Game Starting:**
```
🚀 Your CHECKERS game is starting!

🎯 Play now: https://yoursite.com/checkers/abc123

Good luck! 🍀
```

Ready to set this up? Follow the steps above and let me know if you need help with any part! 