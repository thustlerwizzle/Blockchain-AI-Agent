import type { TransactionAnalysis } from "../analyzer/transactionAnalyzer.js";
import type { TransactionEvent } from "../listener/blockchainListener.js";
import type { DABAComplianceStatus } from "./dabaCompliance.js";

export interface RegulatoryMetrics {
  overallRiskScore: number;
  financialHealth: FinancialHealth;
  complianceStatus: ComplianceStatus;
  riskBreakdown: RiskBreakdown;
  transactionVolume: TransactionVolume;
  suspiciousActivity: SuspiciousActivity;
  recommendations: string[];
  dabaCompliance?: DABAComplianceStatus; // Bermuda DABA compliance
  multiChainData: {
    chain: string;
    transactionCount: number;
    volume: bigint;
    riskScore: number;
  }[];
}

export interface FinancialHealth {
  score: number; // 0-100
  status: "healthy" | "moderate" | "at_risk" | "critical";
  indicators: {
    totalVolume: bigint;
    averageTransactionSize: bigint;
    largeTransactionCount: number;
    velocity: number; // transactions per hour
    balanceStability: number;
  };
}

export interface ComplianceStatus {
  amlCompliance: number; // 0-100
  kycCompliance: number; // 0-100
  regulatoryFlags: string[];
  violations: ComplianceViolation[];
}

export interface ComplianceViolation {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  timestamp: number;
  transactionHash?: string;
}

export interface RiskBreakdown {
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  riskDistribution: {
    category: string;
    count: number;
    percentage: number;
  }[];
}

export interface TransactionVolume {
  total: bigint;
  last24h: bigint;
  last7d: bigint;
  last30d: bigint;
  trend: "increasing" | "decreasing" | "stable";
  growthRate: number; // percentage
}

export interface SuspiciousActivity {
  totalFlagged: number;
  highPriority: number;
  patterns: {
    type: string;
    count: number;
    description: string;
  }[];
  recentAlerts: {
    timestamp: number;
    type: string;
    severity: string;
    description: string;
  }[];
}

export class RegulatoryMetricsCalculator {
  private transactionHistory: TransactionEvent[] = [];
  private analysisHistory: TransactionAnalysis[] = [];
  private readonly maxHistorySize = 10000;
  private dabaCompliance?: any; // Will be set from outside

  /**
   * Add transaction and analysis to history
   */
  addTransaction(tx: TransactionEvent, analysis: TransactionAnalysis): void {
    this.transactionHistory.push(tx);
    this.analysisHistory.push(analysis);

    // Keep history limited
    if (this.transactionHistory.length > this.maxHistorySize) {
      this.transactionHistory.shift();
      this.analysisHistory.shift();
    }
  }

  /**
   * Calculate comprehensive regulatory metrics
   */
  calculateMetrics(): RegulatoryMetrics {
    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;
    const last7d = now - 7 * 24 * 60 * 60 * 1000;
    const last30d = now - 30 * 24 * 60 * 60 * 1000;

    // Filter recent transactions
    const recent24h = this.transactionHistory.filter(
      (tx) => tx.timestamp * 1000 >= last24h
    );
    const recent7d = this.transactionHistory.filter(
      (tx) => tx.timestamp * 1000 >= last7d
    );
    const recent30d = this.transactionHistory.filter(
      (tx) => tx.timestamp * 1000 >= last30d
    );

    const recentAnalyses24h = this.analysisHistory.slice(-recent24h.length);

    // Calculate metrics
    const financialHealth = this.calculateFinancialHealth(recent24h, recent7d);
    const complianceStatus = this.calculateComplianceStatus(recentAnalyses24h);
    const riskBreakdown = this.calculateRiskBreakdown(recentAnalyses24h);
    const transactionVolume = this.calculateTransactionVolume(
      recent24h,
      recent7d,
      recent30d
    );
    const suspiciousActivity = this.calculateSuspiciousActivity(
      recentAnalyses24h
    );

    // Overall risk score (weighted average)
    const overallRiskScore = this.calculateOverallRiskScore(
      riskBreakdown,
      complianceStatus,
      suspiciousActivity
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      financialHealth,
      complianceStatus,
      riskBreakdown,
      suspiciousActivity
    );

    // Multi-chain data breakdown
    const chainMap = new Map<string, { count: number; volume: bigint; riskSum: number }>();
    for (let i = 0; i < this.transactionHistory.length; i++) {
      const tx = this.transactionHistory[i];
      const analysis = this.analysisHistory[i];
      if (!chainMap.has(tx.chain)) {
        chainMap.set(tx.chain, { count: 0, volume: BigInt(0), riskSum: 0 });
      }
      const chainData = chainMap.get(tx.chain)!;
      chainData.count++;
      chainData.volume += tx.value;
      chainData.riskSum += analysis.riskScore;
    }

    const multiChainData = Array.from(chainMap.entries()).map(([chain, data]) => ({
      chain,
      transactionCount: data.count,
      volume: data.volume,
      riskScore: data.count > 0 ? data.riskSum / data.count : 0,
    }));

    return {
      overallRiskScore,
      financialHealth,
      complianceStatus,
      riskBreakdown,
      transactionVolume,
      suspiciousActivity,
      recommendations,
      dabaCompliance: this.dabaCompliance?.calculateComplianceStatus(),
      multiChainData,
    };
  }

