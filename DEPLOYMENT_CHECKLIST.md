# 🚀 Deployment Checklist - Crypto Boards

## ✅ Pre-Deployment

- [x] All features implemented and tested locally
- [x] Code committed and pushed to GitHub
- [x] Environment setup script created
- [x] Documentation updated

## 🔧 Environment Setup

### 1. Neon Database
- [ ] Create Neon account at [neon.tech](https://neon.tech)
- [ ] Create new project
- [ ] Copy connection string
- [ ] Test connection locally

### 2. QuickNode Setup
- [ ] Log into QuickNode account
- [ ] Create new Solana endpoint
- [ ] Choose network (Mainnet/Devnet for testing)
- [ ] Copy HTTP endpoint URL
- [ ] Test endpoint connectivity

### 3. Local Environment
- [ ] Run: `npm run setup-env`
- [ ] Enter Neon database URL
- [ ] Enter QuickNode RPC URL
- [ ] Verify `.env.local` created

## 🚀 Vercel Deployment

### 1. Connect Repository
- [ ] Go to [vercel.com](https://vercel.com)
- [ ] Sign up/login with GitHub
- [ ] Click "New Project"
- [ ] Import `crypto-boards` repository
- [ ] Select Next.js framework

### 2. Environment Variables
In Vercel dashboard → Settings → Environment Variables, add:

```env
DATABASE_URL=your_neon_connection_string
SOLANA_RPC_URL=your_quicknode_endpoint
ESCROW_PUBLIC_KEY=11111111111111111111111111111111
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NEXT_PUBLIC_SOCKET_URL=https://your-app.vercel.app
```

### 3. Deploy
- [ ] Click "Deploy"
- [ ] Wait for build to complete
- [ ] Note the deployment URL

## 🗄️ Database Initialization

### 1. Update Schema
- [ ] Run: `curl -X POST https://your-app.vercel.app/api/update-schema`
- [ ] Verify success response
- [ ] Check Neon dashboard for new tables

### 2. Test Database Connection
- [ ] Visit: `https://your-app.vercel.app/api/lobbies`
- [ ] Should return empty array `[]` (no error)

## 🧪 Feature Testing

### 1. Basic Functionality
- [ ] Visit deployed app
- [ ] Connect Solana wallet
- [ ] Create player profile
- [ ] Browse lobbies

### 2. Game Creation
- [ ] Create new lobby
- [ ] Set entry fee
- [ ] Verify lobby appears in list

### 3. Payment Processing
- [ ] Join a lobby
- [ ] Attempt payment (simulated)
- [ ] Verify payment confirmation

### 4. Real-time Features
- [ ] Test WebSocket connection
- [ ] Verify game state updates
- [ ] Test move broadcasting

### 5. Game History
- [ ] Complete a game
- [ ] Check game history API
- [ ] Verify statistics tracking

## 🔍 Post-Deployment Verification

### 1. API Endpoints
- [ ] `/api/lobbies` - List lobbies
- [ ] `/api/games/history` - Game history
- [ ] `/api/socket` - WebSocket endpoint
- [ ] `/api/update-schema` - Database setup

### 2. Error Monitoring
- [ ] Check Vercel function logs
- [ ] Monitor Neon database connections
- [ ] Verify QuickNode endpoint usage

### 3. Performance
- [ ] Test page load times
- [ ] Verify real-time updates
- [ ] Check database query performance

## 🚨 Troubleshooting

### Common Issues

**Build Fails**
- Check Vercel build logs
- Verify all dependencies in package.json
- Ensure TypeScript compilation passes

**Database Connection Error**
- Verify DATABASE_URL in Vercel
- Check Neon database is accessible
- Test connection string locally

**Solana RPC Error**
- Verify QuickNode endpoint is active
- Check endpoint has sufficient credits
- Test endpoint with curl

**WebSocket Issues**
- Update NEXT_PUBLIC_SOCKET_URL to deployed domain
- Check browser console for connection errors
- Verify Socket.IO server is running

### Debug Commands

```bash
# Test database
curl -X GET https://your-app.vercel.app/api/lobbies

# Test Solana connection
curl -X POST https://your-app.vercel.app/api/socket

# Initialize database
curl -X POST https://your-app.vercel.app/api/update-schema

# Check environment variables
echo $DATABASE_URL
echo $SOLANA_RPC_URL
```

## 📊 Monitoring Setup

### 1. Vercel Analytics
- [ ] Enable in Vercel dashboard
- [ ] Set up performance monitoring
- [ ] Configure error tracking

### 2. Database Monitoring
- [ ] Set up Neon alerts
- [ ] Monitor connection pool usage
- [ ] Track query performance

### 3. Solana Monitoring
- [ ] Monitor QuickNode usage
- [ ] Set up RPC error alerts
- [ ] Track transaction success rates

## 🎯 Success Criteria

- [ ] App loads without errors
- [ ] Wallet connection works
- [ ] Database operations successful
- [ ] Real-time features functional
- [ ] Payment processing works
- [ ] Game history tracking active
- [ ] All API endpoints responding

## 📝 Notes

- Keep environment variables secure
- Monitor QuickNode usage to avoid rate limits
- Set up proper error logging
- Consider setting up staging environment
- Plan for WebSocket server scaling

---

**Deployment Status**: 🟡 In Progress  
**Last Updated**: $(date)  
**Next Review**: After deployment completion 