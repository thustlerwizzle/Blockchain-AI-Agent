"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"
import { api } from "@/lib/api"
import { formatEther } from "viem"

interface ChainData {
  chain: string
  transactions: number
  value: number
}

export function ChainOverview() {
  const [chainData, setChainData] = useState<ChainData[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("Fetching chain activity data...")
        
        // Primary: Calculate from all available transactions
        const [stats, highRiskTxs] = await Promise.all([
          api.getStats().catch(() => ({ recentTransactions: [] })),
          api.getRecentTransactions(1000).catch(() => []),
        ])
        
        const allTxs = [
          ...(stats.recentTransactions || []),
          ...highRiskTxs
        ]
        
        console.log(`Total transactions found: ${allTxs.length}`)
        
        // Deduplicate by hash
        const txMap = new Map<string, any>()
        allTxs.forEach((tx: any) => {
          const hash = tx.hash || `${tx.from}-${tx.to}-${tx.timestamp}`
          if (!txMap.has(hash)) {
            txMap.set(hash, tx)
          }
        })
        
        const uniqueTxs = Array.from(txMap.values())
        console.log(`Unique transactions: ${uniqueTxs.length}`)
        
        // Group by chain
        const chainMap: { [key: string]: { count: number; value: bigint } } = {}
        
        uniqueTxs.forEach((tx: any) => {
          const chain = (tx.chain || "ethereum").toLowerCase()
          if (!chainMap[chain]) {
            chainMap[chain] = { count: 0, value: BigInt(0) }
          }
          chainMap[chain].count++
          
          // Handle different value formats
          let value = BigInt(0)
          if (typeof tx.value === "bigint") {
            value = tx.value
          } else if (typeof tx.value === "string") {
            try {
              // Check if it's already in ETH format (has decimal point)
              if (tx.value.includes(".")) {
                const ethValue = parseFloat(tx.value)
                value = BigInt(Math.floor(ethValue * 1e18))
              } else {
                value = BigInt(tx.value)
              }
            } catch {
              value = BigInt(0)
            }
          } else if (typeof tx.value === "number") {
            // If already in ETH, convert to wei
            value = BigInt(Math.floor(tx.value * 1e18))
          }
          
          chainMap[chain].value += value
        })
        
        console.log("Chain map:", chainMap)
        
        // Format chain names
        const chainNameMap: { [key: string]: string } = {
          "ethereum": "ETH",
          "polygon": "MATIC",
          "bsc": "BSC",
          "binance": "BSC",
          "arbitrum": "ARB",
          "optimism": "OP",
          "base": "BASE",
          "avalanche": "AVAX",
          "avalanche-fuji": "AVAX",
          "fantom": "FTM",
          "gnosis": "GNO",
        }
        
        const formatted = Object.entries(chainMap)
          .map(([chain, data]) => ({
            chain: chainNameMap[chain] || chain.toUpperCase().slice(0, 3),
            transactions: data.count,
            value: parseFloat(formatEther(data.value)),
          }))
          .sort((a, b) => b.transactions - a.transactions)
          .slice(0, 5)
        
        console.log("Formatted chain data:", formatted)
        
        if (formatted.length > 0) {
          setChainData(formatted)
        } else {
          // Show placeholder if no data
          setChainData([
            { chain: "ETH", transactions: 0, value: 0 },
            { chain: "MATIC", transactions: 0, value: 0 },
            { chain: "ARB", transactions: 0, value: 0 },
            { chain: "BSC", transactions: 0, value: 0 },
            { chain: "OP", transactions: 0, value: 0 },
          ])
        }
      } catch (error) {
        console.error("Failed to fetch chain activity:", error)
        setChainData([
          { chain: "ETH", transactions: 0, value: 0 },
          { chain: "MATIC", transactions: 0, value: 0 },
          { chain: "ARB", transactions: 0, value: 0 },
          { chain: "BSC", transactions: 0, value: 0 },
          { chain: "OP", transactions: 0, value: 0 },
        ])
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [])

  const data = chainData.length > 0 ? chainData : [
    { chain: "ETH", transactions: 0, value: 0 },
    { chain: "MATIC", transactions: 0, value: 0 },
    { chain: "ARB", transactions: 0, value: 0 },
    { chain: "BSC", transactions: 0, value: 0 },
    { chain: "OP", transactions: 0, value: 0 },
  ]

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Chain Activity</CardTitle>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-muted-foreground">Transactions</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-chart-2" />
              <span className="text-muted-foreground">Value (ETH)</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={8}>
              <XAxis
                dataKey="chain"
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
              <Bar
                dataKey="transactions"
                fill="oklch(0.65 0.24 285)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="value"
                fill="oklch(0.70 0.15 180)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

