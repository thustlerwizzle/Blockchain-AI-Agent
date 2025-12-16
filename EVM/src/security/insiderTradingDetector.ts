/**
 * Insider Trading Detection
 * Based on Insider-Monitor patterns
 * Tracks wallet activities, detects insider trading & balance changes
 */

import type { TransactionEvent } from "../listener/blockchainListener.js";
import type { Address } from "viem";

export interface WalletBalance {
  address: Address;
  chain: string;
  balance: bigint;
  balanceChange: bigint;
  timestamp: number;
  previousBalance: bigint;
  percentageChange: number;
}

export interface InsiderTradingAlert {
  address: Address;
  chain: string;
  alertType: "BALANCE_SPIKE" | "SUSPICIOUS_PATTERN" | "INSIDER_ACTIVITY" | "LARGE_WITHDRAWAL" | "RAPID_MOVEMENT";
  severity: "critical" | "warning" | "info";
  balanceChange: bigint;
  percentageChange: number;
  timestamp: number;
  description: string;
  relatedAddresses: Address[];
  transactionHashes: string[];
}

export interface WalletActivity {
  address: Address;
  chain: string;
  currentBalance: bigint;
  balanceHistory: Array<{ timestamp: number; balance: bigint }>;
  transactionCount: number;
  firstSeen: number;
  lastSeen: number;
  totalIn: bigint;
  totalOut: bigint;
  suspiciousFlags: string[];
}

export class InsiderTradingDetector {
  private walletBalances: Map<string, WalletBalance> = new Map(); // "chain:address" -> balance
  private walletActivities: Map<string, WalletActivity> = new Map();
  private alerts: InsiderTradingAlert[] = [];
  private significantChangeThreshold: bigint;
  private alertThreshold: number; // Percentage change to alert

  constructor(config: {
    significantChangeThreshold?: bigint; // Default: 0.1 ETH equivalent
    alertThreshold?: number; // Default: 200% change
  } = {}) {
    this.significantChangeThreshold = config.significantChangeThreshold || BigInt("100000000000000000"); // 0.1 ETH
    this.alertThreshold = config.alertThreshold || 200; // 200% change
  }

  /**
   * Track wallet balance changes from transaction
   */
  trackTransaction(tx: TransactionEvent, fromBalance?: bigint, toBalance?: bigint): void {
    // Track sender balance change
    if (tx.value > BigInt(0)) {
      const fromKey = `${tx.chain}:${tx.from}`;
      const previousBalance = this.walletBalances.get(fromKey)?.balance || BigInt(0);
      const newBalance = fromBalance || (previousBalance - tx.value);
      const balanceChange = newBalance - previousBalance;
      const percentageChange = previousBalance > BigInt(0)
        ? Number((balanceChange * BigInt(10000)) / previousBalance) / 100
        : balanceChange > BigInt(0) ? 1000 : 0;

      this.walletBalances.set(fromKey, {
        address: tx.from,
        chain: tx.chain,
        balance: newBalance,
        balanceChange,
        timestamp: tx.timestamp * 1000,
        previousBalance,
        percentageChange,
      });

      // Update wallet activity
      this.updateWalletActivity(tx.from, tx.chain, tx, balanceChange < BigInt(0) ? -tx.value : BigInt(0));

      // Check for alerts
      if (Math.abs(percentageChange) >= this.alertThreshold) {
        this.generateAlert(
          tx.from,
          tx.chain,
          balanceChange,
          percentageChange,
          tx.timestamp * 1000,
          tx.hash,
          "BALANCE_SPIKE"
        );
      }
    }

    // Track recipient balance change
    if (tx.to && tx.value > BigInt(0)) {
      const toKey = `${tx.chain}:${tx.to}`;
      const previousBalance = this.walletBalances.get(toKey)?.balance || BigInt(0);
      const newBalance = toBalance || (previousBalance + tx.value);
      const balanceChange = newBalance - previousBalance;
      const percentageChange = previousBalance > BigInt(0)
        ? Number((balanceChange * BigInt(10000)) / previousBalance) / 100
        : balanceChange > BigInt(0) ? 1000 : 0;

      this.walletBalances.set(toKey, {
        address: tx.to,
        chain: tx.chain,
        balance: newBalance,
        balanceChange,
        timestamp: tx.timestamp * 1000,
        previousBalance,
        percentageChange,
      });

      // Update wallet activity
      this.updateWalletActivity(tx.to, tx.chain, tx, tx.value);

      // Check for alerts
      if (Math.abs(percentageChange) >= this.alertThreshold) {
        this.generateAlert(
          tx.to,
          tx.chain,
          balanceChange,
          percentageChange,
          tx.timestamp * 1000,
          tx.hash,
          "BALANCE_SPIKE"
        );
      }
    }
  }

  /**
   * Update wallet activity tracking
   */
  private updateWalletActivity(
    address: Address,
    chain: string,
    tx: TransactionEvent,
    valueChange: bigint
  ): void {
    const key = `${chain}:${address}`;
    let activity = this.walletActivities.get(key);

    if (!activity) {
      activity = {
        address,
        chain,
        currentBalance: BigInt(0),
        balanceHistory: [],
        transactionCount: 0,
        firstSeen: tx.timestamp * 1000,
        lastSeen: tx.timestamp * 1000,
        totalIn: BigInt(0),
        totalOut: BigInt(0),
        suspiciousFlags: [],
      };
    }

    activity.transactionCount++;
    activity.lastSeen = tx.timestamp * 1000;
    activity.currentBalance = (this.walletBalances.get(key)?.balance || BigInt(0));

    if (valueChange > BigInt(0)) {
      activity.totalIn += valueChange;
    } else {
      activity.totalOut += valueChange < BigInt(0) ? -valueChange : BigInt(0);
    }

    // Add to balance history (keep last 100)
    activity.balanceHistory.push({
      timestamp: tx.timestamp * 1000,
      balance: activity.currentBalance,
    });
    if (activity.balanceHistory.length > 100) {
      activity.balanceHistory.shift();
    }

    // Detect suspicious patterns
    this.detectSuspiciousPatterns(activity, tx);

    this.walletActivities.set(key, activity);
  }

