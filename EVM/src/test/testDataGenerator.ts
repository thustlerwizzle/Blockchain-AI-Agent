/**
 * Test Data Generator
 * Generates sample transaction data for testing when real blockchain data is not available
 */

import type { TransactionEvent } from "../listener/blockchainListener.js";
import type { Address } from "viem";

export function generateTestTransaction(chain: string = "ethereum", riskLevel: "low" | "medium" | "high" = "low"): TransactionEvent {
  const randomHash = `0x${Array.from({ length: 64 }, () => 
    Math.floor(Math.random() * 16).toString(16)
  ).join('')}`;
  
  const randomAddress = (): Address => {
    return `0x${Array.from({ length: 40 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('')}` as Address;
  };

  // Generate value based on risk level to ensure varied risk scores
  let value: bigint;
  let isContractCreation: boolean;
  let hasData: boolean;
  
  switch (riskLevel) {
    case "high":
      // High-risk: Ensure risk score >= 70
      // Use VERY large values (>1000 ETH = +30) OR large values (>100 ETH = +20) + contract creation (+15) + data (+10)
      // Pattern analysis adds 5-25 more, ensuring >= 70
      const useVeryLarge = Math.random() > 0.3; // 70% use very large values
      if (useVeryLarge) {
        value = BigInt(Math.floor(Math.random() * 500000000000000000000) + 1000000000000000000000); // 1000-1500 ETH (+30 risk)
      } else {
        value = BigInt(Math.floor(Math.random() * 200000000000000000000) + 200000000000000000000); // 200-400 ETH (+20 risk)
      }
      isContractCreation = Math.random() > 0.3; // 70% contract creation (+15 risk)
      hasData = true; // Always has data (+10 risk)
      // Total: 30+15+10 = 55 base, or 20+15+10 = 45 base, pattern adds 25+ = guaranteed >= 70
      break;
    case "medium":
      // Medium-risk: Moderate values (10-100 ETH)
      value = BigInt(Math.floor(Math.random() * 90000000000000000000) + 10000000000000000000); // 10-100 ETH
      isContractCreation = Math.random() > 0.8; // 20% contract creation
      hasData = Math.random() > 0.3; // 70% has data
      break;
    default: // low
      // Low-risk: Small values (<10 ETH)
      value = BigInt(Math.floor(Math.random() * 10000000000000000000)); // 0-10 ETH
      isContractCreation = Math.random() > 0.95; // 5% contract creation
      hasData = Math.random() > 0.6; // 40% has data
      break;
  }

  return {
    hash: randomHash,
    from: randomAddress(),
    to: isContractCreation ? null : randomAddress(),
    value,
    blockNumber: BigInt(Math.floor(Math.random() * 10000000) + 18000000),
    timestamp: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 3600),
    chain,
    data: hasData ? `0x${Array.from({ length: 100 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('')}` as `0x${string}` : undefined,
  };
}

export function generateTestTransactions(count: number, chain: string = "ethereum"): TransactionEvent[] {
  return Array.from({ length: count }, () => generateTestTransaction(chain));
}