  /**
   * Set DABA compliance checker
   */
  setDABACompliance(checker: any): void {
    this.dabaCompliance = checker;
  }

  private calculateFinancialHealth(
    recent24h: TransactionEvent[],
    recent7d: TransactionEvent[]
  ): FinancialHealth {
    const totalVolume = recent24h.reduce(
      (sum, tx) => sum + tx.value,
      BigInt(0)
    );
    const avgTxSize =
      recent24h.length > 0
        ? totalVolume / BigInt(recent24h.length)
        : BigInt(0);

    const largeTxThreshold = BigInt("1000000000000000000"); // 1 ETH
    const largeTxCount = recent24h.filter(
      (tx) => tx.value > largeTxThreshold
    ).length;

    const velocity = recent24h.length / 24; // per hour

    // Calculate balance stability (variance in transaction sizes)
    const sizes = recent24h.map((tx) => Number(tx.value));
    const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    const variance =
      sizes.reduce((sum, size) => sum + Math.pow(size - mean, 2), 0) /
      sizes.length;
    const stability = Math.max(0, 100 - Math.min(100, variance / mean));

    // Financial health score
    let score = 100;
    if (largeTxCount > 10) score -= 20;
    if (velocity > 100) score -= 15;
    if (stability < 50) score -= 25;
    if (Number(totalVolume) > 1e20) score -= 10;

    score = Math.max(0, Math.min(100, score));

    let status: FinancialHealth["status"];
    if (score >= 80) status = "healthy";
    else if (score >= 60) status = "moderate";
    else if (score >= 40) status = "at_risk";
    else status = "critical";

    return {
      score,
      status,
      indicators: {
        totalVolume,
        averageTransactionSize: avgTxSize,
        largeTransactionCount: largeTxCount,
        velocity,
        balanceStability: stability,
      },
    };
  }

  private calculateComplianceStatus(
    analyses: TransactionAnalysis[]
  ): ComplianceStatus {
    const suspiciousCount = analyses.filter((a) => a.suspicious).length;
    const totalCount = analyses.length;

    // AML Compliance (based on suspicious transaction detection)
    const amlCompliance =
      totalCount > 0
        ? Math.max(0, 100 - (suspiciousCount / totalCount) * 100)
        : 100;

    // KYC Compliance (based on new address detection)
    const newAddressCount = analyses.filter((a) =>
      a.anomalyFlags.includes("NEW_ADDRESS")
    ).length;
    const kycCompliance =
      totalCount > 0
        ? Math.max(0, 100 - (newAddressCount / totalCount) * 50)
        : 100;

    const regulatoryFlags: string[] = [];
    const violations: ComplianceViolation[] = [];

    if (amlCompliance < 70) {
      regulatoryFlags.push("AML_CONCERN");
      violations.push({
        type: "AML",
        severity: amlCompliance < 50 ? "high" : "medium",
        description: `High rate of suspicious transactions detected (${suspiciousCount}/${totalCount})`,
        timestamp: Date.now(),
      });
    }

    if (kycCompliance < 70) {
      regulatoryFlags.push("KYC_CONCERN");
      violations.push({
        type: "KYC",
        severity: kycCompliance < 50 ? "high" : "medium",
        description: `High rate of new/unverified addresses (${newAddressCount}/${totalCount})`,
        timestamp: Date.now(),
      });
    }

    // Check for rapid transactions (potential structuring)
    const rapidTxCount = analyses.filter((a) =>
      a.anomalyFlags.includes("RAPID_TRANSACTIONS")
    ).length;
    if (rapidTxCount > 5) {
      regulatoryFlags.push("STRUCTURING_SUSPICION");
      violations.push({
        type: "STRUCTURING",
        severity: "high",
        description: `Multiple rapid transaction patterns detected (${rapidTxCount} instances)`,
        timestamp: Date.now(),
      });
    }

    return {
      amlCompliance,
      kycCompliance,
      regulatoryFlags,
      violations,
    };
  }

  private calculateRiskBreakdown(
    analyses: TransactionAnalysis[]
  ): RiskBreakdown {
    const highRisk = analyses.filter((a) => a.riskScore >= 70).length;
    const mediumRisk = analyses.filter(
      (a) => a.riskScore >= 40 && a.riskScore < 70
    ).length;
    const lowRisk = analyses.filter((a) => a.riskScore < 40).length;

    const total = analyses.length;
    const categoryMap = new Map<string, number>();

    for (const analysis of analyses) {
      const category = analysis.category;
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    }

    const riskDistribution = Array.from(categoryMap.entries()).map(
      ([category, count]) => ({
        category,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      })
    );

    return {
      highRisk,
      mediumRisk,
      lowRisk,
      riskDistribution,
    };
  }

