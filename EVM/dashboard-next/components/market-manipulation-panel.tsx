"use client"

import { useState, useEffect } from "react"
import { TrendingUp, TrendingDown, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api"

type MarketManipulationAlert = {
  alertType: string
  address: string
  tokenAddress?: string
  severity: string
  riskScore: number
  timestamp: number
  description?: string
  priceChange?: number
  volumeSpike?: number
  pumpProbability?: number
  rsi?: number
  relatedAddresses?: string[]
}

export function MarketManipulationPanel() {
  const [alerts, setAlerts] = useState<MarketManipulationAlert[]>([])

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const data = await api.getMarketManipulationAlerts(50)
        setAlerts(Array.isArray(data) ? data : [])
      } catch (error) {
        console.error("Failed to fetch market manipulation alerts:", error)
        setAlerts([])
      }
    }

    fetchAlerts()
    const interval = setInterval(fetchAlerts, 10000) // Refresh every 10 seconds

    return () => clearInterval(interval)
  }, [])

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-destructive/20 text-destructive border-destructive"
      case "high":
        return "bg-warning/20 text-warning border-warning"
      case "medium":
        return "bg-yellow-500/20 text-yellow-600 border-yellow-500"
      default:
        return "bg-muted text-muted-foreground border-border"
    }
  }

  const getAlertIcon = (alertType: string) => {
    if (alertType?.includes("PUMP")) return <TrendingUp className="h-4 w-4" />
    if (alertType?.includes("DUMP")) return <TrendingDown className="h-4 w-4" />
    return <AlertTriangle className="h-4 w-4" />
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Market Manipulation Alerts</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No market manipulation alerts
            </p>
          ) : (
            alerts.map((alert, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${getSeverityColor(alert.severity)}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getAlertIcon(alert.alertType)}
                    <span className="text-sm font-medium">
                      {alert.alertType?.replace(/_/g, " ") || "Market Manipulation"}
                    </span>
                  </div>
                  <Badge variant="outline" className={getSeverityColor(alert.severity)}>
                    {alert.severity?.toUpperCase() || "MEDIUM"}
                  </Badge>
                </div>
                <div className="text-xs font-mono text-muted-foreground mb-2 break-all">
                  {alert.address}
                  {alert.tokenAddress && <div className="mt-1">Token: {alert.tokenAddress}</div>}
                </div>
                <div className="text-xs text-muted-foreground mb-2">
                  {alert.description || "Market manipulation pattern detected"}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>Risk Score: <strong>{Math.round(alert.riskScore || 0)}</strong></span>
                  {alert.priceChange != null && typeof alert.priceChange === 'number' && (
                    <span className={alert.priceChange >= 0 ? "text-success" : "text-destructive"}>
                      {alert.priceChange >= 0 ? "+" : ""}
                      {alert.priceChange.toFixed(2)}%
                    </span>
                  )}
                </div>
                {(alert.volumeSpike != null || alert.pumpProbability != null || alert.rsi != null) && (
                  <div className="flex gap-3 text-xs text-muted-foreground mt-2 pt-2 border-t">
                    {alert.volumeSpike != null && typeof alert.volumeSpike === 'number' && (
                      <span>Volume: {alert.volumeSpike.toFixed(2)}x</span>
                    )}
                    {alert.pumpProbability != null && typeof alert.pumpProbability === 'number' && (
                      <span>Pump: {alert.pumpProbability.toFixed(0)}%</span>
                    )}
                    {alert.rsi != null && typeof alert.rsi === 'number' && (
                      <span>RSI: {alert.rsi.toFixed(2)}</span>
                    )}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-2">
                  {new Date(alert.timestamp).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