  /**
   * Detect suspicious patterns in wallet activity
   */
  private detectSuspiciousPatterns(activity: WalletActivity, tx: TransactionEvent): void {
    // Rapid large withdrawals
    if (activity.totalOut > BigInt("1000000000000000000000") && // >1000 ETH out
        activity.transactionCount < 10) {
      if (!activity.suspiciousFlags.includes("RAPID_LARGE_WITHDRAWAL")) {
        activity.suspiciousFlags.push("RAPID_LARGE_WITHDRAWAL");
        this.generateAlert(
          activity.address,
          activity.chain,
          -activity.totalOut,
          -100,
          tx.timestamp * 1000,
          tx.hash,
          "LARGE_WITHDRAWAL"
        );
      }
    }

    // Sudden large balance increase (potential insider)
    if (activity.balanceHistory.length >= 2) {
      const recent = activity.balanceHistory.slice(-2);
      const change = recent[1].balance - recent[0].balance;
      const timeDiff = recent[1].timestamp - recent[0].timestamp;

      if (change > BigInt("100000000000000000000") && // >100 ETH increase
          timeDiff < 60000) { // Within 1 minute
        if (!activity.suspiciousFlags.includes("SUDDEN_LARGE_INCREASE")) {
          activity.suspiciousFlags.push("SUDDEN_LARGE_INCREASE");
          this.generateAlert(
            activity.address,
            activity.chain,
            change,
            1000,
            tx.timestamp * 1000,
            tx.hash,
            "INSIDER_ACTIVITY"
          );
        }
      }
    }

    // Rapid movement pattern
    const recentTxs = activity.balanceHistory.slice(-10);
    if (recentTxs.length >= 5) {
      const timeSpan = recentTxs[recentTxs.length - 1].timestamp - recentTxs[0].timestamp;
      if (timeSpan < 60000) { // 5+ transactions in <1 minute
        if (!activity.suspiciousFlags.includes("RAPID_MOVEMENT")) {
          activity.suspiciousFlags.push("RAPID_MOVEMENT");
          this.generateAlert(
            activity.address,
            activity.chain,
            BigInt(0),
            0,
            tx.timestamp * 1000,
            tx.hash,
            "RAPID_MOVEMENT"
          );
        }
      }
    }
  }

  /**
   * Generate insider trading alert
   */
  private generateAlert(
    address: Address,
    chain: string,
    balanceChange: bigint,
    percentageChange: number,
    timestamp: number,
    txHash: string,
    alertType: InsiderTradingAlert["alertType"]
  ): void {
    const severity: "critical" | "warning" | "info" =
      Math.abs(percentageChange) >= 500
        ? "critical"
        : Math.abs(percentageChange) >= 200
        ? "warning"
        : "info";

    const descriptions: Record<InsiderTradingAlert["alertType"], string> = {
      BALANCE_SPIKE: `Balance ${percentageChange > 0 ? "increased" : "decreased"} by ${Math.abs(percentageChange).toFixed(2)}%`,
      SUSPICIOUS_PATTERN: "Suspicious trading pattern detected",
      INSIDER_ACTIVITY: "Potential insider trading activity - sudden large balance increase",
      LARGE_WITHDRAWAL: "Large withdrawal detected - potential exit scam",
      RAPID_MOVEMENT: "Rapid transaction pattern - potential wash trading",
    };

    const alert: InsiderTradingAlert = {
      address,
      chain,
      alertType,
      severity,
      balanceChange,
      percentageChange,
      timestamp,
      description: descriptions[alertType],
      relatedAddresses: [],
      transactionHashes: [txHash],
    };

    this.alerts.push(alert);

    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts.shift();
    }
  }

  /**
   * Get all alerts
   */
  getAlerts(limit: number = 100): InsiderTradingAlert[] {
    return this.alerts
      .sort((a, b) => {
        // Sort by severity then timestamp
        const severityOrder = { critical: 3, warning: 2, info: 1 };
        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
          return severityOrder[b.severity] - severityOrder[a.severity];
        }
        return b.timestamp - a.timestamp;
      })
      .slice(0, limit);
  }

  /**
   * Get wallet activity
   */
  getWalletActivity(address: Address, chain: string): WalletActivity | null {
    const key = `${chain}:${address}`;
    return this.walletActivities.get(key) || null;
  }

  /**
   * Get wallet balance
   */
  getWalletBalance(address: Address, chain: string): WalletBalance | null {
    const key = `${chain}:${address}`;
    return this.walletBalances.get(key) || null;
  }

  /**
   * Get all tracked wallets for a chain
   */
  getTrackedWallets(chain: string): WalletActivity[] {
    const wallets: WalletActivity[] = [];
    for (const [key, activity] of this.walletActivities.entries()) {
      if (key.startsWith(`${chain}:`)) {
        wallets.push(activity);
      }
    }
    return wallets;
  }
}

