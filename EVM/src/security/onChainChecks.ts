/**
 * On-Chain Security Checks
 * Based on rugpull-scam-token-detection patterns
 * Detects risky token contracts, liquidity issues, and rugpull indicators
 */

import { createPublicClient, http, type Address, type PublicClient } from "viem";
import type { Chain } from "viem/chains";

export interface TokenCheckResult {
  mintAuthorityActive: boolean;
  freezeAuthorityActive: boolean;
  decimals: number;
  supply: bigint;
  liquidityLocked: boolean;
  initialLiquidity: bigint;
  riskScore: number;
  flags: string[];
  description: string;
}

export interface LiquidityCheckResult {
  isLocked: boolean;
  lockDuration?: number;
  lockOwner?: Address;
  totalLiquidity: bigint;
  liquidityProvider?: Address;
  riskScore: number;
  flags: string[];
}

export interface RugpullRiskScore {
  totalScore: number; // 0-100
  mintAuthority: number;
  freezeAuthority: number;
  liquidity: number;
  decimals: number;
  flags: string[];
  recommendations: string[];
}

export class OnChainSecurityChecker {
  private clients: Map<string, PublicClient> = new Map();

  constructor(chains: Array<{ name: string; chain: Chain; rpcUrl?: string }>) {
    for (const chainConfig of chains) {
      this.clients.set(
        chainConfig.name,
        createPublicClient({
          chain: chainConfig.chain,
          transport: http(chainConfig.rpcUrl),
        })
      );
    }
  }

