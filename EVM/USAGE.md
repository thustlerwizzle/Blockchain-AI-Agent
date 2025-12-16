# Blockchain AI Agent - Usage Guide

## 🚀 Quick Start

### 1. Basic Agent (Chat Mode)
The original chat interface for interactive blockchain operations:

```bash
bun run start:chat
```

### 2. Full Autonomous Agent
The complete agent with all features enabled:

```bash
bun run start
```

This starts:
- ✅ Multi-chain blockchain listener
- ✅ Intelligent transaction analyzer
- ✅ Strategy executor
- ✅ Reinforcement learning loop

### 3. Web Dashboard
Start the web dashboard for monitoring:

```bash
bun run start:dashboard
```

Then open http://localhost:3001 in your browser.

## 📋 Features

### 1. Multi-Chain Listener
Monitors transactions in real-time across multiple chains:
- Avalanche Fuji (default)
- Ethereum
- Polygon
- BSC

### 2. Intelligent Transaction Analyzer
- Rule-based analysis (large values, contract interactions, etc.)
- Pattern-based analysis (rapid transactions, new addresses, etc.)
- AI-based analysis using OpenAI GPT-4o-mini
- Risk scoring (0-100)
- Anomaly detection

### 3. Strategy Executor
Execute programmable strategies based on transaction analysis:

Example strategies included:
- **High Risk Alert**: Alerts when risk score exceeds 80
- **Large Value Monitor**: Monitors transactions above 1 ETH

You can create custom strategies with conditions and actions.

### 4. Reinforcement Learning
The agent learns from its actions:
- Calculates rewards based on detection accuracy
- Tracks performance metrics
- Adapts over time

### 5. Web Dashboard
Real-time monitoring dashboard showing:
- Agent statistics
- Learning metrics
- Recent transactions
- Risk analysis
- Control buttons

### 6. DeFi Modules
Plug-and-play DeFi integration:
- DEX Swaps
- Lending protocols
- Staking
- Yield farming

## 🔧 Configuration

Update `.env` file:

```env
OPENAI_API_KEY=your_key_here
WALLET_PRIVATE_KEY=your_key_here
```

## 📊 Example Usage

### Creating a Custom Strategy

```typescript
const customStrategy: Strategy = {
  id: "my-strategy",
  name: "My Custom Strategy",
  description: "Monitor specific addresses",
  enabled: true,
  conditions: [
    {
      type: "address_match",
      operator: "==",
      value: "0x...",
      field: "from"
    }
  ],
  actions: [
    {
      type: "alert",
      params: {
        title: "Custom Alert",
        message: "Address detected!"
      }
    }
  ]
};

agent.registerStrategy(customStrategy);
```

### Using DeFi Modules

```typescript
// Execute a swap
await defiManager.executeModule("dex-swap", {
  tokenIn: "0x...",
  tokenOut: "0x...",
  amountIn: BigInt("1000000000000000000"),
  minAmountOut: BigInt("950000000000000000"),
  recipient: "0x..."
});
```

## 🎯 Architecture

```
Agent Orchestrator
├── Multi-Chain Listener (Real-time monitoring)
├── Transaction Analyzer (AI + Rule-based analysis)
├── Strategy Executor (Programmable behaviors)
├── Reinforcement Learning (Adaptive learning)
└── DeFi Module Manager (Plug-and-play modules)
```

## 📝 Notes

- The agent runs continuously until stopped (Ctrl+C)
- Statistics are logged every 30 seconds
- Dashboard updates every 2 seconds
- All suspicious transactions are logged with details

