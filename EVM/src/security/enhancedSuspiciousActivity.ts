/**
 * Enhanced Suspicious Activity Tracking
 * Provides detailed information about flagged addresses and their activities
 */

import type { Address } from "viem";
import type { InsiderTradingAlert } from "./insiderTradingDetector.js";
import type { RugpullRiskScore } from "./onChainChecks.js";

export interface SuspiciousActivityDetail {
  address: Address;
  chain: string;
  activityType: string;
  riskScore: number;
  flags: string[];
  description: string;
  firstDetected: number;
  lastDetected: number;
  transactionCount: number;
  totalVolume: bigint;
  relatedAddresses: Address[];
  transactionHashes: string[];
  alerts: Array<{
    type: string;
    severity: "critical" | "warning" | "info";
    timestamp: number;
    description: string;
  }>;
}

export interface SuspiciousActivityReport {
  totalFlagged: number;
  highPriority: number;
  mediumPriority: number;
  lowPriority: number;
  flaggedAddresses: SuspiciousActivityDetail[];
  activitiesByType: Map<string, SuspiciousActivityDetail[]>;
  chains: Map<string, number>; // chain -> count
  riskDistribution: {
    critical: number; // >= 80
    high: number; // 70-79
    medium: number; // 40-69
    low: number; // < 40
  };
}

export class EnhancedSuspiciousActivityTracker {
  private flaggedActivities: Map<string, SuspiciousActivityDetail> = new Map(); // "chain:address" -> detail
  private alerts: Map<string, InsiderTradingAlert[]> = new Map(); // "chain:address" -> alerts

  /**
   * Add suspicious activity from transaction analysis
   */
  addSuspiciousActivity(
    address: Address,
    chain: string,
    activityType: string,
    riskScore: number,
    flags: string[],
    description: string,
    txHash: string,
    volume: bigint,
    relatedAddresses: Address[] = []
  ): void {
    const key = `${chain}:${address}`;
    let detail = this.flaggedActivities.get(key);

    if (!detail) {
      detail = {
        address,
        chain,
        activityType,
        riskScore,
        flags: [],
        description,
        firstDetected: Date.now(),
        lastDetected: Date.now(),
        transactionCount: 0,
        totalVolume: BigInt(0),
        relatedAddresses: [],
        transactionHashes: [],
        alerts: [],
      };
    }

    // Update detail
    detail.lastDetected = Date.now();
    detail.transactionCount++;
    detail.totalVolume += volume;
    
    // Merge flags
    for (const flag of flags) {
      if (!detail.flags.includes(flag)) {
        detail.flags.push(flag);
      }
    }

    // Update risk score (use maximum)
    if (riskScore > detail.riskScore) {
      detail.riskScore = riskScore;
    }

    // Add related addresses
    for (const addr of relatedAddresses) {
      if (!detail.relatedAddresses.find(a => a.toLowerCase() === addr.toLowerCase())) {
        detail.relatedAddresses.push(addr);
      }
    }

    // Add transaction hash
    if (!detail.transactionHashes.includes(txHash)) {
      detail.transactionHashes.push(txHash);
    }

    // Add alert
    const severity: "critical" | "warning" | "info" =
      riskScore >= 80
        ? "critical"
        : riskScore >= 70
        ? "warning"
        : "info";

    detail.alerts.push({
      type: activityType,
      severity,
      timestamp: Date.now(),
      description,
    });

    // Keep only last 50 alerts per address
    if (detail.alerts.length > 50) {
      detail.alerts.shift();
    }

    this.flaggedActivities.set(key, detail);
  }

  /**
   * Add insider trading alert
   */
  addInsiderAlert(address: Address, chain: string, alert: InsiderTradingAlert): void {
    const key = `${chain}:${address}`;
    const alerts = this.alerts.get(key) || [];
    alerts.push(alert);
    this.alerts.set(key, alerts);

    // Also add to flagged activities
    this.addSuspiciousActivity(
      address,
      chain,
      alert.alertType,
      alert.severity === "critical" ? 85 : alert.severity === "warning" ? 75 : 65,
      [alert.alertType],
      alert.description,
      alert.transactionHashes[0] || "",
      BigInt(Math.abs(Number(alert.balanceChange))),
      alert.relatedAddresses
    );
  }

  /**
   * Add rugpull risk alert
   */
  addRugpullAlert(
    address: Address,
    chain: string,
    riskScore: RugpullRiskScore,
    tokenAddress: Address,
    txHash: string
  ): void {
    this.addSuspiciousActivity(
      tokenAddress,
      chain,
      "RUGPULL_RISK",
      riskScore.totalScore,
      riskScore.flags,
      riskScore.recommendations.join("; "),
      txHash,
      BigInt(0),
      [address]
    );
  }

  /**
   * Generate comprehensive suspicious activity report
   */
  generateReport(): SuspiciousActivityReport {
    const flaggedAddresses = Array.from(this.flaggedActivities.values());
    const highPriority = flaggedAddresses.filter(a => a.riskScore >= 80).length;
    const mediumPriority = flaggedAddresses.filter(a => a.riskScore >= 70 && a.riskScore < 80).length;
    const lowPriority = flaggedAddresses.filter(a => a.riskScore < 70).length;

    // Group by activity type
    const activitiesByType = new Map<string, SuspiciousActivityDetail[]>();
    for (const detail of flaggedAddresses) {
      if (!activitiesByType.has(detail.activityType)) {
        activitiesByType.set(detail.activityType, []);
      }
      activitiesByType.get(detail.activityType)!.push(detail);
    }

    // Count by chain
    const chains = new Map<string, number>();
    for (const detail of flaggedAddresses) {
      chains.set(detail.chain, (chains.get(detail.chain) || 0) + 1);
    }

    // Risk distribution
    const riskDistribution = {
      critical: flaggedAddresses.filter(a => a.riskScore >= 80).length,
      high: flaggedAddresses.filter(a => a.riskScore >= 70 && a.riskScore < 80).length,
      medium: flaggedAddresses.filter(a => a.riskScore >= 40 && a.riskScore < 70).length,
      low: flaggedAddresses.filter(a => a.riskScore < 40).length,
    };

    return {
      totalFlagged: flaggedAddresses.length,
      highPriority,
      mediumPriority,
      lowPriority,
      flaggedAddresses: flaggedAddresses.sort((a, b) => b.riskScore - a.riskScore),
      activitiesByType,
      chains,
      riskDistribution,
    };
  }

  /**
   * Get flagged addresses for a specific chain
   */
  getFlaggedAddressesForChain(chain: string, limit: number = 100): SuspiciousActivityDetail[] {
    return Array.from(this.flaggedActivities.values())
      .filter(detail => detail.chain === chain)
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, limit);
  }

  /**
   * Get flagged addresses by activity type
   */
  getFlaggedAddressesByType(activityType: string, limit: number = 100): SuspiciousActivityDetail[] {
    return Array.from(this.flaggedActivities.values())
      .filter(detail => detail.activityType === activityType)
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, limit);
  }

  /**
   * Get detail for specific address
   */
  getAddressDetail(address: Address, chain: string): SuspiciousActivityDetail | null {
    const key = `${chain}:${address}`;
    return this.flaggedActivities.get(key) || null;
  }
}

