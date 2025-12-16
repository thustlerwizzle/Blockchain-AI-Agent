/**
 * Market Manipulation Detection (Pump and Dump)
 * Based on AI-Powered-PumpBot detection techniques
 * Detects pump-and-dump schemes, price manipulation, and market abuse
 */

import type { TransactionEvent } from "../listener/blockchainListener.js";
import type { Address } from "viem";

export interface PriceMovement {
  timestamp: number;
  price: number;
  volume: bigint;
  blockNumber: bigint;
}

export interface VolumeAnalysis {
  currentVolume: bigint;
  averageVolume: bigint;
  volumeSpike: number; // Multiplier compared to average
  volumeToMarketCapRatio: number;
}

export interface MarketManipulationAlert {
  address: Address;
  tokenAddress?: Address;
  chain: string;
  alertType: "PUMP_DETECTED" | "DUMP_DETECTED" | "PUMP_AND_DUMP" | "VOLUME_SPIKE" | "PRICE_MANIPULATION" | "ORDER_BOOK_MANIPULATION";
  severity: "critical" | "high" | "medium" | "low";
  riskScore: number; // 0-100
  timestamp: number;
  description: string;
  
  // Pump/Dump specific data
  priceChange?: number; // Percentage
  volumeSpike?: number;
  pumpProbability?: number; // 0-100%
  expectedGain?: number; // Percentage
  
  // Technical indicators
  rsi?: number; // Relative Strength Index
  macd?: { value: number; signal: number; histogram: number };
  bollingerBands?: { upper: number; middle: number; lower: number };
  
  // Volume analysis
  volumeAnalysis?: VolumeAnalysis;
  
  // Order book patterns
  buyWalls?: Array<{ price: number; amount: bigint }>;
  sellWalls?: Array<{ price: number; amount: bigint }>;
  
  // Related data
  relatedAddresses: Address[];
  transactionHashes: string[];
  timeWindow: number; // Seconds
}

export interface TokenPriceData {
  address: Address;
  chain: string;
  currentPrice: number;
  priceHistory: PriceMovement[];
  volume24h: bigint;
  marketCap?: bigint;
  liquidity?: bigint;
}

export class MarketManipulationDetector {
  private tokenPrices: Map<string, TokenPriceData> = new Map(); // "chain:address" -> price data
  private alerts: MarketManipulationAlert[] = [];
  private priceHistoryWindow = 100; // Keep last 100 price points
  private volumeSpikeThreshold = 3.0; // 3x average volume = spike
  private priceChangeThreshold = 20; // 20% price change = significant
  private rapidPriceChangeThreshold = 50; // 50% in short time = pump
  
  constructor(config?: {
    volumeSpikeThreshold?: number;
    priceChangeThreshold?: number;
    rapidPriceChangeThreshold?: number;
  }) {
    if (config?.volumeSpikeThreshold) this.volumeSpikeThreshold = config.volumeSpikeThreshold;
    if (config?.priceChangeThreshold) this.priceChangeThreshold = config.priceChangeThreshold;
    if (config?.rapidPriceChangeThreshold) this.rapidPriceChangeThreshold = config.rapidPriceChangeThreshold;
  }

  /**
   * Track transaction for market manipulation detection
   */
  trackTransaction(tx: TransactionEvent, tokenAddress?: Address): void {
    const key = `${tx.chain}:${tokenAddress || tx.to}`;
    
    // Initialize token data if not exists
    if (!this.tokenPrices.has(key)) {
      this.tokenPrices.set(key, {
        address: tokenAddress || tx.to!,
        chain: tx.chain,
        currentPrice: 0,
        priceHistory: [],
        volume24h: BigInt(0),
      });
    }
    
    const tokenData = this.tokenPrices.get(key)!;
    
    // Estimate price from transaction (simplified - in production, use DEX APIs)
    // For regulatory purposes, we focus on volume and transaction patterns
    const estimatedPrice = this.estimatePriceFromTransaction(tx);
    
    // Update price history
    tokenData.priceHistory.push({
      timestamp: tx.timestamp,
      price: estimatedPrice,
      volume: tx.value,
      blockNumber: tx.blockNumber,
    });
    
    // Keep only recent history
    if (tokenData.priceHistory.length > this.priceHistoryWindow) {
      tokenData.priceHistory.shift();
    }
    
    // Update volume
    tokenData.volume24h += tx.value;
    
    // Analyze for pump and dump patterns
    this.analyzeToken(key, tokenData, tx);
  }

  /**
   * Estimate price from transaction value and gas
   * In production, integrate with DEX price oracles
   */
  private estimatePriceFromTransaction(tx: TransactionEvent): number {
    // Simplified price estimation - use transaction value as proxy
    // Real implementation would query DEX pools or price oracles
    return Number(tx.value) / 1e18;
  }

