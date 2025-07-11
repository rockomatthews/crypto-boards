# 📱 Twilio SMS Setup Guide

This guide will help you set up Twilio SMS integration for game invitations.

## 🚀 Quick Setup

### 1. Create Twilio Account
1. Go to [twilio.com](https://www.twilio.com) and sign up for a free account
2. Verify your phone number and email
3. Complete the onboarding flow

### 2. Get Your Credentials
Once logged in to the Twilio Console:

1. **Account SID & Auth Token**:
   - Go to your [Twilio Console Dashboard](https://console.twilio.com/)
   - Copy your `Account SID` and `Auth Token`

2. **Get a Phone Number**:
   - In the console, go to Phone Numbers > Manage > Buy a number
   - Choose a number with SMS capabilities
   - Complete the purchase (free trial credits cover this)

### 3. Set Environment Variables

Add these to your `.env.local` file:

```bash
# Twilio SMS Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890
```

### 4. Test the Integration

Create a test lobby with SMS invitations to verify everything works!

## 🔧 Twilio Console Setup

### Free Trial Limitations
- **$15.50 in free credits** (plenty for testing)
- Can only send SMS to **verified phone numbers** during trial
- Upgrade to remove restrictions

### Verify Test Numbers (Trial Only)
During trial, you can only send SMS to verified numbers:

1. Go to Phone Numbers > Manage > Verified Caller IDs
2. Add phone numbers you want to test with
3. Verify each number via SMS or call

### Production Setup
Once ready for production:

1. **Upgrade your account** to remove trial restrictions
2. **Set up billing** for ongoing usage
3. **Configure webhooks** (optional) for delivery receipts

## 💰 Pricing

### SMS Costs (US)
- **Outbound SMS**: ~$0.0075 per message
- **Phone Number**: ~$1.00/month
- **Very affordable** for game invitations

### Example Costs
- 100 SMS invitations/month = ~$0.75
- 1,000 SMS invitations/month = ~$7.50

## 🛠️ Features Included

### Current Implementation
- ✅ **Send game invitations** via SMS
- ✅ **Auto-format phone numbers** (+1 prefix)
- ✅ **Error handling** with detailed feedback
- ✅ **Delivery tracking** via message SIDs
- ✅ **Database logging** of all SMS invitations

### SMS Message Format
```
🎮 [Username] invited you to play [Game] for [Fee] SOL! 
Join at solboardgames.com/lobby/[lobby-id]
```

## 🔍 Troubleshooting

### Common Issues

#### "Twilio credentials missing" Error
- Check your `.env.local` file has all three variables
- Restart your development server after adding env vars
- Verify no extra spaces in your credentials

#### "Unable to create record" Error
- Your trial account needs to verify the recipient's phone number
- Go to Twilio Console > Verified Caller IDs to add the number

#### "Invalid phone number" Error
- Ensure phone numbers include country code (+1 for US)
- Remove any special characters except + and spaces
- Example: `+1 555 123 4567` or `+15551234567`

### Testing Tips

1. **Start with your own verified number**
2. **Check Twilio Console logs** for detailed error messages
3. **Use the SMS simulator** in Twilio Console for free testing
4. **Monitor usage** in the Twilio Console dashboard

## 🔒 Security Best Practices

1. **Never commit credentials** to version control
2. **Use environment variables** for all sensitive data
3. **Rotate credentials periodically** in production
4. **Monitor usage** for unexpected spikes
5. **Set up billing alerts** to avoid surprises

## 📈 Production Scaling

### Webhook Setup (Optional)
For delivery receipts and status updates:

1. Create a webhook endpoint: `/api/sms/webhook`
2. Configure in Twilio Console > Messaging > Settings
3. Handle delivery status updates

### Rate Limiting
Twilio handles most rate limiting automatically, but consider:
- Implementing user-side rate limits (e.g., 10 SMS per hour)
- Queuing large SMS batches
- Using Twilio's message scheduling for time zones

## 🎯 Ready to Go!

Once you've completed the setup:

1. ✅ Twilio account created
2. ✅ Phone number purchased
3. ✅ Environment variables set
4. ✅ Test SMS sent successfully

Your game lobby SMS invitations are now live! 🎮📱

---

## 📞 Support

- **Twilio Documentation**: [docs.twilio.com](https://docs.twilio.com)
- **Twilio Support**: Available through console
- **SMS API Reference**: [/api/sms/invite](./src/app/api/sms/invite/route.ts) 