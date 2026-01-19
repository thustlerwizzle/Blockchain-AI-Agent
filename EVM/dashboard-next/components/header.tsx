"use client"

import Image from "next/image"
import { Activity, ChevronDown, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const chains = [
  { name: "All Chains", id: "all" },
  { name: "Ethereum", id: "ethereum" },
  { name: "Polygon", id: "polygon" },
  { name: "Arbitrum", id: "arbitrum" },
  { name: "BSC", id: "bsc" },
]

const timeRanges = [
  { label: "Last 1 hour", value: "1h" },
  { label: "Last 12 hours", value: "12h" },
  { label: "Last 24 hours", value: "24h" },
  { label: "Last 7 days", value: "7d" },
]

export function Header() {
  return (
    <header className="border-b border-border bg-card">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Image
              src="/zodia-logo.png"
              alt="Zodia Markets Logo"
              width={32}
              height={32}
              className="h-8 w-auto object-contain"
              priority
            />
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-semibold text-foreground">Zodia</span>
              <span className="text-lg font-semibold text-primary">Markets</span>
            </div>
          </div>
        </div>

        <nav className="hidden items-center gap-6 md:flex">
          <NavItem label="Overview" active />
          <NavItem label="Transactions" />
          <NavItem label="Strategies" />
          <NavItem label="Analytics" />
          <NavItem label="Logs" />
        </nav>

        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                <Activity className="h-3.5 w-3.5" />
                All Chains
                <ChevronDown className="h-3.5 w-3.5 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {chains.map((chain) => (
                <DropdownMenuItem key={chain.id}>{chain.name}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                Last 12 hours
                <ChevronDown className="h-3.5 w-3.5 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {timeRanges.map((range) => (
                <DropdownMenuItem key={range.value}>
                  {range.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}

function NavItem({ label, active }: { label: string; active?: boolean }) {
  return (
    <button
      className={`text-sm font-medium transition-colors ${
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  )
}

