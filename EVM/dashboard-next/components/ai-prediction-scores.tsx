"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api"

type PredictionMetrics = {
  truePositive: number
  falsePositive: number
  falseNegative: number
  accuracy: number
  precision: number
  recall: number
  f1Score: number
}

export function AIPredictionScores() {
  const [metrics, setMetrics] = useState<PredictionMetrics>({
    truePositive: 0,
    falsePositive: 0,
    falseNegative: 0,
    accuracy: 0,
    precision: 0,
    recall: 0,
    f1Score: 0,
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch from multiple sources to get comprehensive data
        const [stats, highRiskTxs] = await Promise.all([
          api.getStats().catch(() => ({ recentTransactions: [] })),
          api.getHighRiskTransactions().catch(() => []),
        ])
        
        const txs = stats.recentTransactions || []
        const allTxs = [...txs, ...highRiskTxs]
        
        // Risk threshold used by analyzer (typically 70)
        const RISK_THRESHOLD = 70
        const LOW_RISK_THRESHOLD = 30
        
        // Calculate prediction metrics based on risk scores and flags
        let truePositive = 0 // High risk (>=70) AND flagged (suspicious or has flags)
        let falsePositive = 0 // Low risk (<30) BUT flagged (suspicious or has flags)
        let falseNegative = 0 // High risk (>=70) BUT not flagged
        let trueNegative = 0 // Low risk (<30) AND not flagged (for accuracy calculation)
        
        // Debug: log transaction data structure
        if (allTxs.length > 0) {
          console.log("Sample transaction:", allTxs[0])
        }
        
        allTxs.forEach((tx: any) => {
          // Handle different data structures
          const riskScore = tx.riskScore || tx.analysis?.riskScore || 0
          const suspicious = tx.suspicious !== undefined ? tx.suspicious : (tx.analysis?.suspicious || false)
          const flags = tx.flags || tx.anomalyFlags || tx.analysis?.anomalyFlags || []
          const hasFlags = Array.isArray(flags) && flags.length > 0
          
          // Determine if transaction was flagged by AI
          // Suspicious is true if riskScore >= threshold OR explicitly marked suspicious
          const wasFlagged = suspicious || hasFlags || (riskScore >= RISK_THRESHOLD)
          
          // True Positive: High risk (>=70) AND flagged (correctly identified)
          if (riskScore >= RISK_THRESHOLD && wasFlagged) {
            truePositive++
          }
          // False Positive: Low risk (<30) BUT flagged (incorrectly flagged)
          else if (riskScore < LOW_RISK_THRESHOLD && riskScore > 0 && wasFlagged) {
            falsePositive++
          }
          // False Negative: High risk (>=70) BUT not flagged (missed)
          else if (riskScore >= RISK_THRESHOLD && !wasFlagged) {
            falseNegative++
          }
          // True Negative: Low risk (<30) AND not flagged (correctly ignored)
          else if (riskScore < LOW_RISK_THRESHOLD && riskScore > 0 && !wasFlagged) {
            trueNegative++
          }
        })
        
        // Calculate accuracy, precision, recall, F1 score
        const totalPredictions = truePositive + falsePositive + falseNegative + trueNegative
        
        // Accuracy: (TP + TN) / (TP + TN + FP + FN)
        const accuracy = totalPredictions > 0 
          ? ((truePositive + trueNegative) / totalPredictions) * 100 
          : 0
        
        // Precision: TP / (TP + FP) - Of all flagged, how many were actually high risk?
        const precision = (truePositive + falsePositive) > 0
          ? (truePositive / (truePositive + falsePositive)) * 100
          : 0
        
        // Recall: TP / (TP + FN) - Of all high-risk transactions, how many were caught?
        const recall = (truePositive + falseNegative) > 0
          ? (truePositive / (truePositive + falseNegative)) * 100
          : 0
        
        // F1 Score: Harmonic mean of precision and recall
        const f1Score = (precision + recall) > 0
          ? (2 * (precision * recall) / (precision + recall))
          : 0
        
        setMetrics({
          truePositive,
          falsePositive,
          falseNegative,
          accuracy: Math.round(accuracy * 10) / 10,
          precision: Math.round(precision * 10) / 10,
          recall: Math.round(recall * 10) / 10,
          f1Score: Math.round(f1Score * 10) / 10,
        })
      } catch (error) {
        console.error("Failed to fetch prediction metrics:", error)
        setMetrics({
          truePositive: 0,
          falsePositive: 0,
          falseNegative: 0,
          accuracy: 0,
          precision: 0,
          recall: 0,
          f1Score: 0,
        })
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [])

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">AI Prediction Scores</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 rounded-lg bg-green-500/20 border border-green-500/50">
            <div className="text-xs text-muted-foreground mb-1">True Positive</div>
            <div className="text-2xl font-bold text-green-500">{metrics.truePositive}</div>
            <div className="text-xs text-green-400 mt-1">Correctly flagged</div>
          </div>
          <div className="p-3 rounded-lg bg-yellow-500/20 border border-yellow-500/50">
            <div className="text-xs text-muted-foreground mb-1">False Positive</div>
            <div className="text-2xl font-bold text-yellow-500">{metrics.falsePositive}</div>
            <div className="text-xs text-yellow-400 mt-1">Incorrectly flagged</div>
          </div>
          <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/50">
            <div className="text-xs text-muted-foreground mb-1">False Negative</div>
            <div className="text-2xl font-bold text-red-500">{metrics.falseNegative}</div>
            <div className="text-xs text-red-400 mt-1">Missed risks</div>
          </div>
        </div>
        
        <div className="pt-3 border-t">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Accuracy</div>
              <div className="text-xl font-semibold">{metrics.accuracy.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Precision</div>
              <div className="text-xl font-semibold">{metrics.precision.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Recall</div>
              <div className="text-xl font-semibold">{metrics.recall.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">F1 Score</div>
              <div className="text-xl font-semibold">{metrics.f1Score.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

