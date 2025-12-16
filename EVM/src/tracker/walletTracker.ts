/**
 * Wallet Tracker
 * Tracks suspicious wallets and their relationships for regulatory monitoring
 */

import type { TransactionEvent } from "../listener/blockchainListener.js";
import type { TransactionAnalysis } from "../analyzer/transactionAnalyzer.js";

export interface WalletProfile {
  address: string;
  riskScore: number;
  transactionCount: number;
  totalVolume: bigint;
  firstSeen: number;
  lastSeen: number;
  chains: Set<string>;
  suspiciousFlags: string[];
  connectedWallets: Map<string, number>; // address -> transaction count
  riskHistory: Array<{ timestamp: number; riskScore: number }>;
}

export interface WalletRelationship {
  from: string;
  to: string;
  transactionCount: number;
  totalValue: bigint;
  lastInteraction: number;
  chains: Set<string>;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface SuspiciousWallet {
  address: string;
  riskScore: number;
  reason: string[];
  transactionCount: number;
  totalVolume: bigint;
  connectedAddresses: number;
  chains: string[];
  firstSeen: number;
  lastSeen: number;
}

export class WalletTracker {
  private wallets: Map<string, WalletProfile> = new Map();
  private relationships: Map<string, WalletRelationship> = new Map(); // "from-to" -> relationship
  private suspiciousThreshold = 70;

  /**
   * Track a transaction and update wallet profiles
   */
  trackTransaction(tx: TransactionEvent, analysis: TransactionAnalysis): void {
    // Update source wallet
    this.updateWallet(tx.from, tx, analysis, 'source');

    // Update destination wallet if exists
    if (tx.to) {
      this.updateWallet(tx.to, tx, analysis, 'destination');
      this.updateRelationship(tx.from, tx.to, tx);
    }
  }

  /**
   * Update wallet profile
   */
  private updateWallet(
    address: string,
    tx: TransactionEvent,
    analysis: TransactionAnalysis,
    role: 'source' | 'destination'
  ): void {
    // Normalize address to lowercase for consistent storage
    const normalizedAddress = address.toLowerCase();
    if (!this.wallets.has(normalizedAddress)) {
      this.wallets.set(address, {
        address,
        riskScore: 0,
        transactionCount: 0,
        totalVolume: BigInt(0),
        firstSeen: tx.timestamp * 1000,
        lastSeen: tx.timestamp * 1000,
        chains: new Set(),
        suspiciousFlags: [],
        connectedWallets: new Map(),
        riskHistory: [],
      });
    }

    const wallet = this.wallets.get(normalizedAddress)!;
    wallet.transactionCount++;
    wallet.totalVolume += tx.value;
    wallet.chains.add(tx.chain);
    wallet.lastSeen = Math.max(wallet.lastSeen, tx.timestamp * 1000);

    // Update risk score (weighted average)
    const currentRisk = wallet.riskScore;
    const newRisk = analysis.riskScore;
    wallet.riskScore = (currentRisk * (wallet.transactionCount - 1) + newRisk) / wallet.transactionCount;

    // Add suspicious flags
    for (const flag of analysis.anomalyFlags) {
      if (!wallet.suspiciousFlags.includes(flag)) {
        wallet.suspiciousFlags.push(flag);
      }
    }

    // Update risk history (keep last 100)
    wallet.riskHistory.push({
      timestamp: tx.timestamp * 1000,
      riskScore: analysis.riskScore,
    });
    if (wallet.riskHistory.length > 100) {
      wallet.riskHistory.shift();
    }

    // Update connected wallets
    if (role === 'source' && tx.to) {
      const count = wallet.connectedWallets.get(tx.to) || 0;
      wallet.connectedWallets.set(tx.to, count + 1);
    } else if (role === 'destination' && tx.from) {
      const count = wallet.connectedWallets.get(tx.from) || 0;
      wallet.connectedWallets.set(tx.from, count + 1);
    }
  }

  /**
   * Update relationship between two wallets
   */
  private updateRelationship(from: string, to: string, tx: TransactionEvent): void {
    const key = `${from}-${to}`;
    const reverseKey = `${to}-${from}`;

    // Check if relationship exists in either direction
    let relationship = this.relationships.get(key) || this.relationships.get(reverseKey);

    if (!relationship) {
      relationship = {
        from,
        to,
        transactionCount: 0,
        totalValue: BigInt(0),
        lastInteraction: tx.timestamp * 1000,
        chains: new Set(),
        riskLevel: 'low',
      };
      this.relationships.set(key, relationship);
    }

    relationship.transactionCount++;
    relationship.totalValue += tx.value;
    relationship.chains.add(tx.chain);
    relationship.lastInteraction = Math.max(relationship.lastInteraction, tx.timestamp * 1000);

    // Update risk level based on transaction count and value
    const valueInEth = Number(relationship.totalValue) / 1e18;
    if (relationship.transactionCount > 50 || valueInEth > 100) {
      relationship.riskLevel = 'high';
    } else if (relationship.transactionCount > 10 || valueInEth > 10) {
      relationship.riskLevel = 'medium';
    }
  }

