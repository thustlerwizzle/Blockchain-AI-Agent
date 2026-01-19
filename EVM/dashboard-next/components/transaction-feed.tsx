"use client"

import { useState, useEffect } from "react"
import { ArrowRight, ExternalLink, Search } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { api, type Transaction } from "@/lib/api"
import { formatEther } from "viem"

type TransactionDisplay = {
  id: string
  hash: string
  from: string
  to: string
  value: string
  chain: string
  riskScore: number
  riskLevel: "low" | "medium" | "high"
  timestamp: string
}

function formatValue(value: string | bigint): string {
  if (typeof value === "bigint") {
    const eth = formatEther(value)
    const num = parseFloat(eth)
    if (num >= 1) {
      return `${num.toFixed(2)} ETH`
    } else if (num > 0) {
      return `${(num * 1000).toFixed(2)} gwei`
    }
    return "0 ETH"
  }
  return value
}

function getRiskLevel(riskScore: number): "low" | "medium" | "high" {
  if (riskScore < 30) return "low"
  if (riskScore < 70) return "medium"
  return "high"
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

function formatHash(hash: string): string {
  if (hash.length <= 12) return hash
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`
}

function formatAddress(address: string): string {
  if (address.length <= 10) return address
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

export function TransactionFeed() {
  const [transactions, setTransactions] = useState<TransactionDisplay[]>([])
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const txs = await api.getRecentTransactions(50)
        
        const formatted: TransactionDisplay[] = txs.map((tx) => ({
          id: tx.hash,
          hash: formatHash(tx.hash),
          from: tx.from || "",
          to: tx.to || "",
          value: formatValue(tx.value),
          chain: tx.chain || "Ethereum",
          riskScore: tx.riskScore || 0,
          riskLevel: getRiskLevel(tx.riskScore || 0),
          timestamp: tx.timestamp ? formatTimeAgo(tx.timestamp) : "Unknown",
        }))

        setTransactions(formatted.slice(0, 20))
      } catch (error) {
        console.error("Failed to fetch transactions:", error)
      }
    }

    fetchTransactions()
    const interval = setInterval(fetchTransactions, 5000) // Refresh every 5 seconds

    return () => clearInterval(interval)
  }, [])

  const filteredTransactions = transactions.filter(
    (tx) =>
      tx.hash.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.chain.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.to.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">
            Recent Transactions
          </CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search transactions..."
              className="h-8 pl-9 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[400px] overflow-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Transaction</th>
                <th className="px-4 py-3 font-medium">Chain</th>
                <th className="px-4 py-3 font-medium">Value</th>
                <th className="px-4 py-3 font-medium">Risk Score</th>
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No transactions found
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="border-b border-border/50 transition-colors hover:bg-secondary/50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <code className="text-xs font-medium text-foreground">
                          {tx.hash}
                        </code>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span className="max-w-[60px] truncate">{formatAddress(tx.from)}</span>
                          <ArrowRight className="h-3 w-3" />
                          <span className="max-w-[60px] truncate">{tx.to ? formatAddress(tx.to) : "Contract"}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className="text-xs font-normal text-foreground"
                      >
                        {tx.chain}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-foreground">
                        {tx.value}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <RiskBadge score={tx.riskScore} level={tx.riskLevel} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground">
                        {tx.timestamp}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function RiskBadge({
  score,
  level,
}: {
  score: number
  level: "low" | "medium" | "high"
}) {
  const colors = {
    low: "bg-success/20 text-success border-success/30",
    medium: "bg-warning/20 text-warning border-warning/30",
    high: "bg-destructive/20 text-destructive border-destructive/30",
  }

  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${colors[level]}`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            level === "low"
              ? "bg-success"
              : level === "medium"
                ? "bg-warning"
                : "bg-destructive"
          }`}
        />
        {score}
      </div>
    </div>
  )
}

