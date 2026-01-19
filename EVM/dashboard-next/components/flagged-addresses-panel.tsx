"use client"

import { useState, useEffect } from "react"
import { Flag, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api"

type FlaggedAddress = {
  address: string
  riskScore: number
  transactionCount: number
  activityTypes?: string[]
  timestamp?: number
}

export function FlaggedAddressesPanel() {
  const [flagged, setFlagged] = useState<{
    totalFlagged: number
    highPriority: number
    addresses: FlaggedAddress[]
  }>({
    totalFlagged: 0,
    highPriority: 0,
    addresses: [],
  })

  useEffect(() => {
    const fetchFlagged = async () => {
      try {
        const data = await api.getEnhancedSuspiciousActivity()
        const addresses = data.flaggedAddresses || []
        const highPriority = addresses.filter((a: any) => (a.riskScore || 0) >= 80).length

        setFlagged({
          totalFlagged: data.totalFlagged || addresses.length,
          highPriority,
          addresses: addresses.slice(0, 20),
        })
      } catch (error) {
        console.error("Failed to fetch flagged addresses:", error)
        setFlagged({ totalFlagged: 0, highPriority: 0, addresses: [] })
      }
    }

    fetchFlagged()
    const interval = setInterval(fetchFlagged, 10000) // Refresh every 10 seconds

    return () => clearInterval(interval)
  }, [])

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Flagged Addresses</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-destructive">{flagged.totalFlagged}</span>
            {flagged.highPriority > 0 && (
              <Badge variant="destructive" className="text-xs">
                {flagged.highPriority} High Priority
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {flagged.addresses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No flagged addresses
            </p>
          ) : (
            flagged.addresses.map((addr, index) => (
              <div
                key={index}
                className="p-3 rounded-lg border border-destructive/50 bg-destructive/10"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Flag className="h-4 w-4 text-destructive" />
                    <span className="text-xs font-mono text-destructive break-all">{addr.address}</span>
                  </div>
                  <Badge variant="destructive" className="text-xs">
                    Risk: {Math.round(addr.riskScore || 0)}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mb-1">
                  Activity Types: {addr.activityTypes?.join(", ") || "Unknown"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Transactions: {addr.transactionCount || 0}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

