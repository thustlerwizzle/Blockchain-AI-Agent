"use client"

import { useState, useEffect } from "react"
import { Activity, AlertTriangle, Brain, Zap } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { api } from "@/lib/api"

export function StatsGrid() {
  const [stats, setStats] = useState({
    transactionsAnalyzed: "0",
    highRiskDetected: "0",
    aiPredictions: "0%",
    strategiesExecuted: "0",
  })

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await api.getStats()
        
        const transactionsProcessed = data.stats?.transactionsProcessed || 0
        const suspiciousTransactions = data.stats?.suspiciousTransactions || 0
        const strategiesTriggered = data.stats?.strategiesTriggered || 0
        const successRate = data.metrics?.successRate || 0
        const accuracy = (successRate * 100).toFixed(1)

        setStats({
          transactionsAnalyzed: transactionsProcessed.toLocaleString(),
          highRiskDetected: suspiciousTransactions.toLocaleString(),
          aiPredictions: `${accuracy}%`,
          strategiesExecuted: strategiesTriggered.toLocaleString(),
        })
      } catch (error) {
        console.error("Failed to fetch stats:", error)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 5000) // Refresh every 5 seconds

    return () => clearInterval(interval)
  }, [])

  const statItems = [
    {
      label: "Transactions Analyzed",
      value: stats.transactionsAnalyzed,
      change: "+12.5%",
      trend: "up" as const,
      icon: Activity,
    },
    {
      label: "High Risk Detected",
      value: stats.highRiskDetected,
      change: "+3.2%",
      trend: "up" as const,
      icon: AlertTriangle,
    },
    {
      label: "AI Predictions",
      value: stats.aiPredictions,
      change: "+0.4%",
      trend: "up" as const,
      icon: Brain,
    },
    {
      label: "Strategies Executed",
      value: stats.strategiesExecuted,
      change: "+8.1%",
      trend: "up" as const,
      icon: Zap,
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {statItems.map((stat) => (
        <Card key={stat.label} className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                <stat.icon className="h-4 w-4 text-primary" />
              </div>
              <span
                className={`text-xs font-medium ${
                  stat.trend === "up" ? "text-success" : "text-destructive"
                }`}
              >
                {stat.change}
              </span>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-semibold text-foreground">
                {stat.value}
              </p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

