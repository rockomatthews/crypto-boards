#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import readline from 'readline';

console.log('🚀 Crypto Boards - Environment Setup\n');

// Check if .env.local already exists
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  console.log('⚠️  .env.local already exists. Backing up to .env.local.backup');
  fs.copyFileSync(envPath, envPath + '.backup');
}

console.log('📝 Please provide the following information:\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const questions = [
  {
    name: 'DATABASE_URL',
    question: 'Enter your Neon database URL (postgresql://username:password@host:port/database): ',
    required: true
  },
  {
    name: 'SOLANA_RPC_URL',
    question: 'Enter your QuickNode Solana RPC URL: ',
    required: true
  },
  {
    name: 'ESCROW_PUBLIC_KEY',
    question: 'Enter escrow public key (or press Enter for default): ',
    default: '11111111111111111111111111111111'
  },
  {
    name: 'NEXT_PUBLIC_APP_URL',
    question: 'Enter your app URL (or press Enter for localhost): ',
    default: 'http://localhost:3000'
  }
];

let answers = {};
let currentQuestion = 0;

function askQuestion() {
  if (currentQuestion >= questions.length) {
    createEnvFile();
    return;
  }

  const q = questions[currentQuestion];
  rl.question(q.question, (answer) => {
    if (q.required && !answer.trim()) {
      console.log('❌ This field is required. Please try again.\n');
      askQuestion();
      return;
    }

    answers[q.name] = answer.trim() || q.default;
    currentQuestion++;
    askQuestion();
  });
}

function createEnvFile() {
  const envContent = `# Database
DATABASE_URL=${answers.DATABASE_URL}

# Solana Configuration
SOLANA_RPC_URL=${answers.SOLANA_RPC_URL}
ESCROW_PUBLIC_KEY=${answers.ESCROW_PUBLIC_KEY}

# App Configuration
NEXT_PUBLIC_APP_URL=${answers.NEXT_PUBLIC_APP_URL}
NEXT_PUBLIC_SOCKET_URL=${answers.NEXT_PUBLIC_APP_URL}

# Development
NODE_ENV=development
`;

  fs.writeFileSync(envPath, envContent);

  console.log('\n✅ Environment file created successfully!');
  console.log('📁 File location: .env.local');
  console.log('\n🔧 Next steps:');
  console.log('1. Deploy to Vercel');
  console.log('2. Add these same environment variables in Vercel dashboard');
  console.log('3. Update NEXT_PUBLIC_SOCKET_URL to your deployed domain');
  console.log('4. Run: curl -X POST https://your-app.vercel.app/api/update-schema');
  
  rl.close();
}

// Start the questionnaire
askQuestion(); 