  /**
   * Check token contract for rugpull indicators
   * Based on rugpull-scam-token-detection heuristics
   */
  async checkToken(
    chainName: string,
    tokenAddress: Address
  ): Promise<TokenCheckResult> {
    const client = this.clients.get(chainName);
    if (!client) {
      throw new Error(`No client found for chain: ${chainName}`);
    }

    const flags: string[] = [];
    let riskScore = 0;

    try {
      // ERC-20 Token checks
      // Check if contract is a token
      const tokenAbi = [
        {
          constant: true,
          inputs: [],
          name: "decimals",
          outputs: [{ name: "", type: "uint8" }],
          type: "function",
        },
        {
          constant: true,
          inputs: [],
          name: "totalSupply",
          outputs: [{ name: "", type: "uint256" }],
          type: "function",
        },
        {
          constant: true,
          inputs: [],
          name: "owner",
          outputs: [{ name: "", type: "address" }],
          type: "function",
        },
      ] as const;

      let decimals = 18;
      let supply = BigInt(0);
      let mintAuthorityActive = false;
      let freezeAuthorityActive = false;

      try {
        decimals = await client.readContract({
          address: tokenAddress,
          abi: tokenAbi,
          functionName: "decimals",
        }) as number;

        supply = await client.readContract({
          address: tokenAddress,
          abi: tokenAbi,
          functionName: "totalSupply",
        }) as bigint;

        // Check for owner/mint authority
        try {
          const owner = await client.readContract({
            address: tokenAddress,
            abi: tokenAbi,
            functionName: "owner",
          }) as Address;
          if (owner && owner !== "0x0000000000000000000000000000000000000000") {
            mintAuthorityActive = true;
            flags.push("MINT_AUTHORITY_ACTIVE");
            riskScore += 30;
          }
        } catch {
          // Owner function may not exist, check for other mint functions
        }
      } catch (error) {
        flags.push("CONTRACT_READ_ERROR");
      }

      // Check for unusual decimals
      if (decimals !== 18 && decimals !== 9 && decimals !== 6) {
        flags.push("UNCOMMON_DECIMALS");
        riskScore += 5;
      }

      // Simulate liquidity check (would need DEX-specific integration)
      const liquidityCheck = await this.checkLiquidity(chainName, tokenAddress);
      let liquidityLocked = liquidityCheck.isLocked;
      let initialLiquidity = liquidityCheck.totalLiquidity;

      if (!liquidityLocked) {
        flags.push("LIQUIDITY_NOT_LOCKED");
        riskScore += 20;
      }

      const liquidityInEth = Number(initialLiquidity) / 1e18;
      if (liquidityInEth < 5) {
        flags.push("LOW_INITIAL_LIQUIDITY");
        riskScore += 15;
      }

      return {
        mintAuthorityActive,
        freezeAuthorityActive,
        decimals,
        supply,
        liquidityLocked,
        initialLiquidity,
        riskScore: Math.min(100, riskScore),
        flags,
        description: this.generateDescription(flags, riskScore),
      };
    } catch (error) {
      return {
        mintAuthorityActive: false,
        freezeAuthorityActive: false,
        decimals: 18,
        supply: BigInt(0),
        liquidityLocked: false,
        initialLiquidity: BigInt(0),
        riskScore: 100, // High risk if we can't check
        flags: ["CHECK_FAILED"],
        description: `Failed to check token: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Check liquidity pool status
   */
  async checkLiquidity(
    chainName: string,
    tokenAddress: Address
  ): Promise<LiquidityCheckResult> {
    const client = this.clients.get(chainName);
    if (!client) {
      throw new Error(`No client found for chain: ${chainName}`);
    }

    const flags: string[] = [];
    let riskScore = 0;

    // Simulated liquidity check
    // In production, this would query DEX-specific contracts (Uniswap, PancakeSwap, etc.)
    const isLocked = Math.random() > 0.7; // Simulated - would check actual lock contracts
    const totalLiquidity = BigInt(Math.floor(Math.random() * 10000000000000000000)); // Random liquidity

    if (!isLocked) {
      flags.push("LP_NOT_LOCKED");
      riskScore += 20;
    }

    const liquidityInEth = Number(totalLiquidity) / 1e18;
    if (liquidityInEth < 5) {
      flags.push("LOW_LIQUIDITY");
      riskScore += 15;
    }

    return {
      isLocked,
      totalLiquidity,
      riskScore: Math.min(100, riskScore),
      flags,
    };
  }

  /**
   * Calculate comprehensive rugpull risk score
   */
  calculateRugpullRisk(tokenCheck: TokenCheckResult): RugpullRiskScore {
    const flags: string[] = [];
    const recommendations: string[] = [];

    let mintAuthority = 0;
    let freezeAuthority = 0;
    let liquidity = 0;
    let decimals = 0;

    if (tokenCheck.mintAuthorityActive) {
      mintAuthority = 30;
      flags.push("MINT_AUTHORITY_ACTIVE");
      recommendations.push("Mint authority is active - token creator can mint unlimited tokens");
    }

    if (tokenCheck.freezeAuthorityActive) {
      freezeAuthority = 20;
      flags.push("FREEZE_AUTHORITY_ACTIVE");
      recommendations.push("Freeze authority is active - token creator can freeze transfers");
    }

    if (!tokenCheck.liquidityLocked) {
      liquidity = 20;
      flags.push("LIQUIDITY_NOT_LOCKED");
      recommendations.push("Liquidity is not locked - creator can withdraw liquidity");
    }

    const liquidityInEth = Number(tokenCheck.initialLiquidity) / 1e18;
    if (liquidityInEth < 5) {
      liquidity += 15;
      flags.push("LOW_INITIAL_LIQUIDITY");
      recommendations.push("Initial liquidity is very low - high risk of price manipulation");
    }

    if (tokenCheck.decimals !== 18 && tokenCheck.decimals !== 9 && tokenCheck.decimals !== 6) {
      decimals = 5;
      flags.push("UNCOMMON_DECIMALS");
    }

    const totalScore = Math.min(100, mintAuthority + freezeAuthority + liquidity + decimals);

    if (totalScore >= 70) {
      recommendations.push("HIGH RISK: Consider avoiding this token");
    } else if (totalScore >= 40) {
      recommendations.push("MEDIUM RISK: Exercise caution when trading");
    }

    return {
      totalScore,
      mintAuthority,
      freezeAuthority,
      liquidity,
      decimals,
      flags,
      recommendations,
    };
  }

  private generateDescription(flags: string[], riskScore: number): string {
    if (flags.length === 0) return "Token appears safe";
    if (riskScore >= 70) return "HIGH RISK: Multiple rugpull indicators detected";
    if (riskScore >= 40) return "MEDIUM RISK: Some concerning indicators";
    return "LOW RISK: Minor concerns detected";
  }
}

