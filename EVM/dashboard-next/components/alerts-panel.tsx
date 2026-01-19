"use client"

import React, { useState, useEffect } from "react"
import { AlertTriangle, Bell, ShieldAlert, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { formatEther } from "viem"

type Alert = {
  id: string
  type: string
  icon: React.ElementType
  title: string
  description: string
  time: string
  severity: "high" | "medium" | "low"
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (seconds < 60) return "Just now"
  if (minutes < 60) return `${minutes} min ago`
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`
  return `${Math.floor(hours / 24)} day${hours > 24 ? "s" : ""} ago`
}

export function AlertsPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([])

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const highRiskTxs = await api.getHighRiskTransactions()
        
        const alertList: Alert[] = highRiskTxs.slice(0, 3).map((tx, index) => {
          const riskScore = tx.riskScore || 0
          const value = typeof tx.value === "bigint" ? formatEther(tx.value) : (tx.value || "0")
          const ethValue = parseFloat(String(value)) || 0
          const hash = tx.hash || `unknown-${index}`
          const chain = tx.chain || "unknown"
          const hashDisplay = hash.length > 8 ? `${hash.slice(0, 8)}...` : hash
          
          let severity: "high" | "medium" | "low" = "low"
          let title = "Transaction Alert"
          let description = `Transaction ${hashDisplay} on ${chain}`
          let icon = AlertTriangle
          
          if (riskScore >= 80) {
            severity = "high"
            icon = ShieldAlert
            title = "High-Risk Transaction"
            description = `Risk score ${riskScore}: ${hashDisplay} on ${chain}`
          } else if (ethValue > 100) {
            severity = "medium"
            icon = TrendingUp
            title = "Large Value Transfer"
            description = `${ethValue.toFixed(2)} ETH transfer on ${chain}`
          } else {
            severity = "low"
            icon = AlertTriangle
            title = "Transaction Alert"
            description = `Transaction on ${chain}`
          }
          
          return {
            id: tx.hash || `alert-${index}`,
            type: severity,
            icon,
            title,
            description,
            time: tx.timestamp ? formatTimeAgo(tx.timestamp) : "Unknown",
            severity,
          }
        })
        
        setAlerts(alertList.length > 0 ? alertList : [])
      } catch (error) {
        console.error("Failed to fetch alerts:", error)
        setAlerts([])
      }
    }

    fetchAlerts()
    const interval = setInterval(fetchAlerts, 10000) // Refresh every 10 seconds

    return () => clearInterval(interval)
  }, [])

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Recent Alerts</CardTitle>
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
            <Bell className="h-3.5 w-3.5" />
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No recent alerts
          </p>
        ) : (
          alerts.map((alert) => (
            <AlertItem key={alert.id} {...alert} />
          ))
        )}
      </CardContent>
    </Card>
  )
}

function AlertItem({
  icon: Icon,
  title,
  description,
  time,
  severity,
}: {
  icon: React.ElementType
  title: string
  description: string
  time: string
  severity: "high" | "medium" | "low"
}) {
  const severityColors = {
    high: "bg-destructive/20 text-destructive",
    medium: "bg-warning/20 text-warning",
    low: "bg-success/20 text-success",
  }

  return (
    <div className="flex gap-3 rounded-lg border border-border/50 bg-secondary/30 p-3 transition-colors hover:bg-secondary/50">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          severityColors[severity]
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{description}</p>
        <p className="mt-1 text-xs text-muted-foreground">{time}</p>
      </div>
    </div>
  )
}

