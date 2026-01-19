import { Header } from "@/components/header"
import { StatsGrid } from "@/components/stats-grid"
import { TransactionFeed } from "@/components/transaction-feed"
import { RiskAnalysisChart } from "@/components/risk-analysis-chart"
import { RiskCategoryChart } from "@/components/risk-category-chart"
import { ChainOverview } from "@/components/chain-overview"
import { AgentStatus } from "@/components/agent-status"
import { AlertsPanel } from "@/components/alerts-panel"
import { MarketManipulationPanel } from "@/components/market-manipulation-panel"
import { FlaggedAddressesPanel } from "@/components/flagged-addresses-panel"
import { AIPredictionScores } from "@/components/ai-prediction-scores"

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">Overview</h1>
          <p className="text-sm text-muted-foreground">
            Real-time multi-chain monitoring and AI analysis
          </p>
        </div>

        <StatsGrid />

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <RiskAnalysisChart />
          </div>
          <div className="lg:col-span-1">
            <RiskCategoryChart />
          </div>
          <div className="lg:col-span-1">
            <ChainOverview />
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <TransactionFeed />
          </div>
          <div className="flex flex-col gap-6">
            <AgentStatus />
            <AlertsPanel />
            <AIPredictionScores />
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <MarketManipulationPanel />
          <FlaggedAddressesPanel />
        </div>
      </main>
    </div>
  )
}

