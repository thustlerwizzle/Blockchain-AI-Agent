import { MultiChainListener, type TransactionEvent } from "../listener/blockchainListener.js";
import { TransactionAnalyzer, type TransactionAnalysis } from "../analyzer/transactionAnalyzer.js";
import { StrategyExecutor, type Strategy, type StrategyResult } from "../strategy/strategyExecutor.js";
import type { ReinforcementLearning } from "../learning/reinforcementLearning.js";
import type { RegulatoryMetricsCalculator } from "../regulator/regulatoryMetrics.js";
import type { DABAComplianceChecker } from "../regulator/dabaCompliance.js";
import type { OpenZeppelinMonitor } from "../monitor/openzeppelinMonitor.js";
import { TransactionFlowTracker } from "../tracker/transactionFlowTracker.js";
import { WalletTracker } from "../tracker/walletTracker.js";
import { OnChainSecurityChecker } from "../security/onChainChecks.js";
import { MarketManipulationDetector } from "../security/marketManipulationDetector.js";
import { EnhancedSuspiciousActivityTracker } from "../security/enhancedSuspiciousActivity.js";

export interface AgentConfig {
  chains?: string[];
  enableAnalysis?: boolean;
  enableStrategies?: boolean;
  analysisConfig?: {
    riskThreshold?: number;
    enableAIAnalysis?: boolean;
  };
}

export interface AgentStats {
  transactionsProcessed: number;
  suspiciousTransactions: number;
  strategiesTriggered: number;
  chainsMonitored: number;
  uptime: number;
}

export class AgentOrchestrator {
  private listener: MultiChainListener;
  private analyzer: TransactionAnalyzer;
  private strategyExecutor: StrategyExecutor;
  private rl?: ReinforcementLearning;
  private regulatoryMetrics?: RegulatoryMetricsCalculator;
  private dabaCompliance?: DABAComplianceChecker;
  private openzeppelinMonitor?: OpenZeppelinMonitor;
  private flowTracker?: TransactionFlowTracker;
  private walletTracker?: WalletTracker;
  private onChainSecurityChecker?: OnChainSecurityChecker;
  private marketManipulationDetector?: MarketManipulationDetector;
  private enhancedSuspiciousActivityTracker?: EnhancedSuspiciousActivityTracker;
  private config: AgentConfig;
  private stats: AgentStats;
  private startTime: number;
  private isRunning: boolean = false;
  private recentTransactions: Array<{
    hash: string;
    chain: string;
    riskScore: number;
    suspicious: boolean;
    timestamp: number;
  }> = [];

  constructor(config: AgentConfig = {}) {
    this.config = {
      enableAnalysis: true,
      enableStrategies: true,
      ...config,
    };

    this.listener = new MultiChainListener();
    this.analyzer = new TransactionAnalyzer(this.config.analysisConfig);
    this.strategyExecutor = new StrategyExecutor();
    this.startTime = Date.now();
    this.stats = {
      transactionsProcessed: 0,
      suspiciousTransactions: 0,
      strategiesTriggered: 0,
      chainsMonitored: 0,
      uptime: 0,
    };
  }

