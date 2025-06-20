# 🚀 Deployment Guide - Crypto Boards

## Prerequisites

1. **GitHub Account** - for code repository
2. **Vercel Account** - for hosting (free tier available)
3. **Neon Database** - for PostgreSQL (free tier available)
4. **QuickNode Account** - for Solana RPC (you already have this)

## Step 1: Prepare Your Repository

### 1.1 Push to GitHub
```bash
# Initialize git if not already done
git init
git add .
git commit -m "Initial crypto boards implementation"

# Create GitHub repository and push
git remote add origin https://github.com/yourusername/crypto-boards.git
git push -u origin main
```

### 1.2 Environment Variables Setup

Create a `.env.local` file locally for testing:

```env
# Database (Neon)
DATABASE_URL=postgresql://username:password@host:port/database

# Solana (QuickNode)
SOLANA_RPC_URL=https://your-quicknode-endpoint.solana-mainnet.quiknode.pro/your-api-key/
ESCROW_PUBLIC_KEY=11111111111111111111111111111111

# WebSocket (will be your Vercel domain)
NEXT_PUBLIC_SOCKET_URL=https://your-app.vercel.app

# App URL
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

## Step 2: Set Up Neon Database

### 2.1 Create Neon Account
1. Go to [neon.tech](https://neon.tech)
2. Sign up for free account
3. Create new project
4. Copy the connection string

### 2.2 Initialize Database Schema
After deployment, run this API call to create the new tables:

```bash
curl -X POST https://your-app.vercel.app/api/update-schema
```

## Step 3: Deploy to Vercel

### 3.1 Connect Repository
1. Go to [vercel.com](https://vercel.com)
2. Sign up/login with GitHub
3. Click "New Project"
4. Import your `crypto-boards` repository

### 3.2 Configure Environment Variables
In Vercel dashboard, go to your project → Settings → Environment Variables:

```env
DATABASE_URL=your_neon_connection_string
SOLANA_RPC_URL=your_quicknode_endpoint
ESCROW_PUBLIC_KEY=11111111111111111111111111111111
NEXT_PUBLIC_SOCKET_URL=https://your-app.vercel.app
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### 3.3 Deploy Settings
- **Framework Preset**: Next.js
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

### 3.4 Deploy
Click "Deploy" and wait for the build to complete.

## Step 4: Configure QuickNode

### 4.1 Get Your Endpoint
1. Log into your QuickNode account
2. Create a new endpoint (Solana Mainnet or Devnet for testing)
3. Copy the HTTP endpoint URL

### 4.2 Update Environment Variable
In Vercel dashboard, update `SOLANA_RPC_URL` with your QuickNode endpoint.

## Step 5: Test the Deployment

### 5.1 Initialize Database
```bash
curl -X POST https://your-app.vercel.app/api/update-schema
```

### 5.2 Test Basic Functionality
1. Visit your deployed app
2. Connect wallet
3. Create a profile
4. Try creating a lobby

### 5.3 Test Real-time Features
- Join a lobby
- Make a payment (simulated)
- Start a game
- Test game state updates

## Step 6: Production Considerations

### 6.1 WebSocket Server
For production, you'll need a separate WebSocket server. Options:

**Option A: Separate Server**
```bash
# Deploy Socket.IO server to Railway/Render/Heroku
npm install -g railway
railway login
railway init
railway up
```

**Option B: Vercel with Socket.IO**
Update your `next.config.ts`:
```typescript
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['socket.io']
  }
}
```

### 6.2 Domain Setup
1. Add custom domain in Vercel
2. Update `NEXT_PUBLIC_SOCKET_URL` and `NEXT_PUBLIC_APP_URL`
3. Configure SSL certificates

### 6.3 Security
- Add rate limiting
- Implement proper authentication
- Add input validation
- Set up monitoring

## Troubleshooting

### Common Issues

**1. Database Connection Error**
```
Error: No database connection string was provided to `neon()`
```
- Check `DATABASE_URL` in Vercel environment variables
- Ensure Neon database is accessible

**2. Solana RPC Error**
```
Error: Failed to fetch from Solana RPC
```
- Verify QuickNode endpoint is correct
- Check if endpoint is active and has sufficient credits

**3. WebSocket Connection Error**
```
Error: WebSocket connection failed
```
- Update `NEXT_PUBLIC_SOCKET_URL` to your deployed domain
- Ensure WebSocket server is running

**4. Build Errors**
```
Error: Module not found
```
- Check all dependencies are in `package.json`
- Ensure TypeScript compilation passes locally

### Debug Commands

```bash
# Check environment variables
echo $DATABASE_URL
echo $SOLANA_RPC_URL

# Test database connection
curl -X GET https://your-app.vercel.app/api/lobbies

# Test Solana connection
curl -X POST https://your-app.vercel.app/api/socket
```

## Monitoring & Analytics

### 1. Vercel Analytics
- Enable in Vercel dashboard
- Monitor performance and errors

### 2. Database Monitoring
- Use Neon's built-in monitoring
- Set up alerts for connection issues

### 3. Solana Monitoring
- Monitor QuickNode endpoint usage
- Set up alerts for RPC errors

## Next Steps After Deployment

1. **Test All Features**
   - Wallet connection
   - Game creation and joining
   - Real-time updates
   - Payment processing
   - Winner payouts

2. **Performance Optimization**
   - Add caching layer
   - Optimize database queries
   - Implement CDN for static assets

3. **Security Hardening**
   - Add rate limiting
   - Implement proper authentication
   - Add input validation
   - Set up monitoring

4. **Scale Up**
   - Add more game types
   - Implement advanced features
   - Optimize for mobile
   - Add social features

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Verify environment variables
3. Test API endpoints individually
4. Check browser console for errors
5. Review this guide for common solutions

---

**Happy Deploying! 🚀** 