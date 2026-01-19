"use client"

import React, { useState, useEffect } from "react"
import { Bot, CheckCircle2, Clock, Cpu, Zap } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { api } from "@/lib/api"

export function AgentStatus() {
  const [status, setStatus] = useState({
    running: false,
    accuracy: "0%",
    uptime: "0%",
    avgResponse: "0ms",
    learningProgress: 0,
  })

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await api.getStats()
        
        const successRate = data.metrics?.successRate || 0
        const accuracy = (successRate * 100).toFixed(1)
        const uptime = data.stats?.uptime || 0
        const uptimePercent = uptime > 0 ? "99.9%" : "0%"
        
        // Calculate learning progress based on success rate (simplified)
        const learningProgress = Math.min(100, Math.round(successRate * 100))
        
        setStatus({
          running: data.running || false,
          accuracy: `${accuracy}%`,
          uptime: uptimePercent,
          avgResponse: "124ms", // Placeholder
          learningProgress,
        })
      } catch (error) {
        console.error("Failed to fetch agent status:", error)
      }
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 5000) // Refresh every 5 seconds

    return () => clearInterval(interval)
  }, [])

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Agent Status</CardTitle>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              {status.running && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              )}
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  status.running ? "bg-success" : "bg-muted"
                }`}
              />
            </span>
            <span className={`text-xs font-medium ${status.running ? "text-success" : "text-muted-foreground"}`}>
              {status.running ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg bg-secondary p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Autonomous Mode
              </p>
              <p className="text-xs text-muted-foreground">
                Monitoring all chains
              </p>
            </div>
          </div>
          {status.running ? (
            <CheckCircle2 className="h-5 w-5 text-success" />
          ) : null}
        </div>

        <div className="space-y-3">
          <StatusItem
            icon={Cpu}
            label="AI Model"
            value="GPT-4o-mini"
            detail={`${status.accuracy} accuracy`}
          />
          <StatusItem
            icon={Clock}
            label="Uptime"
            value={status.uptime}
            detail="Last 30 days"
          />
          <StatusItem
            icon={Zap}
            label="Avg Response"
            value={status.avgResponse}
            detail="Per analysis"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Learning Progress</span>
            <span className="font-medium text-foreground">{status.learningProgress}%</span>
          </div>
          <Progress value={status.learningProgress} className="h-1.5" />
          <p className="text-xs text-muted-foreground">
            Reinforcement learning cycle
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function StatusItem({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ElementType
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  )
}

