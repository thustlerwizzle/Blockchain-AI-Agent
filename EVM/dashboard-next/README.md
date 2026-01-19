# Blockchain AI Agent Dashboard (Next.js)

A modern Next.js dashboard that displays real-time blockchain monitoring data from the Blockchain AI Agent server.

## Features

- **Real-time Data**: Fetches live data from the Blockchain AI Agent API
- **Multi-chain Monitoring**: View transactions across multiple blockchains
- **Risk Analysis**: Visualize transaction risk levels in real-time
- **Chain Overview**: See activity distribution across different chains
- **Alerts Panel**: Get notified of high-risk transactions
- **Agent Status**: Monitor the AI agent's status and performance

## Prerequisites

- Node.js 18+ 
- The Blockchain AI Agent server running on port 3001 (default)

## Installation

1. Install dependencies:

```bash
npm install
# or
pnpm install
# or
yarn install
```

2. Configure the API URL (optional):

Create a `.env.local` file in the root of `dashboard-next`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

If not set, it defaults to `http://localhost:3001`.

## Running the Dashboard

### Development Mode

```bash
npm run dev
```

The dashboard will be available at `http://localhost:3002`

### Production Build

```bash
npm run build
npm start
```

## API Endpoints Used

The dashboard fetches data from the following API endpoints:

- `/api/stats` - Agent statistics and recent transactions
- `/api/high-risk/transactions` - High-risk transaction alerts
- `/api/high-risk/chains` - Chain activity breakdown

## Components

- **Header**: Navigation and chain/time filters
- **StatsGrid**: Overview statistics (transactions, high-risk, AI predictions, strategies)
- **TransactionFeed**: Real-time transaction list with search
- **RiskAnalysisChart**: Risk distribution over time
- **ChainOverview**: Activity by blockchain
- **AgentStatus**: Agent health and performance metrics
- **AlertsPanel**: Recent high-risk transaction alerts

## Data Updates

- Stats: Every 5 seconds
- Transactions: Every 5 seconds
- Charts: Every 30 seconds
- Alerts: Every 10 seconds

## Troubleshooting

If the dashboard doesn't show data:

1. Ensure the Blockchain AI Agent server is running on port 3001
2. Check that CORS is enabled on the server
3. Verify the API URL in `.env.local` matches your server URL
4. Check the browser console for API errors

## Port Configuration

- Next.js Dashboard: Port 3002 (configurable via `-p` flag)
- API Server: Port 3001 (default, configurable via `PORT` env var)

