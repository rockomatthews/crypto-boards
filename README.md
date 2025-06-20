# Crypto Boards 🎮

A decentralized board games platform built on Solana, featuring real-time multiplayer games with crypto payments and automatic winner payouts.

## 🚀 Features

### ✅ Completed
- **Real Solana Integration**: SOL payments for game entry fees and automatic winner payouts
- **Real-time Multiplayer**: WebSocket connections for live game updates
- **Game State Sync**: Real-time game state synchronization across players
- **Winner Payout System**: Automatic SOL distribution to winners (90% of pot, 10% platform fee)
- **Game History & Statistics**: Comprehensive tracking of games, wins, losses, and financial performance
- **Checkers Game**: Full 8x8 checkers implementation with move validation
- **Lobby System**: Game creation, player joining, and payment processing
- **Profile Management**: Player profiles with wallet integration
- **Friends System**: Add and manage friends

### 🔄 In Progress
- WebSocket server deployment
- Complete game logic enhancement

### ⏳ Planned
- Additional game types (Chess, Go, Poker)
- Enhanced security and performance optimization
- Mobile app development

## 🛠 Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **UI**: Material-UI (MUI) with custom theme
- **Blockchain**: Solana Web3.js, SPL Token
- **Database**: Neon PostgreSQL
- **Real-time**: Socket.IO
- **Wallet**: Solana Wallet Adapter (Phantom, Solflare)

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Solana wallet (Phantom, Solflare)
- Neon database account

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd crypto-boards
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Add your configuration:
   ```env
   DATABASE_URL=your_neon_database_url
   SOLANA_RPC_URL=https://api.devnet.solana.com
   ESCROW_PUBLIC_KEY=your_escrow_public_key
   NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
   ```

4. **Initialize database**
   ```bash
   # Update schema with new tables
   curl -X POST http://localhost:3000/api/update-schema
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🎮 How to Play

1. **Connect Wallet**: Click "Connect Wallet" and select your Solana wallet
2. **Create Profile**: Set up your gaming profile with username and avatar
3. **Join or Create Game**: Browse available lobbies or create a new game
4. **Pay Entry Fee**: Submit SOL payment to join the game
5. **Play**: Enjoy real-time multiplayer checkers with crypto rewards!
6. **Win & Collect**: Winners automatically receive SOL payouts

## 💰 Financial Model

- **Entry Fees**: Players pay SOL to join games
- **Prize Pool**: 90% of total entry fees go to the winner
- **Platform Fee**: 10% retained for platform maintenance
- **Automatic Payouts**: Winners receive SOL directly to their wallet

## 🔧 API Endpoints

### Game Management
- `GET /api/games/[id]` - Get game details
- `PUT /api/games/[id]/state` - Update game state
- `POST /api/games/[id]/payout` - Process winner payout

### Lobby System
- `GET /api/lobbies` - List available lobbies
- `POST /api/lobbies/[id]/join` - Join a lobby
- `POST /api/lobbies/[id]/pay` - Pay entry fee
- `POST /api/lobbies/[id]/start` - Start the game

### History & Statistics
- `GET /api/games/history` - Get game history and player stats

### Real-time
- `GET/POST /api/socket` - WebSocket connections

## 📊 Database Schema

```sql
-- Core tables
players (id, wallet_address, username, avatar_url, is_online, created_at, last_login)
games (id, game_type, status, entry_fee, max_players, creator_id, created_at, started_at, ended_at)
game_players (id, game_id, player_id, game_status, is_winner, joined_at, left_at)
game_states (id, game_id, current_state, last_updated)
game_payouts (id, game_id, winner_wallet, amount, transaction_signature, created_at)
friendships (id, player_id, friend_id, status, created_at, updated_at)
```

## 🚀 Deployment

### Vercel (Recommended)
1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

### Manual Deployment
```bash
npm run build
npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: See [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) for detailed implementation notes
- **Issues**: Report bugs and feature requests on GitHub
- **Discord**: Join our community for discussions and support

---

**Built with ❤️ for the Solana ecosystem**
