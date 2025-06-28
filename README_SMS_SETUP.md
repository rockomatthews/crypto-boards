# SMS Notifications Setup Guide

## Overview

This guide will help you implement SMS notifications for your Crypto Boards platform. Players will receive text messages for:

- 🎮 Game invitations from friends
- 🚀 Game start notifications  
- 🏁 Game completion results
- 👥 Friend requests

## SMS Provider Options

### Option 1: Twilio (Recommended for Reliability)
- **Pros**: Industry standard, excellent reliability, great documentation
- **Pricing**: $0.0075/SMS (both incoming and outgoing)
- **Best for**: Production environments, enterprise features

### Option 2: TextGrid (Recommended for Cost Savings)
- **Pros**: 50% cheaper than Twilio, free incoming SMS, HIPAA compliant
- **Pricing**: $0.0035/SMS outgoing, FREE incoming
- **Best for**: Cost-conscious implementations

## Setup Instructions

### Step 1: Install Dependencies

The Twilio SDK is already included in package.json:

```bash
npm install
```

### Step 2: Choose Your SMS Provider

#### For Twilio Setup:
1. Create account at [twilio.com](https://twilio.com)
2. Get your Account SID and Auth Token from console
3. Purchase a phone number
4. Add to `.env`:

```env
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

#### For TextGrid Setup:
1. Create account at [textgrid.com](https://textgrid.com)
2. Get your API key from dashboard
3. Purchase a phone number
4. Add to `.env`:

```env
SMS_PROVIDER=textgrid
TEXTGRID_API_KEY=your_api_key
TEXTGRID_PHONE_NUMBER=+1234567890
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### Step 3: Update Database Schema

Run the setup script to add SMS fields to your database:

```bash
node scripts/setup-sms-database.mjs
```

This adds the following fields to the `players` table:
- `sms_notifications_enabled` (boolean)
- `sms_opted_in_at` (timestamp)

### Step 4: Deploy and Test

1. Deploy your application with the new environment variables
2. Have users visit their Profile page
3. They can now add phone numbers and enable SMS notifications
4. Test by creating a game and inviting friends!

## User Experience Flow

### For Users Enabling SMS:

1. **Profile Setup**: Users go to Profile → Add phone number
2. **SMS Opt-in**: Toggle "Text Notifications" ON
3. **Consent**: Clear disclosure of what messages they'll receive
4. **Immediate Feedback**: Confirmation when enabled

### SMS Message Examples:

**Game Invitation:**
```
🎮 PlayerABC invited you to play CHECKERS!

💰 Entry Fee: 0.5 SOL
🔗 Join: https://yoursite.com/lobby/123

Reply STOP to opt out.
```

**Game Starting:**
```
🚀 Your CHECKERS game is starting!

🎯 Play now: https://yoursite.com/checkers/123

Good luck! 🍀
```

**Game Completed (Winner):**
```
🎉 Congratulations! You won the CHECKERS game!

💰 Winnings: 0.96 SOL

🎮 Play again: https://yoursite.com
```

## Privacy & Compliance

### User Privacy:
- Phone numbers are only visible to the user
- Used only for SMS notifications and friend discovery
- Users can opt-out anytime with STOP reply

### Legal Compliance:
- Clear opt-in process with disclosure
- STOP keyword support for opt-out
- Message frequency and costs disclosed
- TCPA compliant messaging

## Cost Estimates

### Twilio Costs:
- **Low volume** (100 SMS/month): ~$0.75/month
- **Medium volume** (1,000 SMS/month): ~$7.50/month  
- **High volume** (10,000 SMS/month): ~$75/month

### TextGrid Costs:
- **Low volume** (100 SMS/month): ~$0.35/month
- **Medium volume** (1,000 SMS/month): ~$3.50/month
- **High volume** (10,000 SMS/month): ~$35/month

## Monitoring & Analytics

### Track SMS Performance:
- Monitor delivery rates in provider dashboard
- Track opt-in/opt-out rates in your analytics
- Watch for STOP replies and honor them immediately

### Common Issues:
- **International numbers**: Higher costs, verify coverage
- **Carrier filtering**: Avoid spammy language
- **Rate limits**: Both providers have sending limits

## Production Considerations

### Security:
- Store API keys in secure environment variables
- Use HTTPS for all webhook endpoints
- Validate phone numbers before sending

### Scalability:
- Both providers handle high volume well
- Consider message queuing for burst traffic
- Monitor costs as user base grows

### Testing:
- Test with your own phone number first
- Verify international number support if needed
- Test opt-out flow thoroughly

## Support

For SMS provider specific issues:
- **Twilio**: [Twilio Support](https://support.twilio.com)
- **TextGrid**: [TextGrid Support](https://textgrid.com/support)

For implementation questions, check the console logs for detailed SMS sending status. 