  /**
   * Analyze token for pump and dump patterns
   */
  private analyzeToken(key: string, tokenData: TokenPriceData, tx: TransactionEvent): void {
    // Always check for volume spikes first (works with minimal data)
    if (tokenData.priceHistory.length >= 2) {
      this.detectVolumeSpikes(tokenData, tx);
    }
    
    // Need at least 5 data points for basic analysis, 10 for better accuracy
    if (tokenData.priceHistory.length < 5) return;
    
    // For regulatory purposes, use what we have
    const recent = tokenData.priceHistory.slice(-10);
    const older = tokenData.priceHistory.length >= 10 
      ? tokenData.priceHistory.slice(-20, -10)
      : tokenData.priceHistory.slice(0, Math.floor(tokenData.priceHistory.length / 2));
    
    if (older.length === 0 && tokenData.priceHistory.length < 10) {
      return; // Already checked volume spikes above
    }
    
    // Calculate volume spike
    const volumeAnalysis = this.analyzeVolume(recent, older, tokenData.volume24h);
    
    // Calculate price momentum
    const priceChange = this.calculatePriceChange(recent, older);
    
    // Calculate RSI (Relative Strength Index)
    const rsi = this.calculateRSI(recent);
    
    // Detect pump pattern
    if (volumeAnalysis.volumeSpike >= this.volumeSpikeThreshold && priceChange > this.rapidPriceChangeThreshold) {
      const pumpProbability = this.calculatePumpProbability(recent, volumeAnalysis, rsi);
      
      if (pumpProbability > 70) {
        this.createAlert({
          address: tx.from,
          tokenAddress: tokenData.address,
          chain: tx.chain,
          alertType: "PUMP_DETECTED",
          severity: pumpProbability > 85 ? "critical" : "high",
          riskScore: Math.min(pumpProbability, 95),
          timestamp: tx.timestamp,
          description: `Pump detected: ${priceChange.toFixed(2)}% price increase with ${volumeAnalysis.volumeSpike.toFixed(2)}x volume spike. RSI: ${rsi.toFixed(2)}`,
          priceChange,
          volumeSpike: volumeAnalysis.volumeSpike,
          pumpProbability,
          rsi,
          volumeAnalysis,
          relatedAddresses: [tx.from, tx.to!].filter(Boolean) as Address[],
          transactionHashes: [tx.hash],
          timeWindow: (recent[recent.length - 1].timestamp - recent[0].timestamp) / 1000,
        });
      }
    }
    
    // Detect dump pattern (rapid price decrease after pump)
    if (priceChange < -this.rapidPriceChangeThreshold && volumeAnalysis.volumeSpike >= this.volumeSpikeThreshold * 0.8) {
      const dumpProbability = this.calculateDumpProbability(recent, volumeAnalysis);
      
      if (dumpProbability > 70) {
        this.createAlert({
          address: tx.from,
          tokenAddress: tokenData.address,
          chain: tx.chain,
          alertType: "DUMP_DETECTED",
          severity: dumpProbability > 85 ? "critical" : "high",
          riskScore: Math.min(dumpProbability, 95),
          timestamp: tx.timestamp,
          description: `Dump detected: ${Math.abs(priceChange).toFixed(2)}% price decrease with high volume. Potential market manipulation.`,
          priceChange,
          volumeSpike: volumeAnalysis.volumeSpike,
          relatedAddresses: [tx.from, tx.to!].filter(Boolean) as Address[],
          transactionHashes: [tx.hash],
          timeWindow: (recent[recent.length - 1].timestamp - recent[0].timestamp) / 1000,
        });
      }
    }
    
    // Detect pump and dump sequence
    if (tokenData.priceHistory.length >= 20) {
      const fullHistory = tokenData.priceHistory.slice(-20);
      const pumpAndDump = this.detectPumpAndDumpSequence(fullHistory);
      
      if (pumpAndDump.detected) {
        this.createAlert({
          address: tx.from,
          tokenAddress: tokenData.address,
          chain: tx.chain,
          alertType: "PUMP_AND_DUMP",
          severity: "critical",
          riskScore: 95,
          timestamp: tx.timestamp,
          description: `Pump and dump scheme detected: ${pumpAndDump.pumpPercent.toFixed(2)}% pump followed by ${pumpAndDump.dumpPercent.toFixed(2)}% dump. Classic manipulation pattern.`,
          priceChange: pumpAndDump.pumpPercent + pumpAndDump.dumpPercent,
          volumeSpike: volumeAnalysis.volumeSpike,
          relatedAddresses: [tx.from, tx.to!].filter(Boolean) as Address[],
          transactionHashes: [tx.hash],
          timeWindow: (fullHistory[fullHistory.length - 1].timestamp - fullHistory[0].timestamp) / 1000,
        });
      }
    }
    
    // Volume spike detection
    if (volumeAnalysis.volumeSpike >= this.volumeSpikeThreshold) {
      this.createAlert({
        address: tx.from,
        tokenAddress: tokenData.address,
        chain: tx.chain,
        alertType: "VOLUME_SPIKE",
        severity: volumeAnalysis.volumeSpike >= 5 ? "high" : "medium",
        riskScore: Math.min(volumeAnalysis.volumeSpike * 15, 90),
        timestamp: tx.timestamp,
        description: `Unusual volume spike detected: ${volumeAnalysis.volumeSpike.toFixed(2)}x average volume. Possible manipulation.`,
        volumeSpike: volumeAnalysis.volumeSpike,
        volumeAnalysis,
        relatedAddresses: [tx.from, tx.to!].filter(Boolean) as Address[],
        transactionHashes: [tx.hash],
        timeWindow: 3600, // 1 hour window
      });
    }
  }