  /**
   * Start the agent
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("Agent is already running");
      return;
    }

    this.isRunning = true;
    console.log("🤖 Starting Blockchain AI Agent...");

    const chains = this.config.chains || this.listener.getChains();
    this.stats.chainsMonitored = chains.length;

    // Start listening to transactions on all chains
    for (const chainName of chains) {
      try {
        this.listener.startTransactionListener(
          chainName,
          async (tx: TransactionEvent) => {
            await this.handleTransaction(tx);
          }
        );
        console.log(`✅ Started listening on ${chainName}`);
      } catch (error) {
        console.error(`Failed to start listener on ${chainName}:`, error);
      }
    }

    console.log("🚀 Agent started successfully!");
    console.log(`📊 Monitoring ${chains.length} chain(s): ${chains.join(", ")}`);
  }

  /**
   * Stop the agent
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    this.listener.stopAllListeners();
    console.log("🛑 Agent stopped");
  }

  /**
   * Handle incoming transaction
   */
  private async handleTransaction(tx: TransactionEvent): Promise<void> {
    this.stats.transactionsProcessed++;
    this.stats.uptime = Date.now() - this.startTime;

    console.log(`\n📥 New transaction on ${tx.chain}:`);
    console.log(`   Hash: ${tx.hash}`);
    console.log(`   From: ${tx.from}`);
    console.log(`   To: ${tx.to || "Contract Creation"}`);
    console.log(`   Value: ${tx.value.toString()} wei`);

    let analysis: TransactionAnalysis | null = null;

    // Analyze transaction if enabled
    if (this.config.enableAnalysis) {
      try {
        analysis = await this.analyzer.analyzeTransaction(tx);
        this.logAnalysis(analysis);

        if (analysis.suspicious) {
          this.stats.suspiciousTransactions++;
        }
      } catch (error) {
        console.error("Analysis failed:", error);
      }
    }

    // Execute strategies if enabled
    if (this.config.enableStrategies && analysis) {
      try {
        const results = await this.strategyExecutor.evaluateTransaction(
          tx,
          analysis
        );

        for (const result of results) {
          if (result.triggered) {
            this.stats.strategiesTriggered++;
            console.log(
              `⚡ Strategy ${result.strategyId} triggered! Actions: ${result.actionsExecuted.join(", ")}`
            );
          }
        }

        // Update reinforcement learning
        if (this.rl && analysis) {
          this.rl.update(analysis, results, "transaction_analysis");
        }

        // Update regulatory metrics
        if (this.regulatoryMetrics && analysis) {
          this.regulatoryMetrics.addTransaction(tx, analysis);
        }

        // Update DABA compliance
        if (this.dabaCompliance && analysis) {
          this.dabaCompliance.addTransaction(tx, analysis);
        }

        // Track high-risk transaction flows
        if (this.flowTracker && analysis && analysis.riskScore >= 70) {
          this.flowTracker.trackTransaction(tx, analysis);
        }

        // Track wallets for suspicious activity monitoring (ALL transactions, not just high-risk)
        if (this.walletTracker && analysis) {
          this.walletTracker.trackTransaction(tx, analysis);
        }

        // Track insider trading and balance changes
        if (this.marketManipulationDetector && analysis) {
          this.marketManipulationDetector.trackTransaction(tx, tx.to);
        }

        // Enhanced suspicious activity tracking
        if (this.enhancedSuspiciousActivityTracker && analysis && analysis.suspicious) {
          this.enhancedSuspiciousActivityTracker.addSuspiciousActivity(
            tx.from,
            tx.chain,
            analysis.category,
            analysis.riskScore,
            analysis.anomalyFlags,
            analysis.summary,
            tx.hash,
            tx.value,
            tx.to ? [tx.to] : []
          );

          // If there's a recipient, also track them if suspicious
          if (tx.to && analysis.riskScore >= 50) {
            this.enhancedSuspiciousActivityTracker.addSuspiciousActivity(
              tx.to,
              tx.chain,
              analysis.category,
              analysis.riskScore - 10, // Slightly lower for recipient
              analysis.anomalyFlags,
              `Recipient of suspicious transaction: ${analysis.summary}`,
              tx.hash,
              tx.value,
              [tx.from]
            );
          }
        }

        // Check for token/contract creation (potential rugpull)
        if (this.onChainSecurityChecker && !tx.to && tx.data && tx.data.length > 2) {
          try {
            // This is a contract creation - check for token indicators
            // Note: In production, we'd need to wait for contract deployment and then check
            // For now, we'll flag contract creations as potentially risky
            if (this.enhancedSuspiciousActivityTracker && analysis && analysis.riskScore >= 40) {
              this.enhancedSuspiciousActivityTracker.addSuspiciousActivity(
                tx.from,
                tx.chain,
                "CONTRACT_CREATION",
                analysis.riskScore + 15,
                [...analysis.anomalyFlags, "NEW_CONTRACT"],
                `New contract creation with suspicious activity: ${analysis.summary}`,
                tx.hash,
                tx.value,
                []
              );
            }
          } catch (error) {
            // Ignore errors for on-chain checks during contract creation
          }
        }

        // Evaluate OpenZeppelin Monitor triggers
        if (this.openzeppelinMonitor) {
          try {
            const monitorEvents = await this.openzeppelinMonitor.evaluateTransaction(
              tx,
              analysis
            );
            if (monitorEvents.length > 0) {
              console.log(
                `📡 ${monitorEvents.length} monitor trigger(s) activated`
              );
            }
          } catch (error) {
            console.error("Monitor evaluation error:", error);
          }
        }

        // Store transaction for dashboard
        this.recentTransactions.push({
          hash: tx.hash,
          chain: tx.chain,
          riskScore: analysis?.riskScore || 0,
          suspicious: analysis?.suspicious || false,
          timestamp: tx.timestamp * 1000,
        });

        // Keep only last 100 transactions
        if (this.recentTransactions.length > 100) {
          this.recentTransactions.shift();
        }
      } catch (error) {
        console.error("Strategy execution failed:", error);
      }
    }
  }

