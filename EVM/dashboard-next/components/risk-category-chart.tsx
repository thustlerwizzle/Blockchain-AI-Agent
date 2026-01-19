"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts"
import { api } from "@/lib/api"

type RiskTypeCount = {
  name: string
  count: number
}

export function RiskCategoryChart() {
  const [riskTypeData, setRiskTypeData] = useState<RiskTypeCount[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get data from multiple sources
        const [txs, marketManipulationAlerts, flaggedAddresses] = await Promise.all([
          api.getRecentTransactions(1000).catch(() => []),
          api.getMarketManipulationAlerts(500).catch(() => []),
          api.getEnhancedSuspiciousActivity().catch(() => ({ flaggedAddresses: [] })),
        ])
        
        // Initialize risk category counters
        const riskCategories: { [key: string]: number } = {
          "Volume Spike": 0,
          "Pump and Dump": 0,
          "Flagged Address": 0,
          "Large Value Transfer": 0,
        }
        
        // Track processed addresses/transactions to avoid double counting
        const processedTxs = new Set<string>()
        const processedAlerts = new Set<string>()
        
        // 1. Count Volume Spikes from market manipulation alerts
        const volumeSpikeAlerts = (Array.isArray(marketManipulationAlerts) ? marketManipulationAlerts : [])
          .filter((alert: any) => {
            const alertKey = `${alert.address}-${alert.tokenAddress || 'none'}`
            if (processedAlerts.has(alertKey)) return false
            const alertType = (alert.alertType || "").toUpperCase()
            const hasVolumeSpike = alertType.includes("VOLUME_SPIKE") || 
                                   alert.volumeSpike != null && alert.volumeSpike > 2.0 ||
                                   alert.description?.toLowerCase().includes("volume spike")
            return hasVolumeSpike
          })
        riskCategories["Volume Spike"] = volumeSpikeAlerts.length
        volumeSpikeAlerts.forEach((alert: any) => {
          processedAlerts.add(`${alert.address}-${alert.tokenAddress || 'none'}`)
        })
        
        // 2. Count Pump and Dump from market manipulation alerts
        const pumpDumpAlerts = (Array.isArray(marketManipulationAlerts) ? marketManipulationAlerts : [])
          .filter((alert: any) => {
            const alertKey = `${alert.address}-${alert.tokenAddress || 'none'}`
            if (processedAlerts.has(alertKey)) return false
            const alertType = (alert.alertType || "").toUpperCase()
            const hasPumpDump = alertType.includes("PUMP") || 
                               alertType.includes("DUMP") || 
                               alertType.includes("PUMP_AND_DUMP") ||
                               alertType.includes("MARKET_MANIPULATION") ||
                               alert.description?.toLowerCase().includes("pump") ||
                               alert.description?.toLowerCase().includes("dump")
            return hasPumpDump && !alertType.includes("VOLUME_SPIKE")
          })
        riskCategories["Pump and Dump"] = pumpDumpAlerts.length
        pumpDumpAlerts.forEach((alert: any) => {
          processedAlerts.add(`${alert.address}-${alert.tokenAddress || 'none'}`)
        })
        
        // 3. Count Flagged Addresses from enhanced suspicious activity
        const flagged = Array.isArray(flaggedAddresses.flaggedAddresses) 
          ? flaggedAddresses.flaggedAddresses 
          : []
        riskCategories["Flagged Address"] = flagged.length
        
        // 4. Count Large Value Transfers from transactions
        const largeValueTxs = Array.isArray(txs) ? txs.filter((tx: any) => {
          const txKey = tx.hash || `${tx.from}-${tx.to}-${tx.timestamp}`
          if (processedTxs.has(txKey)) return false
          const flags = tx.flags || tx.anomalyFlags || []
          
          // Check for large value flags
          let hasLargeValue = flags.includes("LARGE_VALUE") || flags.includes("VERY_LARGE_VALUE")
          
          // Check actual value (> 100 ETH = 100000000000000000000 wei)
          if (!hasLargeValue && tx.value != null) {
            const bigInt100ETH = BigInt("100000000000000000000") // 100 ETH in wei
            if (typeof tx.value === "bigint") {
              hasLargeValue = tx.value > bigInt100ETH
            } else if (typeof tx.value === "string") {
              const valueBigInt = BigInt(tx.value)
              hasLargeValue = valueBigInt > bigInt100ETH
            } else if (typeof tx.value === "number") {
              // If it's already in ETH, check if > 100
              hasLargeValue = tx.value > 100
            }
          }
          
          if (hasLargeValue) {
            processedTxs.add(txKey)
            return true
          }
          return false
        }) : []
        riskCategories["Large Value Transfer"] = largeValueTxs.length
        
        // Convert to array format for chart - always show all 4 categories
        const data = Object.entries(riskCategories)
          .map(([name, count]) => ({
            name,
            count,
          }))
          .sort((a, b) => b.count - a.count) // Sort by count descending
        
        setRiskTypeData(data)
      } catch (error) {
        console.error("Failed to fetch risk category data:", error)
        setRiskTypeData([])
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [])

  const getRiskTypeColor = (name: string) => {
    const colors: { [key: string]: string } = {
      "Volume Spike": "oklch(0.70 0.22 145)", // Vibrant Green
      "Pump and Dump": "oklch(0.50 0.25 0)", // Deep Red
      "Flagged Address": "oklch(0.58 0.22 45)", // Bright Orange-Red
      "Large Value Transfer": "oklch(0.65 0.22 65)", // Vibrant Orange
    }
    return colors[name] || "oklch(0.65 0.01 285)"
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Risk Category Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={riskTypeData} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "oklch(0.65 0 0)", fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "oklch(0.65 0 0)", fontSize: 11 }}
                dx={-10}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "oklch(0.15 0.01 285)",
                  border: "1px solid oklch(0.25 0.02 285)",
                  borderRadius: "8px",
                  color: "oklch(0.98 0 0)",
                }}
              />
              <Bar 
                dataKey="count"
                radius={[4, 4, 0, 0]}
              >
                {riskTypeData.map((entry, index) => (
                  <Bar.Cell key={`cell-${index}`} fill={getRiskTypeColor(entry.name)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