  /**
   * Analyze volume patterns
   */
  private analyzeVolume(recent: PriceMovement[], older: PriceMovement[], volume24h: bigint): VolumeAnalysis {
    const recentVolume = recent.reduce((sum, m) => sum + m.volume, BigInt(0));
    const olderVolume = older.length > 0 
      ? older.reduce((sum, m) => sum + m.volume, BigInt(0)) / BigInt(older.length)
      : BigInt(0);
    
    const averageVolume = olderVolume > BigInt(0) ? olderVolume : recentVolume / BigInt(recent.length);
    const currentVolume = recentVolume / BigInt(recent.length);
    
    const volumeSpike = averageVolume > BigInt(0) 
      ? Number(currentVolume) / Number(averageVolume)
      : 1;
    
    // Estimate market cap (simplified)
    const estimatedMarketCap = volume24h * BigInt(2); // Rough estimate
    const volumeToMarketCapRatio = estimatedMarketCap > BigInt(0)
      ? Number(volume24h) / Number(estimatedMarketCap)
      : 0;
    
    return {
      currentVolume,
      averageVolume,
      volumeSpike,
      volumeToMarketCapRatio,
    };
  }

  /**
   * Calculate price change percentage
   */
  private calculatePriceChange(recent: PriceMovement[], older: PriceMovement[]): number {
    if (recent.length === 0 || older.length === 0) return 0;
    
    const recentAvg = recent.reduce((sum, m) => sum + m.price, 0) / recent.length;
    const olderAvg = older.reduce((sum, m) => sum + m.price, 0) / older.length;
    
    if (olderAvg === 0) return 0;
    
    return ((recentAvg - olderAvg) / olderAvg) * 100;
  }