  /**
   * Get suspicious wallets
   */
  getSuspiciousWallets(limit: number = 50): SuspiciousWallet[] {
    const suspicious: SuspiciousWallet[] = [];

    for (const wallet of this.wallets.values()) {
      if (wallet.riskScore >= this.suspiciousThreshold) {
        const reasons: string[] = [];
        
        if (wallet.riskScore >= 80) {
          reasons.push('Very High Risk Score');
        }
        if (wallet.suspiciousFlags.includes('RAPID_TRANSACTIONS')) {
          reasons.push('Rapid Transaction Pattern');
        }
        if (wallet.suspiciousFlags.includes('LARGE_VALUE')) {
          reasons.push('Large Value Transactions');
        }
        if (wallet.suspiciousFlags.includes('STRUCTURING')) {
          reasons.push('Potential Structuring');
        }
        if (wallet.connectedWallets.size > 100) {
          reasons.push('High Number of Connections');
        }
        if (wallet.chains.size > 5) {
          reasons.push('Multi-Chain Activity');
        }

        suspicious.push({
          address: wallet.address,
          riskScore: wallet.riskScore,
          reason: reasons.length > 0 ? reasons : ['High Risk Activity'],
          transactionCount: wallet.transactionCount,
          totalVolume: wallet.totalVolume,
          connectedAddresses: wallet.connectedWallets.size,
          chains: Array.from(wallet.chains),
          firstSeen: wallet.firstSeen,
          lastSeen: wallet.lastSeen,
        });
      }
    }

    return suspicious
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, limit);
  }

  /**
   * Get wallet profile
   */
  getWalletProfile(address: string): WalletProfile | null {
    return this.wallets.get(address.toLowerCase()) || null;
  }

  /**
   * Get wallet relationships
   */
  getWalletRelationships(address: string, limit: number = 20): WalletRelationship[] {
    const relationships: WalletRelationship[] = [];

    for (const rel of this.relationships.values()) {
      if (rel.from.toLowerCase() === address.toLowerCase() || 
          rel.to.toLowerCase() === address.toLowerCase()) {
        relationships.push(rel);
      }
    }

    return relationships
      .sort((a, b) => b.lastInteraction - a.lastInteraction)
      .slice(0, limit);
  }

  /**
   * Trace wallet connections (get connected wallet network)
   */
  traceWalletNetwork(address: string, depth: number = 2): {
    center: string;
    connections: Array<{
      address: string;
      riskScore: number;
      distance: number;
      relationship: WalletRelationship | null;
    }>;
  } {
    const visited = new Set<string>();
    const connections: Array<{
      address: string;
      riskScore: number;
      distance: number;
      relationship: WalletRelationship | null;
    }> = [];

    const queue: Array<{ addr: string; dist: number }> = [
      { addr: address.toLowerCase(), dist: 0 },
    ];

    while (queue.length > 0 && connections.length < 100) {
      const current = queue.shift()!;
      if (visited.has(current.addr) || current.dist > depth) continue;
      visited.add(current.addr);

      const wallet = this.wallets.get(current.addr);
      if (wallet && current.dist > 0) {
        // Find relationship
        let relationship: WalletRelationship | null = null;
        for (const rel of this.relationships.values()) {
          if (
            (rel.from.toLowerCase() === address.toLowerCase() &&
              rel.to.toLowerCase() === current.addr) ||
            (rel.to.toLowerCase() === address.toLowerCase() &&
              rel.from.toLowerCase() === current.addr)
          ) {
            relationship = rel;
            break;
          }
        }

        connections.push({
          address: current.addr,
          riskScore: wallet.riskScore,
          distance: current.dist,
          relationship,
        });
      }

      // Add connected wallets to queue
      if (wallet) {
        for (const connectedAddr of wallet.connectedWallets.keys()) {
          if (!visited.has(connectedAddr.toLowerCase())) {
            queue.push({
              addr: connectedAddr.toLowerCase(),
              dist: current.dist + 1,
            });
          }
        }
      }
    }

    return {
      center: address.toLowerCase(),
      connections,
    };
  }

  /**
   * Get wallet statistics
   */
  getStatistics(): {
    totalWallets: number;
    suspiciousWallets: number;
    totalRelationships: number;
    averageRiskScore: number;
    highRiskWallets: number;
  } {
    const wallets = Array.from(this.wallets.values());
    const suspicious = wallets.filter((w) => w.riskScore >= this.suspiciousThreshold);

    const totalRisk = wallets.reduce((sum, w) => sum + w.riskScore, 0);
    const avgRisk = wallets.length > 0 ? totalRisk / wallets.length : 0;

    return {
      totalWallets: wallets.length,
      suspiciousWallets: suspicious.length,
      totalRelationships: this.relationships.size,
      averageRiskScore: avgRisk,
      highRiskWallets: wallets.filter((w) => w.riskScore >= 80).length,
    };
  }
}

