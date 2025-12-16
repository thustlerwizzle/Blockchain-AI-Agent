/**
 * Transaction Flow Tracker
 * Tracks high-risk transactions and monitors their flow across chains
 */

import type { TransactionEvent } from "../listener/blockchainListener.js";
import type { TransactionAnalysis } from "../analyzer/transactionAnalyzer.js";

export interface TransactionFlow {
  sourceAddress: string;
  destinationAddress: string;
  chain: string;
  transactionHash: string;
  value: bigint;
  riskScore: number;
  timestamp: number;
  anomalyFlags: string[];
}

export interface FlowPath {
  path: TransactionFlow[];
  totalValue: bigint;
  averageRisk: number;
  chainsInvolved: string[];
  startTime: number;
  endTime: number;
  recommendations: string[];
}

export interface ChainAnalysis {
  chain: string;
  transactionCount: number;
  totalValue: bigint;
  averageRisk: number;
  highRiskCount: number;
  uniqueAddresses: Set<string>;
  flowPatterns: {
    incoming: number;
    outgoing: number;
    internal: number;
  };
}

export class TransactionFlowTracker {
  private highRiskTransactions: Map<string, TransactionFlow> = new Map();
  private addressGraph: Map<string, Set<string>> = new Map(); // from -> to addresses
  private chainAnalysis: Map<string, ChainAnalysis> = new Map();
  private flowPaths: FlowPath[] = [];
  private readonly HIGH_RISK_THRESHOLD = 70;

  /**
   * Track a high-risk transaction
   */
  trackTransaction(
    tx: TransactionEvent,
    analysis: TransactionAnalysis
  ): void {
    if (analysis.riskScore >= this.HIGH_RISK_THRESHOLD) {
      const flow: TransactionFlow = {
        sourceAddress: tx.from,
        destinationAddress: tx.to || "CONTRACT_CREATION",
        chain: tx.chain,
        transactionHash: tx.hash,
        value: tx.value,
        riskScore: analysis.riskScore,
        timestamp: tx.timestamp * 1000,
        anomalyFlags: Array.isArray(analysis.anomalyFlags) 
          ? analysis.anomalyFlags 
          : (typeof analysis.anomalyFlags === 'string' 
              ? (analysis.anomalyFlags as string).split(' ').filter((f: string) => f.length > 0) 
              : []),
      };

      this.highRiskTransactions.set(tx.hash, flow);

      // Update address graph
      if (tx.to) {
        if (!this.addressGraph.has(tx.from)) {
          this.addressGraph.set(tx.from, new Set());
        }
        this.addressGraph.get(tx.from)!.add(tx.to);
      }

      // Update chain analysis
      this.updateChainAnalysis(tx, analysis);

      // Build flow paths
      this.buildFlowPaths(tx.from, tx.to || "");
    }
  }

  /**
   * Update chain analysis for a transaction
   */
  private updateChainAnalysis(
    tx: TransactionEvent,
    analysis: TransactionAnalysis
  ): void {
    if (!this.chainAnalysis.has(tx.chain)) {
      this.chainAnalysis.set(tx.chain, {
        chain: tx.chain,
        transactionCount: 0,
        totalValue: BigInt(0),
        averageRisk: 0,
        highRiskCount: 0,
        uniqueAddresses: new Set(),
        flowPatterns: {
          incoming: 0,
          outgoing: 0,
          internal: 0,
        },
      });
    }

    const analysisData = this.chainAnalysis.get(tx.chain)!;
    analysisData.transactionCount++;
    analysisData.totalValue += tx.value;
    analysisData.uniqueAddresses.add(tx.from);
    if (tx.to) {
      analysisData.uniqueAddresses.add(tx.to);
    }

    // Update average risk
    const totalRisk =
      analysisData.averageRisk * (analysisData.transactionCount - 1) +
      analysis.riskScore;
    analysisData.averageRisk = totalRisk / analysisData.transactionCount;

    if (analysis.riskScore >= this.HIGH_RISK_THRESHOLD) {
      analysisData.highRiskCount++;
    }
  }

  /**
   * Build flow paths from an address
   */
  private buildFlowPaths(from: string, to: string): void {
    const visited = new Set<string>();
    const path: TransactionFlow[] = [];
    const startTime = Date.now();

    this.traverseFlow(from, to, visited, path, startTime);
  }

  /**
   * Traverse transaction flow graph
   */
  private traverseFlow(
    current: string,
    target: string,
    visited: Set<string>,
    path: TransactionFlow[],
    startTime: number
  ): void {
    if (visited.has(current)) return;
    visited.add(current);

    const relatedTxs = Array.from(this.highRiskTransactions.values()).filter(
      (flow) => flow.sourceAddress === current || flow.destinationAddress === current
    );

    for (const flow of relatedTxs) {
      if (!path.find((p) => p.transactionHash === flow.transactionHash)) {
        path.push(flow);

        if (flow.destinationAddress === target || path.length >= 10) {
          // Complete path found or max depth reached
          const chainsInvolved = [
            ...new Set(path.map((p) => p.chain)),
          ];
          const totalValue = path.reduce(
            (sum, p) => sum + p.value,
            BigInt(0)
          );
          const averageRisk =
            path.reduce((sum, p) => sum + p.riskScore, 0) / path.length;

          const flowPath: FlowPath = {
            path: [...path],
            totalValue,
            averageRisk,
            chainsInvolved,
            startTime,
            endTime: Date.now(),
            recommendations: this.generateFlowRecommendations(
              path,
              chainsInvolved,
              totalValue
            ),
          };

          this.flowPaths.push(flowPath);
          return;
        }

        // Continue traversal
        if (flow.destinationAddress !== "CONTRACT_CREATION") {
          this.traverseFlow(
            flow.destinationAddress,
            target,
            visited,
            path,
            startTime
          );
        }
      }
    }
  }