  /**
   * Calculate RSI (Relative Strength Index)
   */
  private calculateRSI(prices: PriceMovement[], period: number = 14): number {
    if (prices.length < period + 1) return 50; // Neutral
    
    const changes = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i].price - prices[i - 1].price);
    }
    
    const gains = changes.filter(c => c > 0);
    const losses = changes.filter(c => c < 0).map(c => Math.abs(c));
    
    const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / gains.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * Calculate pump probability based on multiple factors
   */
  private calculatePumpProbability(
    recent: PriceMovement[],
    volumeAnalysis: VolumeAnalysis,
    rsi: number
  ): number {
    let probability = 0;
    
    // Volume spike contributes 40%
    if (volumeAnalysis.volumeSpike >= 5) probability += 40;
    else if (volumeAnalysis.volumeSpike >= 3) probability += 30;
    else if (volumeAnalysis.volumeSpike >= 2) probability += 20;
    
    // RSI overbought (70+) contributes 30%
    if (rsi >= 80) probability += 30;
    else if (rsi >= 70) probability += 20;
    
    // Price acceleration contributes 30%
    const priceAcceleration = this.calculatePriceAcceleration(recent);
    if (priceAcceleration > 10) probability += 30;
    else if (priceAcceleration > 5) probability += 20;
    
    return Math.min(probability, 100);
  }

  /**
   * Calculate price acceleration (rate of price change)
   */
  private calculatePriceAcceleration(prices: PriceMovement[]): number {
    if (prices.length < 3) return 0;
    
    const changes = [];
    for (let i = 1; i < prices.length; i++) {
      const change = ((prices[i].price - prices[i - 1].price) / prices[i - 1].price) * 100;
      changes.push(change);
    }
    
    // Calculate acceleration (change in rate of change)
    if (changes.length < 2) return 0;
    
    const acceleration = changes[changes.length - 1] - changes[0];
    return acceleration;
  }

  /**
   * Calculate dump probability
   */
  private calculateDumpProbability(recent: PriceMovement[], volumeAnalysis: VolumeAnalysis): number {
    let probability = 0;
    
    // Volume spike contributes 40%
    if (volumeAnalysis.volumeSpike >= 3) probability += 40;
    else if (volumeAnalysis.volumeSpike >= 2) probability += 30;
    
    // Rapid price decrease contributes 60%
    const priceChange = this.calculatePriceChange(recent, recent.slice(0, Math.floor(recent.length / 2)));
    if (priceChange < -30) probability += 60;
    else if (priceChange < -20) probability += 40;
    
    return Math.min(probability, 100);
  }

  /**
   * Detect pump and dump sequence
   */
  private detectPumpAndDumpSequence(history: PriceMovement[]): {
    detected: boolean;
    pumpPercent: number;
    dumpPercent: number;
  } {
    if (history.length < 10) return { detected: false, pumpPercent: 0, dumpPercent: 0 };
    
    // Find peak price
    const peakIndex = history.reduce((maxIdx, curr, idx, arr) => 
      curr.price > arr[maxIdx].price ? idx : maxIdx, 0
    );
    
    if (peakIndex < 3 || peakIndex > history.length - 3) {
      return { detected: false, pumpPercent: 0, dumpPercent: 0 };
    }
    
    const startPrice = history[0].price;
    const peakPrice = history[peakIndex].price;
    const endPrice = history[history.length - 1].price;
    
    const pumpPercent = ((peakPrice - startPrice) / startPrice) * 100;
    const dumpPercent = ((endPrice - peakPrice) / peakPrice) * 100;
    
    // Pump and dump detected if significant pump followed by significant dump
    const detected = pumpPercent > this.priceChangeThreshold && dumpPercent < -this.priceChangeThreshold;
    
    return { detected, pumpPercent, dumpPercent };
  }

  /**
   * Detect volume spikes with limited data
   */
  private detectVolumeSpikes(tokenData: TokenPriceData, tx: TransactionEvent): void {
    if (tokenData.priceHistory.length < 3) return;
    
    const recentVolume = tokenData.priceHistory.slice(-3).reduce((sum, m) => sum + m.volume, BigInt(0));
    const avgVolume = recentVolume / BigInt(tokenData.priceHistory.length);
    
    // If current transaction volume is significantly higher
    if (tx.value > avgVolume * BigInt(Math.floor(this.volumeSpikeThreshold * 1e18))) {
      this.createAlert({
        address: tx.from,
        tokenAddress: tokenData.address,
        chain: tx.chain,
        alertType: "VOLUME_SPIKE",
        severity: "medium",
        riskScore: 60,
        timestamp: tx.timestamp,
        description: `Unusual volume spike detected: Transaction value ${(Number(tx.value) / 1e18).toFixed(2)} ETH exceeds average by ${this.volumeSpikeThreshold}x. Possible manipulation.`,
        volumeSpike: Number(tx.value) / Number(avgVolume > BigInt(0) ? avgVolume : BigInt(1)),
        relatedAddresses: [tx.from, tx.to!].filter(Boolean) as Address[],
        transactionHashes: [tx.hash],
        timeWindow: 300, // 5 minute window
      });
    }
  }

  /**
   * Create alert
   */
  private createAlert(alert: Omit<MarketManipulationAlert, 'alertType'> & { alertType: MarketManipulationAlert['alertType'] }): void {
    this.alerts.push(alert as MarketManipulationAlert);
    
    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts.shift();
    }
    
    console.log(`🚨 Market Manipulation Alert: ${alert.alertType} - ${alert.description}`);
  }

  /**
   * Get alerts
   */
  getAlerts(limit: number = 100, severity?: "critical" | "high" | "medium" | "low"): MarketManipulationAlert[] {
    let filtered = this.alerts;
    
    if (severity) {
      filtered = filtered.filter(a => a.severity === severity);
    }
    
    return filtered
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get alerts for specific address
   */
  getAddressAlerts(address: Address, limit: number = 50): MarketManipulationAlert[] {
    return this.alerts
      .filter(a => a.address.toLowerCase() === address.toLowerCase())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get alerts for specific token
   */
  getTokenAlerts(tokenAddress: Address, limit: number = 50): MarketManipulationAlert[] {
    return this.alerts
      .filter(a => a.tokenAddress && a.tokenAddress.toLowerCase() === tokenAddress.toLowerCase())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }
}