  private calculateTransactionVolume(
    recent24h: TransactionEvent[],
    recent7d: TransactionEvent[],
    recent30d: TransactionEvent[]
  ): TransactionVolume {
    const total24h = recent24h.reduce((sum, tx) => sum + tx.value, BigInt(0));
    const total7d = recent7d.reduce((sum, tx) => sum + tx.value, BigInt(0));
    const total30d = recent30d.reduce((sum, tx) => sum + tx.value, BigInt(0));
    const total = this.transactionHistory.reduce(
      (sum, tx) => sum + tx.value,
      BigInt(0)
    );

    // Calculate trend (compare 24h to 7d average)
    const avg7d = total7d / BigInt(7);
    const trend =
      total24h > avg7d
        ? "increasing"
        : total24h < avg7d
        ? "decreasing"
        : "stable";

    const growthRate =
      Number(avg7d) > 0
        ? ((Number(total24h) - Number(avg7d)) / Number(avg7d)) * 100
        : 0;

    return {
      total,
      last24h: total24h,
      last7d: total7d,
      last30d: total30d,
      trend,
      growthRate,
    };
  }

  private calculateSuspiciousActivity(
    analyses: TransactionAnalysis[]
  ): SuspiciousActivity {
    const flagged = analyses.filter((a) => a.suspicious);
    const highPriority = flagged.filter((a) => a.riskScore >= 80).length;

    const patternMap = new Map<string, number>();
    for (const analysis of flagged) {
      for (const flag of analysis.anomalyFlags) {
        patternMap.set(flag, (patternMap.get(flag) || 0) + 1);
      }
    }

    const patterns = Array.from(patternMap.entries())
      .map(([type, count]) => ({
        type,
        count,
        description: this.getPatternDescription(type),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const recentAlerts = flagged
      .slice(-10)
      .reverse()
      .map((analysis, idx) => ({
        timestamp: Date.now() - idx * 1000,
        type: analysis.anomalyFlags[0] || "UNKNOWN",
        severity:
          analysis.riskScore >= 80
            ? "high"
            : analysis.riskScore >= 50
            ? "medium"
            : "low",
        description: analysis.summary,
      }));

    return {
      totalFlagged: flagged.length,
      highPriority,
      patterns,
      recentAlerts,
    };
  }

  private getPatternDescription(type: string): string {
    const descriptions: Record<string, string> = {
      LARGE_VALUE: "Unusually large transaction amounts",
      RAPID_TRANSACTIONS: "Rapid succession of transactions",
      NEW_ADDRESS: "Transactions involving new addresses",
      CONTRACT_INTERACTION: "Smart contract interactions",
      CONTRACT_CREATION: "New contract deployments",
    };
    return descriptions[type] || type;
  }

  private calculateOverallRiskScore(
    riskBreakdown: RiskBreakdown,
    compliance: ComplianceStatus,
    suspicious: SuspiciousActivity
  ): number {
    const total = riskBreakdown.highRisk + riskBreakdown.mediumRisk + riskBreakdown.lowRisk;
    const highRiskRatio = total > 0 ? riskBreakdown.highRisk / total : 0;
    const complianceScore = (compliance.amlCompliance + compliance.kycCompliance) / 2;
    const suspiciousRatio = total > 0 ? suspicious.totalFlagged / total : 0;

    // Weighted calculation
    const riskScore = highRiskRatio * 100;
    const complianceFactor = (100 - complianceScore) * 0.3;
    const suspiciousFactor = suspiciousRatio * 100 * 0.2;

    return Math.min(100, riskScore + complianceFactor + suspiciousFactor);
  }

  private generateRecommendations(
    financial: FinancialHealth,
    compliance: ComplianceStatus,
    risk: RiskBreakdown,
    suspicious: SuspiciousActivity
  ): string[] {
    const recommendations: string[] = [];

    if (financial.status === "at_risk" || financial.status === "critical") {
      recommendations.push(
        `⚠️ Financial Health Alert: System is ${financial.status}. Review transaction patterns and velocity.`
      );
    }

    if (compliance.amlCompliance < 70) {
      recommendations.push(
        `🔍 AML Compliance: Enhanced monitoring required. ${compliance.violations.length} violations detected.`
      );
    }

    if (compliance.kycCompliance < 70) {
      recommendations.push(
        `👤 KYC Compliance: Review address verification processes. High number of new addresses detected.`
      );
    }

    if (risk.highRisk > risk.mediumRisk + risk.lowRisk) {
      recommendations.push(
        `🚨 Risk Management: High-risk transactions exceed safe threshold. Consider implementing additional controls.`
      );
    }

    if (suspicious.highPriority > 5) {
      recommendations.push(
        `🚩 Suspicious Activity: ${suspicious.highPriority} high-priority alerts require immediate review.`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push("✅ All systems operating within acceptable parameters.");
    }

    return recommendations;
  }
}