  /**
   * Generate recommendations based on flow analysis
   */
  private generateFlowRecommendations(
    path: TransactionFlow[],
    chainsInvolved: string[],
    totalValue: bigint
  ): string[] {
    const recommendations: string[] = [];

    // Multi-chain analysis
    if (chainsInvolved.length > 1) {
      recommendations.push(
        `🚨 Multi-chain flow detected across ${chainsInvolved.length} chains: ${chainsInvolved.join(", ")}. Consider enhanced cross-chain monitoring.`
      );
    }

    // Large value analysis
    const valueInEth = Number(totalValue) / 1e18;
    if (valueInEth > 100) {
      recommendations.push(
        `💰 Large value flow detected: ${valueInEth.toFixed(2)} ETH. Verify source of funds and destination legitimacy.`
      );
    }

    // Rapid movement
    if (path.length > 5) {
      recommendations.push(
        `⚡ Rapid transaction chain detected (${path.length} transactions). Potential structuring or layering activity.`
      );
    }

    // High-risk concentration
    const highRiskCount = path.filter((p) => p.riskScore >= 80).length;
    if (highRiskCount > 2) {
      recommendations.push(
        `🔴 Multiple high-risk transactions in flow (${highRiskCount}). Immediate investigation recommended.`
      );
    }

    // Anomaly flags
    const allFlags = new Set(
      path.flatMap((p) => p.anomalyFlags)
    );
    if (allFlags.has("RAPID_TRANSACTIONS")) {
      recommendations.push(
        `⏱️ Rapid transaction pattern detected. Monitor for structuring behavior.`
      );
    }
    if (allFlags.has("LARGE_VALUE")) {
      recommendations.push(
        `💵 Large value transactions detected. Verify AML compliance.`
      );
    }

    // Chain-specific recommendations
    if (chainsInvolved.includes("ethereum")) {
      recommendations.push(
        `🔗 Ethereum mainnet involved. Check for known scam addresses or sanctioned entities.`
      );
    }
    if (chainsInvolved.includes("tornado-cash") || chainsInvolved.some(c => c.toLowerCase().includes("mixer"))) {
      recommendations.push(
        `🌪️ Potential mixer/privacy protocol usage detected. Enhanced due diligence required.`
      );
    }

    // Default recommendation
    if (recommendations.length === 0) {
      recommendations.push(
        `📊 Monitor this flow pattern for unusual activity.`
      );
    }

    return recommendations;
  }

  /**
   * Get all high-risk transactions
   */
  getHighRiskTransactions(limit: number = 50): TransactionFlow[] {
    return Array.from(this.highRiskTransactions.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get chain analysis
   */
  getChainAnalysis(): ChainAnalysis[] {
    return Array.from(this.chainAnalysis.values()).map((analysis) => ({
      ...analysis,
      uniqueAddresses: analysis.uniqueAddresses, // Keep as Set for now
    }));
  }

  /**
   * Get flow paths
   */
  getFlowPaths(limit: number = 20): FlowPath[] {
    return this.flowPaths
      .sort((a, b) => b.endTime - a.endTime)
      .slice(0, limit);
  }

  /**
   * Get flow analysis for a specific address
   */
  getAddressFlow(address: string): {
    incoming: TransactionFlow[];
    outgoing: TransactionFlow[];
    totalIncoming: bigint;
    totalOutgoing: bigint;
    chains: string[];
  } {
    const allFlows = Array.from(this.highRiskTransactions.values());
    const incoming = allFlows.filter(
      (f) => f.destinationAddress.toLowerCase() === address.toLowerCase()
    );
    const outgoing = allFlows.filter(
      (f) => f.sourceAddress.toLowerCase() === address.toLowerCase()
    );

    return {
      incoming,
      outgoing,
      totalIncoming: incoming.reduce((sum, f) => sum + f.value, BigInt(0)),
      totalOutgoing: outgoing.reduce((sum, f) => sum + f.value, BigInt(0)),
      chains: [
        ...new Set([...incoming, ...outgoing].map((f) => f.chain)),
      ],
    };
  }

  /**
   * Get recommendations for high-risk transactions
   */
  getRecommendations(): string[] {
    const allRecommendations = new Set<string>();
    
    for (const path of this.flowPaths) {
      for (const rec of path.recommendations) {
        allRecommendations.add(rec);
      }
    }

    return Array.from(allRecommendations);
  }
}

