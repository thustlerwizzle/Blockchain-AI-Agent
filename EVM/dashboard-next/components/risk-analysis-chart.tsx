"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { api } from "@/lib/api"

export function RiskAnalysisChart() {
  const [chartData, setChartData] = useState<{ time: string; low: number; medium: number; high: number }[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get data from the stats API to align with port 3001 dashboard
        const stats = await api.getStats()
        const txs = stats.recentTransactions || await api.getRecentTransactions(1000)
        
        // Group transactions by time period and calculate risk distribution
        const now = Date.now()
        const hours: { [key: string]: { low: number; medium: number; high: number } } = {}
        
        // Initialize last 12 hours
        for (let i = 11; i >= 0; i--) {
          const hour = new Date(now - i * 60 * 60 * 1000)
          const timeKey = `${hour.getHours().toString().padStart(2, '0')}:00`
          hours[timeKey] = { low: 0, medium: 0, high: 0 }
        }
        
        // Count transactions by risk level per hour (aligned with risk breakdown)
        txs.forEach((tx: any) => {
          if (!tx.timestamp) return
          const txDate = new Date(tx.timestamp)
          const hour = txDate.getHours()
          const timeKey = `${hour.toString().padStart(2, '0')}:00`
          
          if (hours[timeKey]) {
            const riskScore = tx.riskScore || 0
            // Align risk thresholds with standard breakdown: Low (<30), Medium (30-69), High (≥70)
            if (riskScore < 30) {
              hours[timeKey].low++
            } else if (riskScore < 70) {
              hours[timeKey].medium++
            } else {
              hours[timeKey].high++
            }
          }
        })
        
        const data = Object.entries(hours).map(([time, counts]) => ({
          time,
          low: counts.low,
          medium: counts.medium,
          high: counts.high,
        }))
        
        setChartData(data)
      } catch (error) {
        console.error("Failed to fetch risk analysis data:", error)
        // Fallback to empty data
        setChartData([])
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [])

  // Fallback data if no real data available
  const data = chartData.length > 0 ? chartData : [
    { time: "00:00", low: 0, medium: 0, high: 0 },
    { time: "02:00", low: 0, medium: 0, high: 0 },
    { time: "04:00", low: 0, medium: 0, high: 0 },
    { time: "06:00", low: 0, medium: 0, high: 0 },
    { time: "08:00", low: 0, medium: 0, high: 0 },
    { time: "10:00", low: 0, medium: 0, high: 0 },
    { time: "12:00", low: 0, medium: 0, high: 0 },
    { time: "14:00", low: 0, medium: 0, high: 0 },
    { time: "16:00", low: 0, medium: 0, high: 0 },
    { time: "18:00", low: 0, medium: 0, high: 0 },
    { time: "20:00", low: 0, medium: 0, high: 0 },
    { time: "22:00", low: 0, medium: 0, high: 0 },
  ]

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Risk Analysis</CardTitle>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-success" />
              <span className="text-muted-foreground">Low</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-warning" />
              <span className="text-muted-foreground">Medium</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-destructive" />
              <span className="text-muted-foreground">High</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorLow" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="oklch(0.70 0.18 145)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="oklch(0.70 0.18 145)"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient id="colorMedium" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="oklch(0.75 0.18 85)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="oklch(0.75 0.18 85)"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient id="colorHigh" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="oklch(0.55 0.22 25)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="oklch(0.55 0.22 25)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "oklch(0.65 0 0)", fontSize: 11 }}
                dy={10}
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
              <Area
                type="monotone"
                dataKey="low"
                stroke="oklch(0.70 0.18 145)"
                strokeWidth={2}
                fill="url(#colorLow)"
              />
              <Area
                type="monotone"
                dataKey="medium"
                stroke="oklch(0.75 0.18 85)"
                strokeWidth={2}
                fill="url(#colorMedium)"
              />
              <Area
                type="monotone"
                dataKey="high"
                stroke="oklch(0.55 0.22 25)"
                strokeWidth={2}
                fill="url(#colorHigh)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