  /**
   * Log analysis results
   */
  private logAnalysis(analysis: TransactionAnalysis): void {
    const riskEmoji = analysis.riskScore >= 70 ? "🔴" : analysis.riskScore >= 40 ? "🟡" : "🟢";
    
    console.log(`\n${riskEmoji} Analysis Results:`);
    console.log(`   Risk Score: ${analysis.riskScore}/100`);
    console.log(`   Category: ${analysis.category}`);
    console.log(`   Suspicious: ${analysis.suspicious ? "YES" : "NO"}`);
    
    if (analysis.anomalyFlags.length > 0) {
      console.log(`   Flags: ${analysis.anomalyFlags.join(", ")}`);
    }
    
    if (analysis.summary) {
      console.log(`   Summary: ${analysis.summary}`);
    }
  }

  /**
   * Set reinforcement learning instance
   */
  setReinforcementLearning(rl: ReinforcementLearning): void {
    this.rl = rl;
  }

  /**
   * Set regulatory metrics calculator
   */
  setRegulatoryMetrics(metrics: RegulatoryMetricsCalculator): void {
    this.regulatoryMetrics = metrics;
  }

  /**
   * Get regulatory metrics calculator
   */
  getRegulatoryMetrics(): RegulatoryMetricsCalculator | undefined {
    return this.regulatoryMetrics;
  }

  /**
   * Set DABA compliance checker
   */
  setDABACompliance(checker: DABAComplianceChecker): void {
    this.dabaCompliance = checker;
    if (this.regulatoryMetrics) {
      this.regulatoryMetrics.setDABACompliance(checker);
    }
  }

  /**
   * Get DABA compliance checker
   */
  getDABACompliance(): DABAComplianceChecker | undefined {
    return this.dabaCompliance;
  }

  /**
   * Set OpenZeppelin Monitor
   */
  setOpenZeppelinMonitor(monitor: OpenZeppelinMonitor): void {
    this.openzeppelinMonitor = monitor;
  }

  /**
   * Get OpenZeppelin Monitor
   */
  getOpenZeppelinMonitor(): OpenZeppelinMonitor | undefined {
    return this.openzeppelinMonitor;
  }

  /**
   * Set Transaction Flow Tracker
   */
  setFlowTracker(tracker: TransactionFlowTracker): void {
    this.flowTracker = tracker;
  }

  /**
   * Get Transaction Flow Tracker
   */
  getFlowTracker(): TransactionFlowTracker | undefined {
    return this.flowTracker;
  }

  /**
   * Set Wallet Tracker
   */
  setWalletTracker(tracker: WalletTracker): void {
    this.walletTracker = tracker;
  }

  /**
   * Get Wallet Tracker
   */
  getWalletTracker(): WalletTracker | undefined {
    return this.walletTracker;
  }

  /**
   * Set On-Chain Security Checker
   */
  setOnChainSecurityChecker(checker: OnChainSecurityChecker): void {
    this.onChainSecurityChecker = checker;
  }

  /**
   * Get On-Chain Security Checker
   */
  getOnChainSecurityChecker(): OnChainSecurityChecker | undefined {
    return this.onChainSecurityChecker;
  }

  /**
   * Set Market Manipulation Detector (Pump and Dump Detection)
   */
  setMarketManipulationDetector(detector: MarketManipulationDetector): void {
    this.marketManipulationDetector = detector;
  }

  /**
   * Get Market Manipulation Detector
   */
  getMarketManipulationDetector(): MarketManipulationDetector | undefined {
    return this.marketManipulationDetector;
  }

  /**
   * Set Enhanced Suspicious Activity Tracker
   */
  setEnhancedSuspiciousActivityTracker(tracker: EnhancedSuspiciousActivityTracker): void {
    this.enhancedSuspiciousActivityTracker = tracker;
  }

  /**
   * Get Enhanced Suspicious Activity Tracker
   */
  getEnhancedSuspiciousActivityTracker(): EnhancedSuspiciousActivityTracker | undefined {
    return this.enhancedSuspiciousActivityTracker;
  }

  /**
   * Register a strategy
   */
  registerStrategy(strategy: Strategy): void {
    this.strategyExecutor.registerStrategy(strategy);
  }

  /**
   * Get agent statistics
   */
  getStats(): AgentStats {
    return {
      ...this.stats,
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Get all strategies
   */
  getStrategies(): Strategy[] {
    return this.strategyExecutor.getStrategies();
  }

  /**
   * Check if agent is running
   */
  isAgentRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get recent transactions for dashboard
   */
  getRecentTransactions(limit: number = 10): Array<{
    hash: string;
    chain: string;
    riskScore: number;
    suspicious: boolean;
    timestamp: number;
  }> {
    return this.recentTransactions.slice(-limit).reverse();
  }
}

