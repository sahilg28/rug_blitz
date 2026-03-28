# ⚡ RugBlitz

### A Provably Fair On-Chain Survival Game on Monad

> **Pick the right door. Multiply your winnings. Don't get rugged.**

Built for **Monad Blitz New Delhi** 🇮🇳 — March 28, 2026

---

## 🎯 What is RugBlitz?

RugBlitz is a **high-stakes survival game** powered by **Pyth Entropy VRF** for true on-chain randomness. Every outcome is cryptographically verifiable, wallets are created instantly via Privy, and the game runs at Monad speed.

### How It Works

1. **Connect** — Login with Privy (embedded wallet, no extensions needed)
2. **Bet** — Choose your MON amount and difficulty (3, 4, or 5 doors)
3. **Play** — Pick a door each level. Safe door = advance with higher multiplier. Rug door = game over
4. **Cash Out** — Secure your winnings anytime before the next door

---

## 🔥 Why RugBlitz Wins

### ⚡ Pyth Entropy VRF Integration
**True on-chain randomness** — No server seeds, no trust assumptions. Pyth Network's verifiable random function ensures every game outcome is cryptographically provable and tamper-proof.

### 🚀 Built for Monad's Speed
- **10,000+ TPS** — Instant game state updates
- **Sub-second finality** — No waiting for confirmations
- **Low gas fees** — Micro-bets are economically viable

### 📱 Frictionless UX
- Privy embedded wallets — no MetaMask, no seed phrases
- Play in seconds after connecting
- Mobile-first responsive design

### 🏆 Competitive Leaderboard
Track stats, compete for highest multipliers, climb global rankings.

---

## 🎮 Game Mechanics

| Mode | Doors | Rug Chance | Level 5 Multi | Level 10 Multi |
|------|-------|------------|---------------|----------------|
| Easy | 5 | 20% | 3.05x | 9.31x |
| Medium | 4 | 25% | 4.21x | 17.76x |
| Hard | 3 | 33% | 7.59x | 57.67x |

**House Edge:** 5% on winnings — sustainable economics

---

## 🏗️ Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS, Framer Motion |
| Wallet | Privy (Embedded EVM Wallet) |
| Blockchain | Wagmi, Viem |
| Network | **Monad Testnet** (Chain ID: 10143) |
| Randomness | **Pyth Entropy VRF** |
| Smart Contract | Solidity 0.8.24 |
| Database | MongoDB Atlas |

---

## 🔗 Deployed Contract

**Monad Testnet:** `[DEPLOY_ADDRESS]`

[View on Monad Explorer →](https://testnet.monadscan.com/address/[DEPLOY_ADDRESS])

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Deploy contract to Monad Testnet
# First add DEPLOYER_PRIVATE_KEY to .env.local
npm run compile
npm run deploy
```

---

## 📦 Contract Deployment

1. Add your deployer private key to `.env.local`:
   ```
   DEPLOYER_PRIVATE_KEY=0x...
   ```

2. Compile and deploy:
   ```bash
   npm run compile
   npm run deploy
   ```

3. Update the contract address in:
   - `.env.local` → `NEXT_PUBLIC_CONTRACT_ADDRESS`
   - `src/config/chains.ts` → `CONTRACT_ADDRESSES.doorRunner`

4. Fund the house by sending MON to the contract

---

## 🎯 Why Monad?

- **Parallel Execution** — 10,000 TPS for instant gameplay
- **EVM Compatible** — Deploy existing Solidity contracts
- **Low Latency** — Sub-second finality for real-time gaming
- **Growing Ecosystem** — Part of the high-performance blockchain future

---

## 👥 Team

**Sahil Gupta** — Full Stack Developer  
**Abhishek Vishwakarma** — Smart Contract & Backend

---

<p align="center">
  <b>⚡ Ship fast. Don't get rugged. 🚪💰</b>
</p>
