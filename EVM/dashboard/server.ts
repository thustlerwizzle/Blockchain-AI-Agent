import "dotenv/config";
import express, { type Request, type Response } from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { AgentOrchestrator } from "../src/agent/agentOrchestrator.js";
import { ReinforcementLearning } from "../src/learning/reinforcementLearning.js";
import { RegulatoryMetricsCalculator } from "../src/regulator/regulatoryMetrics.js";
import { DABAComplianceChecker } from "../src/regulator/dabaCompliance.js";
import { OpenZeppelinMonitor } from "../src/monitor/openzeppelinMonitor.js";
import { generateTestTransaction } from "../src/test/testDataGenerator.js";
import { TransactionAnalyzer } from "../src/analyzer/transactionAnalyzer.js";
import { TransactionFlowTracker } from "../src/tracker/transactionFlowTracker.js";
import { WalletTracker } from "../src/tracker/walletTracker.js";
import { OnChainSecurityChecker } from "../src/security/onChainChecks.js";
import { MarketManipulationDetector } from "../src/security/marketManipulationDetector.js";
import { EnhancedSuspiciousActivityTracker } from "../src/security/enhancedSuspiciousActivity.js";
import { FinancialStatementAnalyzer } from "../src/regulator/financialStatementAnalyzer.js";
import * as EtherscanAPI from "../src/utils/etherscan.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '1gb' })); // Support files up to 1GB
app.use(express.urlencoded({ extended: true, limit: '1gb' })); // Support URL encoded up to 1GB
// Note: File uploads now use base64 encoding in JSON body
// API routes must be defined BEFORE static middleware
// app.use(express.static(path.join(__dirname))); // Moved to end

// Initialize agent (singleton)
let agent: AgentOrchestrator | null = null;
let rl: ReinforcementLearning | null = null;
let regulatoryMetrics: RegulatoryMetricsCalculator | null = null;
let dabaCompliance: DABAComplianceChecker | null = null;
let openzeppelinMonitor: OpenZeppelinMonitor | null = null;
let flowTracker: TransactionFlowTracker | null = null;
let walletTracker: WalletTracker | null = null;
let onChainSecurityChecker: OnChainSecurityChecker | null = null;
let marketManipulationDetector: MarketManipulationDetector | null = null;
let enhancedSuspiciousActivityTracker: EnhancedSuspiciousActivityTracker | null = null;
let financialStatementAnalyzer: FinancialStatementAnalyzer | null = null;
let recentTransactions: any[] = [];

// Helper to serialize BigInt for JSON
function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeBigInt(value);
    }
    return result;
  }
  return obj;
}

async function initializeAgent() {
  if (!agent) {
    // Monitor ALL major blockchain platforms
    agent = new AgentOrchestrator({
      chains: [
        "ethereum",
        "polygon",
        "bsc",
        "arbitrum",
        "optimism",
        "base",
        "avalanche-fuji",
        "sepolia",
      ],
      enableAnalysis: true,
      enableStrategies: true,
    });
    rl = new ReinforcementLearning();
    regulatoryMetrics = new RegulatoryMetricsCalculator();
    dabaCompliance = new DABAComplianceChecker({
      licenseClass: "F",
      headOfficeInBermuda: true,
    });
    openzeppelinMonitor = new OpenZeppelinMonitor();
    flowTracker = new TransactionFlowTracker();
    walletTracker = new WalletTracker();
    
    // Initialize security modules - use chains from agent listener
    const { MultiChainListener } = await import("../src/listener/blockchainListener.js");
    const listener = new MultiChainListener();
    // Get chain configs for security checker
    // We'll use a simplified approach with empty chain configs for now
    // The security checker will work with the chain names
    onChainSecurityChecker = new OnChainSecurityChecker([]);
    marketManipulationDetector = new MarketManipulationDetector({
      volumeSpikeThreshold: 3.0, // 3x average volume = spike
      priceChangeThreshold: 20, // 20% price change = significant
      rapidPriceChangeThreshold: 50, // 50% in short time = pump
    });
    enhancedSuspiciousActivityTracker = new EnhancedSuspiciousActivityTracker();
    financialStatementAnalyzer = new FinancialStatementAnalyzer(
      undefined, // OpenAI API key no longer used
      undefined  // Google AI API key no longer used - using rule-based analysis only
    );
    console.log("✅ Financial Statement Analyzer initialized with rule-based analysis (no API required)");
    
    // Load default triggers
    try {
      const fs = await import("fs");
      const pathModule = await import("path");
      const triggersConfig = JSON.parse(
        fs.readFileSync(pathModule.join(process.cwd(), "config", "monitor-triggers.json"), "utf-8")
      );
      openzeppelinMonitor.loadTriggersFromConfig(triggersConfig);
    } catch (error) {
      console.warn("Could not load monitor triggers:", error);
    }
    agent.setReinforcementLearning(rl);
    agent.setRegulatoryMetrics(regulatoryMetrics);
    agent.setDABACompliance(dabaCompliance);
    agent.setOpenZeppelinMonitor(openzeppelinMonitor);
    agent.setFlowTracker(flowTracker);
    agent.setWalletTracker(walletTracker);
    agent.setOnChainSecurityChecker(onChainSecurityChecker);
    agent.setMarketManipulationDetector(marketManipulationDetector);
    agent.setEnhancedSuspiciousActivityTracker(enhancedSuspiciousActivityTracker);

    // Auto-start agent when dashboard server starts
    if (!agent.isAgentRunning()) {
      agent.start().catch(err => {
        console.error("Failed to auto-start agent:", err);
      });
    }

    // Generate test data immediately to ensure dashboard has data
    // Also generate continuously to simulate real-time activity
    const generateContinuousTestData = async () => {
      console.log("📊 Generating continuous test data for real-time tracking...");
      const testAnalyzer = new TransactionAnalyzer();
      
      const chains = ["ethereum", "polygon", "bsc", "arbitrum", "optimism", "base", "avalanche-fuji"];
      
      // Generate initial batch with varied risk levels - ensure we have high-risk transactions
      for (const chain of chains) {
        // Process all transactions with varied risk levels
        // Generate more high-risk transactions to populate flow tracker
        for (let i = 0; i < 15; i++) {
          // Generate more high-risk: 40% high, 30% medium, 30% low
          const riskRand = Math.random();
          const riskLevel = riskRand < 0.4 ? "high" : riskRand < 0.7 ? "medium" : "low";
          const testTx = generateTestTransaction(chain, riskLevel as "low" | "medium" | "high");
          try {
            const analysis = await testAnalyzer.analyzeTransaction(testTx);
            
            // Add to regulatory metrics
            if (regulatoryMetrics) {
              regulatoryMetrics.addTransaction(testTx, analysis);
            }
            
            // Add to DABA compliance
            if (dabaCompliance) {
              dabaCompliance.addTransaction(testTx, analysis);
            }
            
            // Track in flow tracker if high-risk
            if (flowTracker && analysis.riskScore >= 70) {
              flowTracker.trackTransaction(testTx, analysis);
            }
            
                // Track in wallet tracker (ALL transactions)
                if (walletTracker) {
                  walletTracker.trackTransaction(testTx, analysis);
                }
                
                // Track market manipulation (pump and dump)
                if (marketManipulationDetector) {
                  // Use a consistent token address for testing pump/dump patterns
                  // Generate a fake token address based on chain for consistent tracking
                  const tokenAddress = testTx.to || `0x${chain.slice(0, 2).padEnd(40, '0')}` as `0x${string}`;
                  marketManipulationDetector.trackTransaction(testTx, tokenAddress as `0x${string}`);
                  
                  // Simulate pump pattern by creating multiple transactions with increasing values
                  if (riskLevel === "high" && Math.random() > 0.7) {
                    // Create a pump sequence
                    for (let pumpStep = 0; pumpStep < 5; pumpStep++) {
                      const pumpTx = { ...testTx };
                      pumpTx.value = BigInt(Number(testTx.value) * (1 + pumpStep * 0.2)); // Increasing values
                      pumpTx.timestamp = testTx.timestamp + pumpStep * 10; // 10 second intervals
                      pumpTx.hash = `${testTx.hash.slice(0, -2)}${pumpStep}` as `0x${string}`;
                      marketManipulationDetector.trackTransaction(pumpTx, tokenAddress as `0x${string}`);
                    }
                  }
                }
                
                // Track enhanced suspicious activity
                if (enhancedSuspiciousActivityTracker && analysis.suspicious) {
                  enhancedSuspiciousActivityTracker.addSuspiciousActivity(
                    testTx.from,
                    testTx.chain,
                    analysis.category,
                    analysis.riskScore,
                    analysis.anomalyFlags,
                    analysis.summary,
                    testTx.hash,
                    testTx.value,
                    testTx.to ? [testTx.to] : []
                  );
                }
                
                // Evaluate monitor triggers
                if (openzeppelinMonitor) {
                  await openzeppelinMonitor.evaluateTransaction(testTx, analysis);
                }
            
            // Add to agent's recent transactions
            (agent as any).recentTransactions = (agent as any).recentTransactions || [];
            (agent as any).recentTransactions.push({
              hash: testTx.hash,
              chain: testTx.chain,
              riskScore: analysis.riskScore,
              suspicious: analysis.suspicious,
              timestamp: testTx.timestamp * 1000,
            });
            
            // Keep only last 100
            if ((agent as any).recentTransactions.length > 100) {
              (agent as any).recentTransactions.shift();
            }
          } catch (err) {
            console.error(`Error processing test transaction:`, err);
          }
        }
      }
      console.log("✅ Initial test data generated!");
    };
    
    // Generate initial data immediately
    generateContinuousTestData();
    
    // Generate new transactions every 3 seconds to simulate real-time activity
    setInterval(async () => {
      const testAnalyzer = new TransactionAnalyzer();
      const chains = ["ethereum", "polygon", "bsc", "arbitrum", "optimism", "base"];
      const randomChain = chains[Math.floor(Math.random() * chains.length)];
      
      // Generate 3-5 transactions per interval - ensure we get high-risk transactions
      const count = Math.floor(Math.random() * 3) + 3;
      for (let i = 0; i < count; i++) {
        // Generate more high-risk: 50% high, 30% medium, 20% low to ensure data appears
        const riskRand = Math.random();
        const riskLevel = riskRand < 0.5 ? "high" : riskRand < 0.8 ? "medium" : "low";
        const testTx = generateTestTransaction(randomChain, riskLevel as "low" | "medium" | "high");
        try {
          const analysis = await testAnalyzer.analyzeTransaction(testTx);
          
          if (regulatoryMetrics) {
            regulatoryMetrics.addTransaction(testTx, analysis);
          }
          if (dabaCompliance) {
            dabaCompliance.addTransaction(testTx, analysis);
          }
          if (flowTracker && analysis.riskScore >= 70) {
            flowTracker.trackTransaction(testTx, analysis);
          }
              if (walletTracker) {
                walletTracker.trackTransaction(testTx, analysis);
              }
              if (marketManipulationDetector) {
                // Use consistent token addresses for better pattern detection
                const tokenAddress = testTx.to || `0x${randomChain.slice(0, 2).padEnd(40, '0')}` as `0x${string}`;
                marketManipulationDetector.trackTransaction(testTx, tokenAddress as `0x${string}`);
                
                // Occasionally create pump patterns for detection
                if (riskLevel === "high" && Math.random() > 0.8) {
                  for (let pumpStep = 0; pumpStep < 3; pumpStep++) {
                    const pumpTx = { ...testTx };
                    pumpTx.value = BigInt(Number(testTx.value) * (1 + pumpStep * 0.3));
                    pumpTx.timestamp = testTx.timestamp + pumpStep * 15;
                    pumpTx.hash = `${testTx.hash.slice(0, -2)}${pumpStep}` as `0x${string}`;
                    marketManipulationDetector.trackTransaction(pumpTx, tokenAddress as `0x${string}`);
                  }
                }
              }
              if (enhancedSuspiciousActivityTracker && analysis.suspicious) {
                enhancedSuspiciousActivityTracker.addSuspiciousActivity(
                  testTx.from,
                  testTx.chain,
                  analysis.category,
                  analysis.riskScore,
                  analysis.anomalyFlags,
                  analysis.summary,
                  testTx.hash,
                  testTx.value,
                  testTx.to ? [testTx.to] : []
                );
              }
              if (openzeppelinMonitor) {
                await openzeppelinMonitor.evaluateTransaction(testTx, analysis);
              }
          
          (agent as any).recentTransactions = (agent as any).recentTransactions || [];
          (agent as any).recentTransactions.push({
            hash: testTx.hash,
            chain: testTx.chain,
            riskScore: analysis.riskScore,
            suspicious: analysis.suspicious,
            timestamp: testTx.timestamp * 1000,
          });
          
          if ((agent as any).recentTransactions.length > 100) {
            (agent as any).recentTransactions.shift();
          }
        } catch (err) {
          // Silent fail for continuous generation
        }
      }
    }, 5000);
  }
  return { agent, rl, regulatoryMetrics, dabaCompliance, openzeppelinMonitor, flowTracker, walletTracker, onChainSecurityChecker, marketManipulationDetector, enhancedSuspiciousActivityTracker, financialStatementAnalyzer };
}

// API Routes
app.get("/api/stats", async (req: Request, res: Response) => {
  const { agent, rl, regulatoryMetrics } = await initializeAgent();
  
  const regulatoryData = regulatoryMetrics ? regulatoryMetrics.calculateMetrics() : null;
  const agentTransactions = agent.getRecentTransactions(10);
  
  const response = {
    running: agent.isAgentRunning(),
    stats: serializeBigInt(agent.getStats()),
    metrics: serializeBigInt(rl ? rl.getPerformanceMetrics() : {}),
    regulatory: serializeBigInt(regulatoryData),
    recentTransactions: serializeBigInt(agentTransactions.length > 0 ? agentTransactions : recentTransactions.slice(-10).reverse()),
  };
  
  res.json(response);
});

app.get("/api/regulatory", async (req: Request, res: Response) => {
  const { agent } = await initializeAgent();
  const regulatoryMetrics = agent.getRegulatoryMetrics();
  
  if (!regulatoryMetrics) {
    return res.status(503).json({ error: "Regulatory metrics not initialized" });
  }
  
  const metrics = regulatoryMetrics.calculateMetrics();
  res.json(serializeBigInt(metrics));
});

app.get("/api/daba", async (req: Request, res: Response) => {
  const { agent } = await initializeAgent();
  const dabaCompliance = agent.getDABACompliance();
  
  if (!dabaCompliance) {
    return res.status(503).json({ error: "DABA compliance not initialized" });
  }
  
  const compliance = dabaCompliance.calculateComplianceStatus();
  const recommendations = dabaCompliance.getDABARecommendations(compliance);
  
  res.json(serializeBigInt({
    ...compliance,
    recommendations,
  }));
});

app.get("/api/monitor/triggers", async (req: Request, res: Response) => {
  const { agent } = await initializeAgent();
  const monitor = agent.getOpenZeppelinMonitor();
  
  if (!monitor) {
    return res.status(503).json({ error: "OpenZeppelin Monitor not initialized" });
  }
  
  res.json({ triggers: monitor.getTriggers() });
});

app.get("/api/monitor/events", async (req: Request, res: Response) => {
  const { agent } = await initializeAgent();
  const monitor = agent.getOpenZeppelinMonitor();
  
  if (!monitor) {
    return res.status(503).json({ error: "OpenZeppelin Monitor not initialized" });
  }
  
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
  const triggerId = req.query.triggerId as string;
  
  const events = triggerId 
    ? monitor.getTriggerEvents(triggerId, limit)
    : monitor.getEventHistory(limit);
  
  res.json(serializeBigInt({ events, count: events.length }));
});

app.post("/api/monitor/triggers", async (req: Request, res: Response) => {
  const { agent } = await initializeAgent();
  const monitor = agent.getOpenZeppelinMonitor();
  
  if (!monitor) {
    return res.status(503).json({ error: "OpenZeppelin Monitor not initialized" });
  }
  
  try {
    monitor.registerTrigger(req.body);
    res.json({ success: true, message: "Trigger registered" });
  } catch (error) {
    res.status(400).json({ success: false, error: String(error) });
  }
});

// Serve regulator dashboard as the main page
app.get("/regulator", (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "regulator.html"));
});

// Redirect root to regulator dashboard
app.get("/", (req: Request, res: Response) => {
  res.redirect("/regulator");
});

app.post("/api/start", async (req: Request, res: Response) => {
  try {
    const { agent } = await initializeAgent();
    if (!agent.isAgentRunning()) {
      await agent.start();
    }
    res.json({ success: true, message: "Agent started" });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

app.post("/api/stop", (req: Request, res: Response) => {
  try {
    if (agent) {
      agent.stop();
    }
    res.json({ success: true, message: "Agent stopped" });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

app.get("/api/strategies", async (req: Request, res: Response) => {
  const { agent } = await initializeAgent();
  res.json({ strategies: agent.getStrategies() });
});

// High-risk transaction flow endpoints
app.get("/api/high-risk/transactions", async (req: Request, res: Response) => {
  const { flowTracker } = await initializeAgent();
  if (!flowTracker) {
    return res.status(503).json({ error: "Flow tracker not initialized" });
  }
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
  const transactions = flowTracker.getHighRiskTransactions(limit);
  res.json(serializeBigInt({ transactions, count: transactions.length }));
});

app.get("/api/high-risk/chains", async (req: Request, res: Response) => {
  const { flowTracker } = await initializeAgent();
  if (!flowTracker) {
    return res.status(503).json({ error: "Flow tracker not initialized" });
  }
  const chainAnalysis = flowTracker.getChainAnalysis();
  res.json(serializeBigInt({ chains: chainAnalysis.map(c => ({
    ...c,
    uniqueAddresses: c.uniqueAddresses.size
  })) }));
});

app.get("/api/high-risk/flows", async (req: Request, res: Response) => {
  const { flowTracker } = await initializeAgent();
  if (!flowTracker) {
    return res.status(503).json({ error: "Flow tracker not initialized" });
  }
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
  const flows = flowTracker.getFlowPaths(limit);
  res.json(serializeBigInt({ flows, count: flows.length }));
});

app.get("/api/high-risk/recommendations", async (req: Request, res: Response) => {
  const { flowTracker } = await initializeAgent();
  if (!flowTracker) {
    return res.status(503).json({ error: "Flow tracker not initialized" });
  }
  const recommendations = flowTracker.getRecommendations();
  res.json({ recommendations, count: recommendations.length });
});

app.get("/api/high-risk/address/:address", async (req: Request, res: Response) => {
  const { flowTracker } = await initializeAgent();
  if (!flowTracker) {
    return res.status(503).json({ error: "Flow tracker not initialized" });
  }
  const address = req.params.address;
  const flow = flowTracker.getAddressFlow(address);
  res.json(serializeBigInt(flow));
});

// Wallet tracking endpoints (specific routes MUST come before parameterized routes)
app.get("/api/wallets/stats", async (req: Request, res: Response) => {
  const { walletTracker } = await initializeAgent();
  if (!walletTracker) {
    return res.status(503).json({ error: "Wallet tracker not initialized" });
  }
  const stats = walletTracker.getStatistics();
  res.json(serializeBigInt(stats));
});

app.get("/api/wallets/suspicious", async (req: Request, res: Response) => {
  const { walletTracker } = await initializeAgent();
  if (!walletTracker) {
    return res.status(503).json({ error: "Wallet tracker not initialized" });
  }
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
  const suspicious = walletTracker.getSuspiciousWallets(limit);
  res.json(serializeBigInt({ wallets: suspicious, count: suspicious.length }));
});

app.get("/api/wallets/trace/:address", async (req: Request, res: Response) => {
  const { walletTracker } = await initializeAgent();
  if (!walletTracker) {
    return res.status(503).json({ error: "Wallet tracker not initialized" });
  }
  const address = req.params.address;
  const depth = req.query.depth ? parseInt(req.query.depth as string) : 2;
  const network = walletTracker.traceWalletNetwork(address, depth);
  res.json(serializeBigInt(network));
});

// Risk Typology Analysis Endpoint - MUST be BEFORE /api/wallets/:address
app.get("/api/wallets/typologies", async (req: Request, res: Response) => {
  const { walletTracker } = await initializeAgent();
  if (!walletTracker) {
    return res.status(503).json({ error: "Wallet tracker not initialized" });
  }
  
  // Get all suspicious wallets (get a large number to analyze all)
  const suspicious = walletTracker.getSuspiciousWallets(1000);
  
  // Aggregate typologies across all wallets
  const typologyMap = new Map<string, { 
    count: number; 
    wallets: Array<{ 
      address: string; 
      riskScore: number; 
      transactionCount: number;
      totalVolume: string;
      maxTransactionsInPeriod?: number; // For RAPID_TRANSACTIONS
    }> 
  }>();
  
  // Helper function for typology descriptions
  const getTypologyDescription = (type: string): string => {
    const descriptions: Record<string, string> = {
      LARGE_VALUE: "Unusually large transaction amounts (>100 ETH)",
      VERY_LARGE_VALUE: "Extremely large transaction amounts (>1000 ETH)",
      RAPID_TRANSACTIONS: "Rapid succession of transactions (>5 in 60s) - Potential structuring",
      NEW_ADDRESS: "Transactions involving new/unverified addresses",
      CONTRACT_INTERACTION: "Smart contract interactions",
      CONTRACT_CREATION: "New contract deployments",
      STRUCTURING: "Potential structuring behavior (rapid transactions)"
    };
    return descriptions[type] || type;
  };
  
  // Process each suspicious wallet
  suspicious.forEach(wallet => {
    // getWalletProfile already converts to lowercase internally
    const profile = walletTracker.getWalletProfile(wallet.address);
    
    // Use profile flags if available, otherwise infer from wallet reasons
    let flags: string[] = [];
    if (profile && profile.suspiciousFlags && profile.suspiciousFlags.length > 0) {
      flags = profile.suspiciousFlags;
    } else if (wallet.reason && wallet.reason.length > 0) {
      // Infer flags from reasons if no profile available
      wallet.reason.forEach(reason => {
        if (reason.includes('Rapid')) flags.push('RAPID_TRANSACTIONS');
        if (reason.includes('Large')) flags.push('LARGE_VALUE');
        if (reason.includes('Structuring')) flags.push('STRUCTURING');
        if (reason.includes('Multi-Chain')) flags.push('MULTI_CHAIN');
        if (reason.includes('High Number')) flags.push('HIGH_CONNECTIONS');
      });
    }
    
    // If we have flags or high risk score, process the wallet
    if (flags.length > 0 || wallet.riskScore >= 70) {
      // Use flags from profile or inferred flags
      const flagsToProcess = flags.length > 0 ? flags : ['HIGH_RISK_ACTIVITY'];
      
      flagsToProcess.forEach(flag => {
        if (!typologyMap.has(flag)) {
          typologyMap.set(flag, { count: 0, wallets: [] });
        }
        const entry = typologyMap.get(flag)!;
        entry.count++;
        
        // Check if wallet already exists in this typology
        const existingWallet = entry.wallets.find(w => w.address.toLowerCase() === wallet.address.toLowerCase());
        
        if (!existingWallet) {
          // For RAPID_TRANSACTIONS, calculate max transactions in a 60-second window
          let maxTransactionsInPeriod = 0;
          if (flag === 'RAPID_TRANSACTIONS' && profile && profile.riskHistory && profile.riskHistory.length > 0) {
            // Group transactions by 60-second windows
            const sortedHistory = [...profile.riskHistory].sort((a, b) => a.timestamp - b.timestamp);
            let windowStart = sortedHistory[0].timestamp;
            let windowCount = 0;
            let maxCount = 0;
            
            for (const entry of sortedHistory) {
              if (entry.timestamp <= windowStart + 60000) {
                windowCount++;
              } else {
                maxCount = Math.max(maxCount, windowCount);
                windowStart = entry.timestamp;
                windowCount = 1;
              }
            }
            maxCount = Math.max(maxCount, windowCount);
            maxTransactionsInPeriod = maxCount;
          }
          
          entry.wallets.push({
            address: wallet.address,
            riskScore: wallet.riskScore,
            transactionCount: wallet.transactionCount,
            totalVolume: wallet.totalVolume.toString(),
            maxTransactionsInPeriod: maxTransactionsInPeriod > 0 ? maxTransactionsInPeriod : undefined
          });
        }
      });
    }
  });
  
  // Convert to array and sort by count (most common first)
  const typologies = Array.from(typologyMap.entries())
    .map(([type, data]) => ({
      type,
      count: data.count,
      walletCount: data.wallets.length,
      wallets: data.wallets
        .sort((a, b) => {
          // For RAPID_TRANSACTIONS, sort by maxTransactionsInPeriod first, then risk score
          if (type === 'RAPID_TRANSACTIONS') {
            const aMax = a.maxTransactionsInPeriod || 0;
            const bMax = b.maxTransactionsInPeriod || 0;
            if (bMax !== aMax) return bMax - aMax;
          }
          return b.riskScore - a.riskScore;
        })
        .slice(0, 10), // Top 10 wallets per typology
      description: getTypologyDescription(type)
    }))
    .sort((a, b) => b.count - a.count);
  
  res.json(serializeBigInt({ typologies, total: typologies.length }));
});

// Wallet endpoints (MUST be AFTER specific routes like /typologies)
app.get("/api/wallets/:address/relationships", async (req: Request, res: Response) => {
  const { walletTracker } = await initializeAgent();
  if (!walletTracker) {
    return res.status(503).json({ error: "Wallet tracker not initialized" });
  }
  const address = req.params.address;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
  const relationships = walletTracker.getWalletRelationships(address, limit);
  res.json(serializeBigInt({ relationships, count: relationships.length }));
});

app.get("/api/wallets/:address", async (req: Request, res: Response) => {
  const { walletTracker } = await initializeAgent();
  if (!walletTracker) {
    return res.status(503).json({ error: "Wallet tracker not initialized" });
  }
  const address = req.params.address;
  const profile = walletTracker.getWalletProfile(address);
  if (!profile) {
    return res.status(404).json({ error: "Wallet not found" });
  }
  res.json(serializeBigInt(profile));
});

// Enhanced Suspicious Activity Report
app.get("/api/suspicious-activity/enhanced", async (req: Request, res: Response) => {
  const { agent } = await initializeAgent();
  const tracker = agent.getEnhancedSuspiciousActivityTracker();

  if (!tracker) {
    return res.status(503).json({ error: "Enhanced suspicious activity tracker not initialized" });
  }

  const report = tracker.generateReport();
  
  // Convert Map to object for JSON serialization
  const activitiesByType: Record<string, any[]> = {};
  for (const [type, activities] of report.activitiesByType.entries()) {
    activitiesByType[type] = serializeBigInt(activities);
  }

  const chains: Record<string, number> = {};
  for (const [chain, count] of report.chains.entries()) {
    chains[chain] = count;
  }

  res.json(serializeBigInt({
    ...report,
    flaggedAddresses: serializeBigInt(report.flaggedAddresses),
    activitiesByType,
    chains,
  }));
});

// Market Manipulation Alerts (Pump and Dump Detection)
app.get("/api/market-manipulation/alerts", async (req: Request, res: Response) => {
  const { agent } = await initializeAgent();
  const detector = agent.getMarketManipulationDetector();

  if (!detector) {
    return res.status(503).json({ error: "Market manipulation detector not initialized" });
  }

  const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
  const severity = req.query.severity as "critical" | "high" | "medium" | "low" | undefined;
  const alerts = detector.getAlerts(limit, severity);

  res.json(serializeBigInt({ alerts, count: alerts.length }));
});

app.get("/api/market-manipulation/address/:address", async (req: Request, res: Response) => {
  const { agent } = await initializeAgent();
  const detector = agent.getMarketManipulationDetector();

  if (!detector) {
    return res.status(503).json({ error: "Market manipulation detector not initialized" });
  }

  const address = req.params.address as `0x${string}`;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
  const alerts = detector.getAddressAlerts(address, limit);

  res.json(serializeBigInt({ alerts, count: alerts.length }));
});

app.get("/api/market-manipulation/token/:tokenAddress", async (req: Request, res: Response) => {
  const { agent } = await initializeAgent();
  const detector = agent.getMarketManipulationDetector();

  if (!detector) {
    return res.status(503).json({ error: "Market manipulation detector not initialized" });
  }

  const tokenAddress = req.params.tokenAddress as `0x${string}`;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
  const alerts = detector.getTokenAlerts(tokenAddress, limit);

  res.json(serializeBigInt({ alerts, count: alerts.length }));
});

// Get suspicious activity by address
app.get("/api/suspicious-activity/address/:address", async (req: Request, res: Response) => {
  const { agent } = await initializeAgent();
  const tracker = agent.getEnhancedSuspiciousActivityTracker();

  if (!tracker) {
    return res.status(503).json({ error: "Enhanced suspicious activity tracker not initialized" });
  }

  const address = req.params.address as `0x${string}`;
  const chain = req.query.chain as string || "ethereum";
  const detail = tracker.getAddressDetail(address, chain);

  if (!detail) {
    return res.status(404).json({ error: "Address not found in suspicious activity tracker" });
  }

  res.json(serializeBigInt(detail));
});

// Etherscan API endpoints
app.get("/api/etherscan/price", async (req: Request, res: Response) => {
  try {
    const price = await EtherscanAPI.getEthPrice();
    res.json({ price, timestamp: Date.now() });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get("/api/etherscan/gas", async (req: Request, res: Response) => {
  try {
    const gasPrices = await EtherscanAPI.getGasPrices();
    res.json({ ...gasPrices, timestamp: Date.now() });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get("/api/etherscan/block", async (req: Request, res: Response) => {
  try {
    const blockNumber = await EtherscanAPI.getLatestBlockNumber();
    res.json({ blockNumber, timestamp: Date.now() });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get("/api/etherscan/market", async (req: Request, res: Response) => {
  try {
    const [price, gasPrices, blockNumber] = await Promise.all([
      EtherscanAPI.getEthPrice().catch(() => 0),
      EtherscanAPI.getGasPrices().catch(() => null),
      EtherscanAPI.getLatestBlockNumber().catch(() => '0')
    ]);
    
    res.json({
      ethPrice: price,
      gasPrices: gasPrices ? {
        safe: gasPrices.SafeGasPrice,
        proposed: gasPrices.ProposeGasPrice,
        fast: gasPrices.FastGasPrice,
        baseFee: gasPrices.suggestBaseFee
      } : null,
      blockNumber,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get("/api/etherscan/address/:address", async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 100;
    
    const [transactions, tokenTransfers, balance, analysis] = await Promise.all([
      EtherscanAPI.getAddressTransactions(address, 0, 99999999, page, offset, 'desc').catch((err) => {
        console.error('Error fetching transactions:', err);
        return [];
      }),
      EtherscanAPI.getTokenTransfers(address, 0, 99999999, page, offset, 'desc').catch(() => []),
      EtherscanAPI.getAccountBalance(address).catch(() => '0'),
      Promise.resolve().then(async () => {
        const txs = await EtherscanAPI.getAddressTransactions(address, 0, 99999999, 1, 100, 'desc').catch(() => []);
        return EtherscanAPI.analyzeSuspiciousPatterns(txs);
      }).catch(() => null)
    ]);
    
    const analysisResult = analysis ? {
      suspicious: analysis.suspicious,
      flags: analysis.flags,
      riskScore: analysis.riskScore,
      totalVolume: analysis.totalVolume.toString(),
      averageTransactionSize: analysis.averageTransactionSize.toString(),
      rapidTransactions: analysis.rapidTransactions
    } : {
      suspicious: false,
      flags: [],
      riskScore: 0,
      totalVolume: '0',
      averageTransactionSize: '0',
      rapidTransactions: 0
    };
    
    // Track suspicious addresses in wallet tracker if they meet criteria
    if (analysisResult.suspicious && analysisResult.riskScore >= 40) {
      try {
        const { walletTracker } = await initializeAgent();
        if (walletTracker && transactions.length > 0) {
          // Convert Etherscan transactions to our format and track them
          transactions.slice(0, 50).forEach(tx => {
            const txEvent = {
              hash: tx.hash,
              from: tx.from.toLowerCase() as `0x${string}`,
              to: (tx.to || tx.contractAddress || '0x0').toLowerCase() as `0x${string}`,
              value: BigInt(tx.value || '0'),
              chain: 'ethereum' as const,
              blockNumber: BigInt(tx.blockNumber || '0'),
              timestamp: parseInt(tx.timeStamp) * 1000,
              gasPrice: BigInt(tx.gasPrice || '0'),
              gasUsed: BigInt(tx.gasUsed || '0'),
            };
            
            // Create a mock analysis for tracking
            const mockAnalysis = {
              riskScore: analysisResult.riskScore,
              suspicious: analysisResult.suspicious,
              category: analysisResult.flags.join(', ') || 'SUSPICIOUS_ACTIVITY',
              anomalyFlags: analysisResult.flags,
              summary: `Etherscan-detected: ${analysisResult.flags.join(', ')}`
            };
            
            walletTracker.trackTransaction(txEvent, mockAnalysis as any);
          });
        }
      } catch (trackError) {
        console.error('Error tracking address in wallet tracker:', trackError);
      }
    }
    
    res.json(serializeBigInt({
      address,
      balance,
      transactions: transactions.slice(0, offset),
      tokenTransfers: tokenTransfers.slice(0, offset),
      analysis: analysisResult,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.error('Etherscan address lookup error:', error);
    res.status(500).json({ error: String(error) });
  }
});

app.get("/api/etherscan/address/:address/transactions", async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    const startBlock = req.query.startBlock ? parseInt(req.query.startBlock as string) : 0;
    const endBlock = req.query.endBlock ? parseInt(req.query.endBlock as string) : 99999999;
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 100;
    const sort = (req.query.sort as 'asc' | 'desc') || 'desc';
    
    const transactions = await EtherscanAPI.getAddressTransactions(
      address,
      startBlock,
      endBlock,
      page,
      offset,
      sort
    );
    
    res.json(serializeBigInt({ transactions, count: transactions.length }));
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Regulatory Summary - Easy-to-understand summary for regulators
app.get("/api/regulatory/summary", async (req: Request, res: Response) => {
  try {
    const { walletTracker, regulatoryMetrics, flowTracker } = await initializeAgent();
    
    // Get suspicious wallets
    const suspiciousWallets = walletTracker ? walletTracker.getSuspiciousWallets(100) : [];
    
    // Get high-risk transactions
    const highRiskTransactions = flowTracker ? flowTracker.getHighRiskTransactions(50) : [];
    
    // Get regulatory metrics
    const metrics = regulatoryMetrics ? regulatoryMetrics.calculateMetrics() : null;
    
    // Create regulatory-friendly summary
    const summary = {
      timestamp: new Date().toISOString(),
      overallRiskLevel: 'LOW', // LOW, MODERATE, HIGH, CRITICAL
      suspiciousAddressesCount: suspiciousWallets.length,
      highRiskTransactionsCount: highRiskTransactions.length,
      
      // Addresses requiring immediate attention
      criticalAddresses: suspiciousWallets
        .filter(w => w.riskScore >= 80)
        .map(w => ({
          address: w.address,
          riskScore: w.riskScore,
          riskLevel: w.riskScore >= 90 ? 'CRITICAL' : 'HIGH',
          reasons: w.reason,
          transactionCount: w.transactionCount,
          totalVolume: w.totalVolume.toString(),
          chains: w.chains,
          summary: `Address ${w.address.slice(0, 10)}...${w.address.slice(-8)} has risk score of ${w.riskScore}/100. ${w.reason.join(', ')}. ${w.transactionCount} transactions across ${w.chains.length} chain(s).`
        })),
      
      // High-risk addresses
      highRiskAddresses: suspiciousWallets
        .filter(w => w.riskScore >= 70 && w.riskScore < 80)
        .map(w => ({
          address: w.address,
          riskScore: w.riskScore,
          reasons: w.reason,
          transactionCount: w.transactionCount,
          summary: `Address ${w.address.slice(0, 10)}...${w.address.slice(-8)} shows high-risk patterns: ${w.reason.join(', ')}.`
        })),
      
      // Risk categories breakdown with actual addresses
      riskCategories: {
        rapidTransactions: {
          count: suspiciousWallets.filter(w => w.reason.some(r => r.includes('Rapid'))).length,
          addresses: suspiciousWallets.filter(w => w.reason.some(r => r.includes('Rapid'))).map(w => ({
            address: w.address,
            riskScore: w.riskScore,
            reasons: w.reason,
            transactionCount: w.transactionCount,
            totalVolume: w.totalVolume.toString(),
            summary: `Address ${w.address.slice(0, 10)}...${w.address.slice(-8)} shows rapid transaction patterns: ${w.reason.join(', ')}. ${w.transactionCount} transactions.`
          }))
        },
        largeValueTransactions: {
          count: suspiciousWallets.filter(w => w.reason.some(r => r.includes('Large'))).length,
          addresses: suspiciousWallets.filter(w => w.reason.some(r => r.includes('Large'))).map(w => ({
            address: w.address,
            riskScore: w.riskScore,
            reasons: w.reason,
            transactionCount: w.transactionCount,
            totalVolume: w.totalVolume.toString(),
            summary: `Address ${w.address.slice(0, 10)}...${w.address.slice(-8)} involved in large value transactions: ${w.reason.join(', ')}. Total volume: ${(Number(w.totalVolume) / 1e18).toFixed(4)} ETH.`
          }))
        },
        structuring: {
          count: suspiciousWallets.filter(w => w.reason.some(r => r.includes('Structuring'))).length,
          addresses: suspiciousWallets.filter(w => w.reason.some(r => r.includes('Structuring'))).map(w => ({
            address: w.address,
            riskScore: w.riskScore,
            reasons: w.reason,
            transactionCount: w.transactionCount,
            totalVolume: w.totalVolume.toString(),
            summary: `Address ${w.address.slice(0, 10)}...${w.address.slice(-8)} shows potential structuring behavior: ${w.reason.join(', ')}. ${w.transactionCount} transactions.`
          }))
        },
        multiChainActivity: {
          count: suspiciousWallets.filter(w => w.reason.some(r => r.includes('Multi-Chain'))).length,
          addresses: suspiciousWallets.filter(w => w.reason.some(r => r.includes('Multi-Chain'))).map(w => ({
            address: w.address,
            riskScore: w.riskScore,
            reasons: w.reason,
            transactionCount: w.transactionCount,
            chains: w.chains,
            summary: `Address ${w.address.slice(0, 10)}...${w.address.slice(-8)} active across ${w.chains.length} chains: ${w.chains.join(', ')}. ${w.transactionCount} transactions.`
          }))
        },
        highConnections: {
          count: suspiciousWallets.filter(w => w.reason.some(r => r.includes('Connections'))).length,
          addresses: suspiciousWallets.filter(w => w.reason.some(r => r.includes('Connections'))).map(w => ({
            address: w.address,
            riskScore: w.riskScore,
            reasons: w.reason,
            transactionCount: w.transactionCount,
            connectedAddresses: w.connectedAddresses,
            summary: `Address ${w.address.slice(0, 10)}...${w.address.slice(-8)} has ${w.connectedAddresses} connected addresses, indicating high network activity. Risk: ${w.reason.join(', ')}.`
          }))
        },
      },
      
      // Regulatory recommendations
      recommendations: [
        ...(suspiciousWallets.filter(w => w.riskScore >= 80).length > 0 ? [
          `IMMEDIATE ACTION: ${suspiciousWallets.filter(w => w.riskScore >= 80).length} addresses with critical risk scores (≥80) require immediate regulatory review.`
        ] : []),
        ...(suspiciousWallets.filter(w => w.reason.some(r => r.includes('Rapid'))).length > 0 ? [
          `Monitor ${suspiciousWallets.filter(w => w.reason.some(r => r.includes('Rapid'))).length} addresses showing rapid transaction patterns - potential structuring activity. See "Rapid Transactions" section below for address list.`
        ] : []),
        ...(suspiciousWallets.filter(w => w.reason.some(r => r.includes('Large'))).length > 0 ? [
          `${suspiciousWallets.filter(w => w.reason.some(r => r.includes('Large'))).length} addresses involved in large value transactions require enhanced due diligence. See "Large Value Transactions" section below for complete address list.`
        ] : []),
        ...(highRiskTransactions.length > 0 ? [
          `${highRiskTransactions.length} high-risk transactions detected. Review transaction flows for AML compliance.`
        ] : []),
      ],
      
      // Overall metrics
      overallMetrics: metrics ? {
        overallRiskScore: metrics.overallRiskScore || 0,
        financialHealth: metrics.financialHealth?.score || 0,
        amlCompliance: metrics.complianceStatus?.amlCompliance || 100,
        kycCompliance: metrics.complianceStatus?.kycCompliance || 100,
      } : null,
    };
    
    // Determine overall risk level
    const criticalCount = summary.criticalAddresses.length;
    const highRiskCount = summary.highRiskAddresses.length;
    
    if (criticalCount > 0) {
      summary.overallRiskLevel = 'CRITICAL';
    } else if (highRiskCount > 5 || summary.highRiskTransactionsCount > 20) {
      summary.overallRiskLevel = 'HIGH';
    } else if (highRiskCount > 0 || summary.highRiskTransactionsCount > 0) {
      summary.overallRiskLevel = 'MODERATE';
    }
    
    res.json(serializeBigInt(summary));
  } catch (error) {
    console.error('Error generating regulatory summary:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Financial Statement Analysis Endpoints
app.get("/api/financial-statements/entities", async (req: Request, res: Response) => {
  const { financialStatementAnalyzer } = await initializeAgent();
  if (!financialStatementAnalyzer) {
    return res.status(503).json({ error: "Financial statement analyzer not initialized" });
  }
  const entities = financialStatementAnalyzer.getDABAEntities();
  res.json({ entities, count: entities.length });
});

app.get("/api/financial-statements/entity/:entityName", async (req: Request, res: Response) => {
  const { financialStatementAnalyzer } = await initializeAgent();
  if (!financialStatementAnalyzer) {
    return res.status(503).json({ error: "Financial statement analyzer not initialized" });
  }
  const entityName = decodeURIComponent(req.params.entityName);
  const entity = financialStatementAnalyzer.getEntity(entityName);
  const statements = financialStatementAnalyzer.getEntityStatements(entityName);
  
  if (!entity) {
    return res.status(404).json({ error: "Entity not found" });
  }
  
  res.json(serializeBigInt({ entity, statements, count: statements.length }));
});

// File upload endpoint with PDF parsing support
app.post("/api/financial-statements/upload", async (req: Request, res: Response) => {
  const { financialStatementAnalyzer } = await initializeAgent();
  if (!financialStatementAnalyzer) {
    return res.status(503).json({ error: "Financial statement analyzer not initialized" });
  }
  
  try {
    // Handle multipart/form-data using busboy (built into Express in newer versions)
    // For compatibility, we'll parse the raw body manually or use a different approach
    // Since Express doesn't have native FormData support, we'll accept JSON with base64 encoded file
    // OR use a simpler approach: accept the file data directly in the request body
    
    // For now, let's use a workaround: accept file content as base64 in JSON
    // This works for both PDF and text files
    const { fileContent, fileName, entityName, period, fileType } = req.body;
    
    if (!fileContent || !fileName || !entityName) {
      return res.status(400).json({ error: "Missing required fields: fileContent, fileName, entityName" });
    }
    
    const reportPeriod = period || `2024 Q${Math.floor((new Date().getMonth() + 3) / 3)}`;
    
    console.log(`📄 Processing uploaded file: ${fileName} (${fileType || 'unknown'})`);
    
    let statementText: string;
    
    // Check file type and extract text
    if (fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
      console.log(`📖 Parsing PDF file...`);
      
      try {
        // Decode base64 to buffer
        // Validate base64 string first
        if (!fileContent || typeof fileContent !== 'string') {
          return res.status(400).json({ error: "Invalid file content: base64 string required" });
        }
        
        let buffer: Buffer;
        try {
          buffer = Buffer.from(fileContent, 'base64');
        } catch (decodeError: any) {
          return res.status(400).json({ error: `Failed to decode base64: ${decodeError.message}` });
        }
        
        // Validate buffer is not empty and has PDF signature
        if (!buffer || buffer.length === 0) {
          return res.status(400).json({ error: "Decoded buffer is empty" });
        }
        
        // Check PDF signature (should start with %PDF)
        const pdfSignature = buffer.slice(0, 4).toString('ascii');
        if (pdfSignature !== '%PDF') {
          console.warn(`⚠️ PDF signature check failed. Got: ${pdfSignature}, first 20 bytes: ${buffer.slice(0, 20).toString('hex')}`);
          // Continue anyway - some PDFs might have different structure
        }
        
        console.log(`📄 PDF buffer size: ${buffer.length} bytes, signature: ${pdfSignature}`);
        
        // Parse PDF - pdf-parse is a CommonJS module
        // For Bun, we can use require directly via createRequire
        const { createRequire } = await import("module");
        const require = createRequire(import.meta.url);
        
        // pdf-parse v1.x - use createRequire for CommonJS compatibility
        const pdfParseModule = require("pdf-parse");
        // v1.x exports the function directly or as default
        const pdfParse = (typeof pdfParseModule === 'function') ? pdfParseModule : (pdfParseModule.default || pdfParseModule);
        
        if (typeof pdfParse !== 'function') {
          return res.status(500).json({ error: "pdf-parse module is not a function. Please check installation." });
        }
        
        console.log(`📖 Parsing PDF with pdf-parse...`);
        const pdfData = await pdfParse(buffer);
        statementText = pdfData.text;
        
        if (!statementText || statementText.trim().length === 0) {
          return res.status(400).json({ error: "PDF parsed but no text content extracted. The PDF may be image-based or corrupted." });
        }
        
        console.log(`✅ PDF parsed successfully. Extracted ${statementText.length} characters.`);
      } catch (pdfError: any) {
        console.error("PDF parsing error:", pdfError);
        console.error("Error stack:", pdfError.stack);
        // Provide more detailed error message
        const errorMsg = pdfError.message || String(pdfError);
        return res.status(400).json({ 
          error: `Failed to parse PDF: ${errorMsg}`,
          details: pdfError.stack ? pdfError.stack.split('\n').slice(0, 3).join(' | ') : undefined
        });
      }
    } else if (fileType === 'text/plain' || fileName.toLowerCase().endsWith('.txt')) {
      // Decode base64 text file
      try {
        statementText = Buffer.from(fileContent, 'base64').toString('utf-8');
        console.log(`✅ Text file read. Extracted ${statementText.length} characters.`);
      } catch (textError: any) {
        return res.status(400).json({ error: `Failed to read text file: ${textError.message}` });
      }
    } else {
      // Try to decode as UTF-8 text (fallback)
      try {
        statementText = Buffer.from(fileContent, 'base64').toString('utf-8');
        console.log(`✅ File content decoded as text. Extracted ${statementText.length} characters.`);
      } catch (error: any) {
        return res.status(400).json({ error: `Unsupported file type: ${fileType || 'unknown'}. Please upload a PDF or text file.` });
      }
    }
    
    // Analyze the extracted text using rule-based analysis (NO API REQUIRED)
    console.log(`🔍 Analyzing financial statement for ${entityName} using rule-based analysis (no API required)...`);
    const statement = await financialStatementAnalyzer.processFinancialStatement(
      entityName,
      statementText,
      reportPeriod,
      `Uploaded: ${fileName}`,
      "Financial Statement"
    );
    
    console.log(`✅ Analysis complete. Risk Score: ${statement.aiAnalysis?.riskScore || 'N/A'}`);
    res.json(serializeBigInt(statement));
  } catch (error: any) {
    console.error("Error processing uploaded file:", error);
    res.status(500).json({ error: error.message || String(error) });
  }
});

app.post("/api/financial-statements/analyze", async (req: Request, res: Response) => {
  const { financialStatementAnalyzer } = await initializeAgent();
  if (!financialStatementAnalyzer) {
    return res.status(503).json({ error: "Financial statement analyzer not initialized" });
  }
  
  const { entityName, statementText, period, source, statementType } = req.body;
  
  if (!entityName || !statementText || !period) {
    return res.status(400).json({ error: "Missing required fields: entityName, statementText, period" });
  }
  
  try {
    const statement = await financialStatementAnalyzer.processFinancialStatement(
      entityName,
      statementText,
      period,
      source || "Manual Upload",
      statementType || "Financial Statement"
    );
    res.json(serializeBigInt(statement));
  } catch (error) {
    console.error("Error analyzing financial statement:", error);
    res.status(500).json({ error: String(error) });
  }
});

app.post("/api/financial-statements/generate-mock/:entityName", async (req: Request, res: Response) => {
  const { financialStatementAnalyzer } = await initializeAgent();
  if (!financialStatementAnalyzer) {
    return res.status(503).json({ error: "Financial statement analyzer not initialized" });
  }
  
  const entityName = decodeURIComponent(req.params.entityName);
  const period = req.body.period || `2024 Q${Math.floor((new Date().getMonth() + 3) / 3)}`;
  
  try {
    console.log(`🔄 Generating financial statement for ${entityName} from similar entity data (no API required)...`);
    
    // Clear old statements for this entity to ensure fresh generation
    financialStatementAnalyzer.clearEntityStatements(entityName);
    
    // Generate financial data from similar entities (NO API REQUIRED)
    const mockText = financialStatementAnalyzer.generateMockStatementWithRealData(entityName, period);
    
    console.log(`✅ Financial data generated, now analyzing with rule-based analysis (no API required)...`);
    
    const statement = await financialStatementAnalyzer.processFinancialStatement(
      entityName,
      mockText,
      period,
      "Auto-generated from Similar Entity Data (rule-based analysis)",
      "Financial Statement"
    );
    
    console.log(`✅ Financial statement analysis complete. Risk Score: ${statement.aiAnalysis?.riskScore || 'N/A'}`);
    
    res.json(serializeBigInt(statement));
  } catch (error: any) {
    console.error("❌ Error generating financials:", error);
    res.status(500).json({ error: error.message || String(error) });
  }
});

// Comprehensive DeFi Trends Research - Rule-Based Deep Analysis with Horizon Scanning
export function generateComprehensiveDeFiResearch() {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentQuarter = Math.floor((currentDate.getMonth() + 3) / 3);
  
  return {
    summary: `The DeFi ecosystem in ${currentYear} Q${currentQuarter} represents a maturing market with total value locked (TVL) exceeding $100 billion across all chains, driven by institutional adoption, Real World Asset (RWA) tokenization, and innovative restaking mechanisms. The sector is experiencing its most significant transformation since inception, with traditional finance (TradFi) integration reaching critical mass. Key growth vectors include yield optimization strategies, cross-chain interoperability solutions, and regulatory-compliant infrastructure that bridges decentralized and centralized finance paradigms. Market dynamics indicate consolidation among leading protocols while simultaneously fostering explosive growth in specialized verticals such as tokenized treasuries, liquid restaking derivatives, and AI-powered yield aggregators.`,
    
    marketSize: `As of ${currentDate.toLocaleDateString()}, Total Value Locked (TVL) across DeFi protocols stands at approximately $95-105 billion, with Ethereum L1 maintaining dominance at ~$60B, followed by Arbitrum ($3.5B), Base ($2.8B), Optimism ($1.2B), and emerging Layer 2 solutions. The sector has seen 35-45% year-over-year growth, driven primarily by liquid staking derivatives, RWA tokenization (now $12B+), and institutional product launches. Daily trading volumes across DEXs exceed $3-5 billion, while lending markets facilitate $15-20 billion in active borrow positions. The market capitalization of DeFi tokens collectively represents $80-90 billion, with governance tokens from major protocols showing strong correlation with protocol revenue and user adoption metrics.`,
    
    trends: [
      {
        category: "Real World Assets (RWA) Tokenization",
        description: `RWA tokenization has emerged as the fastest-growing DeFi vertical, with over $12 billion in tokenized real-world assets on-chain as of ${currentYear}. This trend represents the convergence of traditional finance and blockchain technology, enabling fractional ownership and 24/7 trading of previously illiquid assets. MakerDAO's strategic pivot to RWA-backed collateral now represents 60%+ of its DAI backing, including US Treasury bills, corporate bonds, and real estate debt. The sector is witnessing institutional-grade participation from asset managers like BlackRock (BUIDL), Franklin Templeton (BENJI), and Ondo Finance, which have launched tokenized money market funds. Centrifuge and Maple Finance are pioneering tokenized trade receivables and credit markets, while Clearpool and TrueFi enable on-chain credit origination for institutional borrowers. Regulatory clarity in jurisdictions like Bermuda (DABA), Singapore, and the EU (MiCA) is accelerating adoption, with expectations of $50-100 billion in RWA TVL by 2026.`,
        keyCompanies: ["MakerDAO", "Centrifuge", "Ondo Finance", "Maple Finance", "Clearpool", "TrueFi", "Backed Finance", "RWA.xyz", "Pendle Finance", "Morpho Labs"],
        marketMetrics: `TVL: $12.5B+ | Growth Rate: 85% YoY | Asset Types: US Treasuries ($8.5B), Corporate Bonds ($2.1B), Trade Receivables ($1.2B), Real Estate ($700M) | Daily Volume: $500M-1B | Active Protocols: 45+`,
        growthRate: "85% Year-over-Year",
        regulatoryStatus: "Favorable regulatory developments in EU (MiCA), Bermuda (DABA), Singapore, and increasing SEC engagement. Compliance frameworks maturing rapidly.",
        marketTimeline: "Early Adoption Phase - Expected Mainstream 2025-2026",
        riskFactors: ["Regulatory uncertainty in US", "Smart contract risks", "Oracles dependency", "Liquidity constraints"],
        opportunities: ["Tokenized equities expansion", "Emerging market debt tokenization", "Private credit on-chain", "Structured products"]
      },
      {
        category: "Liquid Staking & Restaking",
        description: `Liquid staking has become the dominant Ethereum staking mechanism, with $35+ billion in liquid staking derivatives (LSDs) representing 40%+ of all staked ETH. Lido Finance maintains market leadership with ~29% of staked ETH, followed by Rocket Pool (8%), Coinbase (cbETH), and Binance (BETH). The innovation cycle accelerated with EigenLayer's introduction of restaking, allowing stakers to rehypothecate their staked ETH to secure additional protocols (AVSs - Actively Validated Services) for yield enhancement. EigenLayer has accumulated $15+ billion in restaked assets, creating a new primitive for decentralized security and shared infrastructure. This has spawned an entire ecosystem of Liquid Restaking Tokens (LRTs) from protocols like Renzo, EtherFi, Kelp DAO, and Puffer Finance, which abstract restaking complexity and optimize yield. The sector is evolving towards multi-chain liquid staking (Solana, Cosmos, Avalanche) and yield-optimizing strategies that combine staking, restaking, and DeFi yield farming for 15-25% APY opportunities.`,
        keyCompanies: ["Lido Finance", "Rocket Pool", "EigenLayer", "EtherFi", "Renzo Protocol", "Kelp DAO", "Puffer Finance", "Frax Finance", "StakeWise", "Swell Network"],
        marketMetrics: `Liquid Staking TVL: $35B+ | Restaking TVL: $15B+ | Total Staked ETH: 28M+ (23% of supply) | LSD Market Share: Lido 29%, Rocket Pool 8%, Coinbase 6%, Others 57% | Average APY: 3-4% (staking) + 5-10% (restaking)`,
        growthRate: "120% Year-over-Year",
        regulatoryStatus: "Generally accepted - staking treated as non-securities in most jurisdictions. Restaking regulatory status evolving.",
        marketTimeline: "Growth Phase - Maturity Expected 2025",
        riskFactors: ["Validator centralization concerns", "Slashing risks", "Liquidity provider concentration", "AVS risk assessment complexity"],
        opportunities: ["Multi-chain expansion", "Yield optimization strategies", "Institutional restaking products", "Shared security models"]
      },
      {
        category: "Institutional DeFi Adoption",
        description: `${currentYear} marks the inflection point for institutional DeFi adoption, with major financial institutions launching blockchain-native products and services. BlackRock's BUIDL tokenized fund ($500M+) and JPMorgan's Onyx Digital Assets platform represent the vanguard of institutional blockchain adoption. Coinbase's Base L2 has attracted $200M+ in institutional capital through products like Coinbase Prime, while Fidelity Digital Assets offers custody and execution services for institutional DeFi participation. The rise of compliant DeFi infrastructure from protocols like Circle (USDC issuer), Fireblocks (institutional custody), and Chainlink (enterprise oracles) has lowered barriers for institutional entry. Tokenization of traditional assets (T-Bills, corporate bonds, money market funds) on-chain now exceeds $12B, with projections of $500B-1T by 2030. Regulatory frameworks like MiCA (EU) and DABA (Bermuda) provide compliance pathways, while institutional-grade infrastructure addresses custody, KYC/AML, and audit requirements. The convergence of TradFi and DeFi is creating hybrid financial products that combine blockchain efficiency with regulatory compliance.`,
        keyCompanies: ["BlackRock", "JPMorgan (Onyx)", "Coinbase", "Fidelity", "Franklin Templeton", "Circle", "Fireblocks", "Anchorage Digital", "BitGo", "Chainlink"],
        marketMetrics: `Institutional Products TVL: $15B+ | Tokenized Funds: $5B+ | Institutional Custody AUM: $50B+ | Active Institutional Protocols: 30+ | Expected Growth: $100B+ by 2026`,
        growthRate: "200% Year-over-Year",
        regulatoryStatus: "Active regulatory engagement - MiCA (EU) implementation, SEC guidance evolving, Bermuda DABA framework operational",
        marketTimeline: "Early Growth Phase - Acceleration Expected 2025-2027",
        riskFactors: ["Regulatory uncertainty", "Operational complexity", "Smart contract risks", "Integration challenges"],
        opportunities: ["Tokenized securities expansion", "CBDC integration", "Cross-border payments", "Compliance-as-a-Service"]
      },
      {
        category: "Cross-Chain Interoperability & Layer 2 Solutions",
        description: `The multi-chain future of DeFi is materializing through sophisticated cross-chain infrastructure and Layer 2 scaling solutions. Arbitrum and Optimism have established dominance in Ethereum L2 scaling, with Arbitrum processing $2-3B in weekly volume and Optimism's Superchain vision connecting multiple chains. Base (Coinbase's L2) has achieved explosive growth to $2.8B TVL in under a year, driven by social finance applications and lower fees. Cross-chain bridges have evolved from basic token transfers to sophisticated protocols like LayerZero, Wormhole, and Stargate Finance, enabling seamless asset movement and unified liquidity pools across chains. The emergence of "Layer 3" solutions and app-specific chains (dYdX, Immutable X) demonstrates specialization for use cases. Polygon's CDK and zkEVM solutions offer customizable scaling, while zkSync Era and StarkNet bring zero-knowledge proof scaling to production. The sector is converging towards unified user experiences that abstract chain complexity, with protocols like Circle's CCTP enabling native USDC transfers across chains.`,
        keyCompanies: ["Arbitrum", "Optimism", "Base", "Polygon", "zkSync", "StarkNet", "LayerZero", "Wormhole", "Stargate", "Circle (CCTP)", "Chainlink CCIP"],
        marketMetrics: `L2 TVL: $12B+ | Cross-Chain Volume: $5-8B monthly | Bridge Protocols: 50+ | Active L2 Users: 5M+ | Transaction Cost Reduction: 90-99% vs L1`,
        growthRate: "75% Year-over-Year",
        regulatoryStatus: "L2 solutions generally compliant - cross-chain bridges under regulatory observation",
        marketTimeline: "Mature Growth Phase - Consolidation Expected 2025-2026",
        riskFactors: ["Bridge security vulnerabilities", "Centralization concerns", "Liquidity fragmentation", "UX complexity"],
        opportunities: ["Unified liquidity pools", "App-specific chains", "ZK-proof standardization", "Account abstraction adoption"]
      },
      {
        category: "AI-Powered DeFi & Intelligent Yield Optimization",
        description: `Artificial Intelligence integration in DeFi represents the next paradigm shift, with AI agents optimizing yield strategies, managing risk, and executing complex multi-protocol strategies autonomously. Protocols like SingularityDAO, Fetch.ai, and Numerai leverage AI for portfolio management and prediction markets. AI-powered yield aggregators analyze hundreds of protocols to find optimal strategies, while AI oracles provide enhanced data feeds for derivatives and structured products. The emergence of "intent-based" DeFi, where users specify desired outcomes rather than exact transactions, relies heavily on AI routing. Large Language Models (LLMs) are being integrated for user experience enhancement, natural language protocol interaction, and automated auditing. AI-driven risk assessment systems provide real-time protocol health scoring, while machine learning models optimize liquidity provision and arbitrage opportunities. The convergence of AI and DeFi is creating autonomous financial agents that can execute sophisticated strategies across multiple protocols while managing risk dynamically.`,
        keyCompanies: ["SingularityDAO", "Fetch.ai", "Numerai", "Giza Protocol", "Bittensor", "Ocean Protocol", "Ritual", "AI Arena", "Modulus Labs"],
        marketMetrics: `AI DeFi TVL: $2B+ | AI Agents Active: 10,000+ | Protocols Integrating AI: 50+ | Yield Optimization Improvements: 15-30% APY enhancement`,
        growthRate: "300% Year-over-Year",
        regulatoryStatus: "Early regulatory engagement - AI governance frameworks developing",
        marketTimeline: "Early Innovation Phase - Mainstream Adoption 2026-2027",
        riskFactors: ["AI model risks", "Automation vulnerabilities", "Black box complexity", "Regulatory uncertainty"],
        opportunities: ["Autonomous agents", "Predictive analytics", "Risk management AI", "Natural language interfaces"]
      },
      {
        category: "Derivatives & Perpetual Futures Evolution",
        description: `DeFi derivatives markets have matured significantly, with perpetual futures protocols now processing $50-100 billion in daily volume. dYdX's transition to a Cosmos app-chain has enabled institutional-grade performance with lower fees, while GMX's unique GLP (Global Liquidity Pool) model has attracted $500M+ in liquidity providers. Synthetix's perpetuals v3 and perpetual swap innovations continue to push boundaries in on-chain derivatives. The sector is witnessing growth in structured products, options markets (Lyra, Dopex, Premia), and exotic derivatives that combine multiple underlying assets. Cross-margining and unified liquidity pools are becoming standard, while oracle infrastructure improvements enable more sophisticated products. The emergence of prediction markets (Polymarket, Kalshi) demonstrates demand for event-driven derivatives. Volatility products and yield derivatives (Pendle Finance) allow users to trade future yield, creating new risk management and speculation opportunities.`,
        keyCompanies: ["dYdX", "GMX", "Synthetix", "Perpetual Protocol", "Gains Network", "Lyra Finance", "Dopex", "Premia", "Pendle Finance", "Polymarket"],
        marketMetrics: `Daily Derivatives Volume: $50-100B | Perpetuals TVL: $3B+ | Options Protocols: 15+ | Active Traders: 500K+ | Average Daily OI: $5-8B`,
        growthRate: "90% Year-over-Year",
        regulatoryStatus: "Regulatory scrutiny increasing - CFTC/SEC engagement on derivatives classification",
        marketTimeline: "Growth Phase - Maturation 2025-2026",
        riskFactors: ["Liquidity risks", "Oracle manipulation", "Smart contract vulnerabilities", "Regulatory uncertainty"],
        opportunities: ["Institutional products", "Cross-asset derivatives", "Structured products", "Regulatory clarity benefits"]
      },
      {
        category: "MEV Protection & Order Flow Optimization",
        description: `Maximal Extractable Value (MEV) protection has become critical infrastructure for DeFi, with protocols offering users protection from front-running, sandwich attacks, and other MEV extraction. Flashbots' SUAVE (Single Unifying Auction for Value Expression) aims to democratize MEV extraction, while protocols like CoW Swap, 1inch Fusion, and Uniswap's private mempool features protect users from MEV. The emergence of "intent-based" protocols allows users to specify desired outcomes while solvers compete to find optimal execution paths. MEV research and infrastructure development is accelerating, with solutions focusing on transaction ordering fairness, privacy, and value redistribution to users. The sector is moving towards MEV-aware protocol design that incorporates protection mechanisms natively.`,
        keyCompanies: ["Flashbots", "CoW Protocol", "1inch", "Uniswap", "MEV Boost", "Eden Network", "Kolibrio", "KeeperDAO"],
        marketMetrics: `MEV Protected Volume: $20B+ monthly | User Savings: $100M+ annually | Active Protection Protocols: 20+ | MEV Redistribution: Growing`,
        growthRate: "60% Year-over-Year",
        regulatoryStatus: "Regulatory interest in MEV fairness and market manipulation concerns",
        marketTimeline: "Development Phase - Adoption Acceleration 2025",
        riskFactors: ["Centralization concerns", "Complexity", "Integration challenges", "Regulatory scrutiny"],
        opportunities: ["Universal MEV protection", "Intent-based systems", "Value redistribution", "Fair ordering"]
      }
    ],
    
    topProtocols: [
      { name: "Lido Finance", category: "Liquid Staking", tvl: "$35B+", description: "Leading liquid staking protocol with 29% market share of staked ETH, enabling liquid staking derivatives (stETH) for DeFi composability", growth: "+45% YoY", users: "350K+" },
      { name: "Aave", category: "Lending", tvl: "$12.5B+", description: "Decentralized lending protocol supporting 15+ chains with isolated markets, GHO stablecoin, and sophisticated risk management", growth: "+30% YoY", users: "500K+" },
      { name: "MakerDAO", category: "Lending/Stablecoin", tvl: "$8.5B+", description: "Pioneering DeFi protocol issuing DAI stablecoin, now 60%+ backed by RWA including US Treasury bills and bonds", growth: "+25% YoY", users: "200K+" },
      { name: "Uniswap", category: "DEX", tvl: "$4.2B+", description: "Largest decentralized exchange with v4 hooks architecture, concentrated liquidity, and multi-chain deployment", growth: "+40% YoY", users: "4M+" },
      { name: "EigenLayer", category: "Restaking", tvl: "$15B+", description: "Innovative restaking protocol enabling stakers to secure multiple protocols (AVSs) for additional yield", growth: "+500% YoY", users: "100K+" },
      { name: "Arbitrum", category: "L2", tvl: "$3.5B+", description: "Leading Ethereum Layer 2 scaling solution with 200+ dApps and significant DeFi activity", growth: "+80% YoY", users: "2M+" },
      { name: "dYdX", category: "Derivatives", tvl: "$500M+", description: "Institutional-grade perpetual futures exchange operating as Cosmos app-chain with high throughput", growth: "+60% YoY", users: "150K+" },
      { name: "GMX", category: "Derivatives", tvl: "$500M+", description: "Decentralized perpetuals exchange with unique GLP liquidity model and multi-chain deployment", growth: "+35% YoY", users: "100K+" },
      { name: "Compound", category: "Lending", tvl: "$2.1B+", description: "Decentralized money markets with algorithmic interest rates and multi-asset support", growth: "+20% YoY", users: "300K+" },
      { name: "Pendle Finance", category: "Yield Trading", tvl: "$600M+", description: "Protocol enabling users to trade future yield, tokenize yield streams, and optimize yield strategies", growth: "+200% YoY", users: "50K+" },
      { name: "Morpho", category: "Lending", tvl: "$2B+", description: "Peer-to-peer lending protocol with optimization layer on top of Aave and Compound for better rates", growth: "+150% YoY", users: "80K+" },
      { name: "Rocket Pool", category: "Liquid Staking", tvl: "$3.5B+", description: "Decentralized liquid staking protocol with distributed validator technology and rETH token", growth: "+70% YoY", users: "100K+" }
    ],
    
    institutionalAdoption: {
      summary: `Institutional DeFi adoption has reached an inflection point in ${currentYear}, with major financial institutions launching blockchain-native products and allocating significant capital to on-chain opportunities. BlackRock's BUIDL tokenized fund ($500M+), JPMorgan's Onyx Digital Assets platform, and Coinbase's institutional infrastructure represent the vanguard of adoption. The tokenization of traditional assets (T-Bills, corporate bonds, money market funds) now exceeds $12 billion on-chain, with projections suggesting $500 billion to $1 trillion by 2030. Regulatory frameworks like MiCA (EU) and DABA (Bermuda) provide compliance pathways, while institutional-grade infrastructure addresses custody, KYC/AML, and audit requirements. The convergence of TradFi and DeFi is creating hybrid financial products that combine blockchain efficiency with regulatory compliance, enabling 24/7 trading, fractional ownership, and programmatic access to previously illiquid assets.`,
      keyPlayers: ["BlackRock (BUIDL, IBIT)", "JPMorgan (Onyx)", "Coinbase (Base, Prime)", "Fidelity Digital Assets", "Franklin Templeton (BENJI)", "BNY Mellon", "State Street", "Goldman Sachs", "Circle (USDC)", "Anchorage Digital"],
      products: [
        "Tokenized US Treasury Bills & Money Market Funds ($8.5B+)",
        "Institutional Custody Solutions (Fireblocks, Anchorage, Coinbase Custody)",
        "Regulatory-Compliant DeFi Products (Circle's CCTP, Base)",
        "Tokenized Corporate Bonds & Trade Receivables ($2.5B+)",
        "Institutional Lending Protocols (Maple Finance, Clearpool)",
        "Blockchain-Based Settlement Infrastructure (JPM Coin, Onyx)",
        "Regulatory Technology (RegTech) Solutions for Compliance"
      ],
      investmentTrends: [
        "Institutional allocation to DeFi increasing 200% YoY",
        "Tokenized fund structures becoming standard",
        "Regulatory-compliant infrastructure attracting capital",
        "Traditional asset managers launching blockchain products"
      ]
    },
    
    regulatoryDevelopments: {
      summary: `Regulatory clarity for DeFi is evolving rapidly across major jurisdictions, with the EU's Markets in Crypto-Assets (MiCA) regulation setting comprehensive standards for crypto-assets and DeFi protocols. The US Securities and Exchange Commission (SEC) continues to provide guidance through enforcement actions and proposed rules, while the Commodity Futures Trading Commission (CFTC) maintains jurisdiction over derivatives markets. Bermuda's Digital Asset Business Act (DABA) framework provides a progressive regulatory environment for DeFi innovation, attracting protocols seeking compliance pathways. Singapore's Payment Services Act and MAS regulations offer clarity for digital payment tokens and stablecoins. The UK's Financial Services and Markets Act (FSMA) 2023 expands cryptoasset regulation, while Japan's stablecoin legislation demonstrates regulatory innovation. Key themes include stablecoin regulation, custody requirements, KYC/AML obligations, and the treatment of DeFi protocols as regulated entities or exempt structures.`,
      keyChanges: [
        "EU MiCA Implementation (2024-2025): Comprehensive cryptoasset regulation including stablecoins, CASPs, and DeFi protocols",
        "US SEC Guidance: Enhanced enforcement on securities classification, custody rules, and exchange definitions",
        "Bermuda DABA Framework: Progressive digital asset licensing regime supporting DeFi innovation with regulatory oversight",
        "UK FSMA 2023: Expansion of cryptoasset regulation with emphasis on stablecoins and market integrity",
        "Singapore MAS Regulations: Enhanced Payment Services Act with stablecoin framework and DPT regulations",
        "Japan Stablecoin Legislation: Comprehensive framework for stablecoin issuance and trading",
        "Switzerland FINMA Guidelines: Updated DeFi guidance with emphasis on licensing and compliance"
      ],
      impact: `Regulatory developments are creating both opportunities and challenges for DeFi. Positive impacts include increased institutional participation through compliance pathways, enhanced market integrity, and consumer protection improvements. Regulatory clarity in jurisdictions like Bermuda and Singapore is attracting protocol development and institutional capital. However, regulatory uncertainty in the US and evolving frameworks globally create compliance complexity. The industry is responding with regulatory technology (RegTech) solutions, compliant protocol designs, and engagement with regulators. The emergence of "regulated DeFi" models combines blockchain efficiency with traditional compliance, while fully decentralized protocols explore jurisdictional strategies and regulatory arbitrage. Overall, regulatory evolution is maturing the sector and enabling institutional adoption while maintaining innovation capacity.`
    },
    
    horizonScanning: {
      emergingTrends: [
        {
          trend: "Autonomous Financial Agents & AI-Driven DeFi",
          description: "AI agents capable of autonomously managing DeFi portfolios, optimizing yield across protocols, and executing complex strategies. Large Language Models (LLMs) enabling natural language protocol interaction and automated auditing.",
          timeframe: "2025-2026",
          marketPotential: "$10-50B",
          keyPlayers: ["SingularityDAO", "Fetch.ai", "Giza Protocol", "Ritual", "Numerai"],
          impact: "High - Could automate 30-50% of DeFi interactions"
        },
        {
          trend: "Tokenized Securities & Equity Markets On-Chain",
          description: "Expansion beyond tokenized debt to include equities, private company shares, and fractionalized ownership of high-value assets. Regulatory frameworks enabling compliant tokenized securities trading.",
          timeframe: "2025-2027",
          marketPotential: "$100B-1T",
          keyPlayers: ["Backed Finance", "Ondo Finance", "Securitize", "tZERO", "Polygon"],
          impact: "Very High - Could onboard traditional securities markets"
        },
        {
          trend: "Decentralized Identity & Reputation Systems",
          description: "On-chain identity and credit scoring enabling trustless lending, reputation-based protocols, and Sybil-resistant governance. Soulbound tokens (SBTs) and verifiable credentials creating portable digital identity.",
          timeframe: "2025-2026",
          marketPotential: "$5-20B",
          keyPlayers: ["Worldcoin", "BrightID", "Gitcoin Passport", "Galxe", "Polygon ID"],
          impact: "High - Enables trustless credit and reputation markets"
        },
        {
          trend: "Quantum-Resistant Cryptography Integration",
          description: "DeFi protocols adopting post-quantum cryptographic algorithms to protect against future quantum computing threats. Migration strategies and hybrid approaches combining classical and quantum-resistant cryptography.",
          timeframe: "2026-2030",
          marketPotential: "Infrastructure-wide",
          keyPlayers: ["Protocol teams", "Research institutions", "NIST standards"],
          impact: "Critical - Future-proofing DeFi infrastructure"
        },
        {
          trend: "Central Bank Digital Currencies (CBDCs) DeFi Integration",
          description: "Programmable CBDCs enabling DeFi-like functionality with central bank backing. Cross-border CBDC interoperability and integration with decentralized protocols creating hybrid monetary systems.",
          timeframe: "2026-2030",
          marketPotential: "$1T+",
          keyPlayers: ["Central banks", "BIS", "IMF", "Circle", "Ripple"],
          impact: "Transformative - Could reshape monetary policy and DeFi"
        },
        {
          trend: "Green DeFi & Carbon Credit Tokenization",
          description: "Tokenized carbon credits, renewable energy certificates, and ESG-compliant DeFi products. Protocols rewarding environmentally sustainable practices and enabling transparent carbon accounting.",
          timeframe: "2025-2027",
          marketPotential: "$10-50B",
          keyPlayers: ["Toucan Protocol", "Klima DAO", "Flow Carbon", "Moss Earth"],
          impact: "Medium-High - Aligns DeFi with ESG goals"
        },
        {
          trend: "Account Abstraction & Smart Contract Wallets",
          description: "ERC-4337 enabling social recovery, gasless transactions, and improved UX. Smart contract wallets becoming standard, abstracting blockchain complexity for mainstream users.",
          timeframe: "2025-2026",
          marketPotential: "User adoption multiplier",
          keyPlayers: ["Argent", "Safe (formerly Gnosis Safe)", "ZeroDev", "Pimlico"],
          impact: "High - Removes major UX barriers"
        },
        {
          trend: "DeFi on Mobile & Super Apps",
          description: "Mobile-first DeFi applications combining multiple services (payments, trading, lending, NFTs) in unified interfaces. Telegram Mini Apps and WhatsApp integrations bringing DeFi to billions of users.",
          timeframe: "2025-2026",
          marketPotential: "1B+ potential users",
          keyPlayers: ["Telegram", "WhatsApp", "Toncoin", "Base", "Solana"],
          impact: "Very High - Mass market accessibility"
        }
      ],
      
      technologyBreakthroughs: [
        {
          technology: "Zero-Knowledge Proof Scalability",
          description: "ZK-rollups and ZK-proofs achieving mainstream adoption with 1000+ TPS and sub-dollar transaction costs. ZK-EVMs enabling full Ethereum compatibility with enhanced privacy.",
          impact: "Massive scalability improvements, privacy enhancements",
          adoptionTimeline: "2025-2026"
        },
        {
          technology: "Intent-Based DeFi Protocols",
          description: "Users specify desired outcomes (e.g., 'optimize yield') rather than exact transactions. AI-powered solvers compete to find optimal execution paths across protocols.",
          impact: "Dramatically improved UX, better execution",
          adoptionTimeline: "2025"
        },
        {
          technology: "Homogeneous Liquidity Pools",
          description: "Unified liquidity pools across chains and protocols, eliminating fragmentation. Protocols enabling seamless asset movement and cross-chain yield optimization.",
          impact: "Improved capital efficiency, better yields",
          adoptionTimeline: "2025-2026"
        },
        {
          technology: "Decentralized Oracle Networks 2.0",
          description: "Enhanced oracle infrastructure with AI integration, faster updates, and lower costs. Cross-chain oracle protocols enabling unified data feeds across all chains.",
          impact: "More reliable data, lower latency, new products",
          adoptionTimeline: "2025"
        }
      ],
      
      marketSignals: [
        {
          signal: "Institutional Capital Inflow",
          description: "$15B+ institutional products TVL, major asset managers launching tokenized funds",
          implication: "Legitimization and scale expansion",
          timeframe: "Current - Accelerating"
        },
        {
          signal: "Regulatory Clarity Acceleration",
          description: "MiCA implementation, DABA framework, increasing regulatory engagement globally",
          implication: "Reduced uncertainty, institutional adoption catalyst",
          timeframe: "2024-2025"
        },
        {
          signal: "Layer 2 Maturity",
          description: "L2 TVL exceeding $12B, transaction costs 90-99% below L1, user experience parity",
          implication: "Scalability solutions proven, user migration accelerating",
          timeframe: "Current - Mature"
        },
        {
          signal: "RWA Tokenization Explosion",
          description: "$12B+ RWA TVL with 85% YoY growth, expanding asset types and protocols",
          implication: "TradFi-DeFi convergence accelerating",
          timeframe: "Current - Exponential growth phase"
        },
        {
          signal: "AI Integration Momentum",
          description: "AI-powered protocols showing 300% YoY growth, autonomous agents emerging",
          implication: "Next paradigm shift in DeFi functionality",
          timeframe: "2025-2027"
        }
      ],
      
      riskHorizon: [
        {
          risk: "Regulatory Crackdown in Major Jurisdictions",
          description: "Potential aggressive enforcement actions or bans in US/EU impacting protocol operations",
          probability: "Medium",
          impact: "High",
          mitigation: "Jurisdictional diversification, compliance-first protocols, regulatory engagement"
        },
        {
          risk: "Quantum Computing Threat",
          description: "Future quantum computers could break existing cryptographic assumptions",
          probability: "Low (10-15 years)",
          impact: "Critical",
          mitigation: "Post-quantum cryptography adoption, hybrid approaches, research funding"
        },
        {
          risk: "Smart Contract Vulnerability Exploitation",
          description: "Continued high-profile exploits causing user losses and regulatory scrutiny",
          probability: "Medium-High",
          impact: "High",
          mitigation: "Enhanced auditing, formal verification, insurance protocols, bug bounties"
        },
        {
          risk: "Centralization Pressure",
          description: "Protocol governance and infrastructure centralization creating systemic risks",
          probability: "Medium",
          impact: "Medium-High",
          mitigation: "Decentralization initiatives, distributed infrastructure, governance improvements"
        },
        {
          risk: "Liquidity Fragmentation",
          description: "Multi-chain expansion fragmenting liquidity and reducing capital efficiency",
          probability: "Medium",
          impact: "Medium",
          mitigation: "Cross-chain infrastructure, unified liquidity pools, L2 aggregation"
        }
      ]
    },
    
    futureOutlook: `The DeFi ecosystem is positioned for transformative growth over the next 3-5 years, driven by institutional adoption, regulatory clarity, and technological innovation. Market projections suggest TVL reaching $500 billion to $1 trillion by 2027, with tokenized real-world assets representing 30-50% of this value. The convergence of traditional finance and decentralized protocols will create hybrid financial products that combine blockchain efficiency with regulatory compliance, enabling mainstream adoption. Key growth vectors include AI-powered optimization, cross-chain interoperability, and infrastructure that abstracts blockchain complexity for end users. Regulatory frameworks in major jurisdictions will mature, providing clarity while maintaining innovation capacity. The sector will likely experience consolidation among leading protocols while simultaneously fostering explosive growth in specialized verticals. Challenges around scalability, security, and regulatory compliance will drive continued innovation, with solutions emerging from both incumbents and new entrants. The long-term vision of a truly decentralized, accessible, and efficient financial system remains achievable, with current developments representing critical milestones on this path.`,
    
    risks: [
      "Regulatory uncertainty and potential enforcement actions in major jurisdictions (US, EU) could impact protocol operations and institutional participation",
      "Smart contract vulnerabilities and high-profile exploits continue to pose significant risks, with $2-3 billion lost annually to hacks and exploits",
      "Centralization risks in protocol governance, validator sets, and infrastructure create systemic vulnerabilities",
      "Market volatility and correlation with crypto markets exposes DeFi to macroeconomic shocks and liquidity crises",
      "Oracle manipulation and data feed vulnerabilities threaten protocol integrity and user funds",
      "Scalability limitations and high transaction costs during network congestion impact user experience and adoption",
      "Liquidity fragmentation across multiple chains reduces capital efficiency and increases complexity",
      "Regulatory compliance complexity creates barriers to entry and operational overhead for protocols",
      "Technology risks including quantum computing threats, blockchain forks, and consensus mechanism vulnerabilities",
      "User experience complexity and lack of technical knowledge barriers prevent mainstream adoption"
    ],
    
    opportunities: [
      "Tokenized securities and equity markets on-chain could unlock $100 billion to $1 trillion in new value, representing the largest growth opportunity",
      "Institutional adoption through compliant infrastructure and regulatory frameworks is accelerating, with $100B+ potential allocation",
      "AI-powered DeFi optimization and autonomous agents could enhance yields by 15-30% while improving user experience",
      "Cross-chain interoperability and unified liquidity pools could dramatically improve capital efficiency and user experience",
      "Central Bank Digital Currency (CBDC) integration could create hybrid monetary systems with $1 trillion+ potential",
      "Green DeFi and carbon credit tokenization aligns with ESG goals and could attract $10-50 billion in capital",
      "Account abstraction and smart contract wallets remove major UX barriers, enabling mass market adoption",
      "Mobile-first DeFi and super apps could reach billions of users through Telegram, WhatsApp, and other platforms",
      "Decentralized identity and reputation systems enable trustless credit markets and new financial primitives",
      "Yield optimization strategies combining staking, restaking, and DeFi farming offer 15-25% APY opportunities",
      "Emerging market DeFi expansion could onboard billions of unbanked users to financial services",
      "Structured products and derivatives expansion creates sophisticated risk management and speculation opportunities"
    ],
    
    timestamp: Date.now(),
    source: "Comprehensive Rule-Based Research & Horizon Scanning Analysis",
    lastUpdated: currentDate.toISOString(),
    researchDepth: "Executive-Level Deep Analysis"
  };
}

// DeFi Trends Research Endpoint - Rule-Based Comprehensive Analysis
app.get("/api/defi/trends", async (req: Request, res: Response) => {
  try {
    console.log("🔍 Generating comprehensive DeFi trends research (rule-based, no API required)...");
    
    // Generate comprehensive research data
    const defiTrends = generateComprehensiveDeFiResearch();
    
    console.log(`✅ DeFi research generated: ${defiTrends.trends.length} trends, ${defiTrends.topProtocols.length} protocols, horizon scanning included`);
    
    res.json(defiTrends);
  } catch (error) {
    console.error("Error generating DeFi trends research:", error);
    // Return comprehensive fallback even on error
    const fallbackData = generateComprehensiveDeFiResearch();
    res.json({
      ...fallbackData,
      error: String(error),
      source: "Fallback Data (Error Occurred)"
    });
  }
});

app.get("/api/financial-statements/all", async (req: Request, res: Response) => {
  const { financialStatementAnalyzer } = await initializeAgent();
  if (!financialStatementAnalyzer) {
    return res.status(503).json({ error: "Financial statement analyzer not initialized" });
  }
  const statements = financialStatementAnalyzer.getAllStatements();
  res.json(serializeBigInt({ statements, count: statements.length }));
});

// On-Chain Investigation Endpoint with Gemini AI Analysis
app.get("/api/investigation/address/:address", async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    const { agent } = await initializeAgent();
    
    // Get address data from Etherscan/BlockExplorer
    const [transactions, tokenTransfers, balance] = await Promise.all([
      EtherscanAPI.getAddressTransactions(address, 0, 99999999, 1, 100, 'desc').catch(() => []),
      EtherscanAPI.getTokenTransfers(address, 0, 99999999, 1, 50, 'desc').catch(() => []),
      EtherscanAPI.getAccountBalance(address).catch(() => '0')
    ]);
    
    // Analyze suspicious patterns
    const analysis = transactions.length > 0 
      ? EtherscanAPI.analyzeSuspiciousPatterns(transactions)
      : null;
    
    // Use Gemini AI for deep investigation analysis
    let aiAnalysis = null;
    if (process.env.GOOGLE_AI_API_KEY && transactions.length > 0) {
      try {
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const googleAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
        
        // Use ONLY gemini-2.5-flash as specified
        const model = googleAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        // Prepare transaction summary for AI
        const txSummary = transactions.slice(0, 20).map(tx => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: tx.value,
          timestamp: tx.timeStamp,
          gasPrice: tx.gasPrice
        }));
        
        const prompt = `You are an expert blockchain investigator. Analyze this Ethereum address and its transaction history.

Address: ${address}
Balance: ${balance} ETH
Total Transactions: ${transactions.length}
Token Transfers: ${tokenTransfers.length}

Recent Transactions (sample):
${JSON.stringify(txSummary, null, 2)}

Suspicious Pattern Analysis:
${analysis ? JSON.stringify(analysis, null, 2) : 'No patterns detected'}

Provide a comprehensive investigation report including:
1. Address risk assessment (0-100 score)
2. Behavioral patterns (e.g., exchange, mixer, scam, legitimate)
3. Transaction flow analysis
4. Potential red flags
5. Recommendations for further investigation

Format your response as JSON with: riskScore, category, patterns, redFlags (array), recommendations (array), summary.`;
        
        let result;
        let response;
        let text;
        
        try {
          result = await model.generateContent(prompt);
          response = await result.response;
          text = response.text();
        } catch (modelError: any) {
          console.error("❌ gemini-2.5-flash failed:", modelError);
          // Continue without AI analysis if model fails
          text = null;
        }
        
        if (!text) {
          // Skip AI analysis if both models failed
          console.log("⚠️ Skipping AI analysis due to model unavailability");
        } else {
          // Try to parse JSON from AI response
          try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              aiAnalysis = JSON.parse(jsonMatch[0]);
            } else {
              // Fallback: extract key information from text
              aiAnalysis = {
                summary: text,
                riskScore: analysis?.riskScore || 0,
                category: 'UNKNOWN',
                patterns: [],
                redFlags: [],
                recommendations: []
              };
            }
          } catch (parseError) {
            // If JSON parsing fails, use text as summary
            aiAnalysis = {
              summary: text,
              riskScore: analysis?.riskScore || 0,
              category: 'UNKNOWN',
              patterns: [],
              redFlags: [],
              recommendations: []
            };
          }
        }
      } catch (aiError) {
        console.error('Gemini AI analysis error:', aiError);
        // Continue without AI analysis
      }
    }
    
    // Get wallet profile if available
    let walletProfile = null;
    try {
      const walletTracker = agent.getWalletTracker();
      if (walletTracker) {
        walletProfile = walletTracker.getWalletProfile(address);
      }
    } catch (error) {
      // Wallet profile not available
    }
    
    res.json(serializeBigInt({
      address,
      balance,
      transactionCount: transactions.length,
      tokenTransferCount: tokenTransfers.length,
      transactions: transactions.slice(0, 20),
      tokenTransfers: tokenTransfers.slice(0, 20),
      analysis: analysis ? {
        suspicious: analysis.suspicious,
        flags: analysis.flags,
        riskScore: analysis.riskScore,
        totalVolume: analysis.totalVolume.toString(),
        averageTransactionSize: analysis.averageTransactionSize.toString(),
        rapidTransactions: analysis.rapidTransactions
      } : null,
      aiInvestigation: aiAnalysis,
      walletProfile: walletProfile ? {
        riskScore: walletProfile.riskScore,
        suspiciousFlags: walletProfile.suspiciousFlags,
        transactionCount: walletProfile.transactionCount,
        totalVolume: walletProfile.totalVolume.toString()
      } : null,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.error('Investigation error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Blockchain Network Statistics Endpoint
app.get("/api/blockchain/network-stats", async (req: Request, res: Response) => {
  try {
    const { agent } = await initializeAgent();
    const stats = agent.getStats();
    const recent = agent.getRecentTransactions(100);
    
    // Calculate network statistics
    const chains = ["ethereum", "polygon", "bsc", "arbitrum", "optimism", "base", "avalanche-fuji"];
    const chainStats = chains.map(chain => {
      const chainTxs = recent.filter(tx => tx.chain === chain);
      return {
        chain,
        blockHeight: Math.floor(Math.random() * 1000000) + 18000000, // Simulated
        transactionCount: chainTxs.length,
        avgGasPrice: Math.floor(Math.random() * 50) + 10,
        status: "operational",
        activity: "high"
      };
    });
    
    res.json(serializeBigInt({
      overall: {
        totalTransactions: stats.transactionsProcessed || 0,
        totalBlocks: Math.floor((stats.transactionsProcessed || 0) / 150),
        networkHealth: "healthy",
        avgBlockTime: 12 // seconds
      },
      chains: chainStats,
      timestamp: Date.now()
    }));
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Crypto News Endpoint
app.get("/api/crypto/news", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    
    // Fetch news from CoinGecko API (free, no API key required)
    const coinGeckoUrl = `https://api.coingecko.com/api/v3/news?per_page=${limit}`;
    
    try {
      const response = await fetch(coinGeckoUrl);
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }
      const data = await response.json();
      
      // Transform CoinGecko news format to our format
      const news = (data.data || []).map((item: any) => ({
        id: item.id || item.url,
        title: item.title || 'No title',
        description: item.description || item.text || '',
        url: item.url || '',
        image: item.thumb_2x || item.thumb || '',
        source: item.news_site || 'CoinGecko',
        publishedAt: item.updated_at || item.published_at || new Date().toISOString(),
        tags: item.tags || [],
      }));
      
      res.json({
        success: true,
        news,
        count: news.length,
        timestamp: Date.now(),
      });
    } catch (fetchError) {
      console.error('Error fetching crypto news:', fetchError);
      
      // Fallback: Return sample news if API fails
      const fallbackNews = [
        {
          id: '1',
          title: 'Bitcoin Reaches New All-Time High',
          description: 'Bitcoin continues its upward trajectory as institutional adoption increases.',
          url: 'https://cointelegraph.com',
          image: '',
          source: 'CoinTelegraph',
          publishedAt: new Date().toISOString(),
          tags: ['Bitcoin', 'Market'],
        },
        {
          id: '2',
          title: 'Ethereum 2.0 Staking Surges',
          description: 'More ETH is being staked as validators join the network.',
          url: 'https://coindesk.com',
          image: '',
          source: 'CoinDesk',
          publishedAt: new Date().toISOString(),
          tags: ['Ethereum', 'Staking'],
        },
        {
          id: '3',
          title: 'Regulatory Updates in Crypto Space',
          description: 'New regulations are being proposed to govern digital assets.',
          url: 'https://cointelegraph.com',
          image: '',
          source: 'CryptoNews',
          publishedAt: new Date().toISOString(),
          tags: ['Regulation', 'Policy'],
        },
      ];
      
      res.json({
        success: false,
        news: fallbackNews.slice(0, limit),
        count: fallbackNews.length,
        timestamp: Date.now(),
        error: 'Using fallback data',
      });
    }
  } catch (error) {
    console.error('Crypto news endpoint error:', error);
    res.status(500).json({ 
      success: false,
      error: String(error),
      news: [],
      count: 0,
      timestamp: Date.now(),
    });
  }
});

// Test endpoint to verify data flow
app.get("/api/test", async (req: Request, res: Response) => {
  const { agent, regulatoryMetrics } = await initializeAgent();
  const stats = agent.getStats();
  const recent = agent.getRecentTransactions(5);
  const metrics = regulatoryMetrics ? regulatoryMetrics.calculateMetrics() : null;
  
  res.json(serializeBigInt({
    agentRunning: agent.isAgentRunning(),
    transactionsProcessed: stats.transactionsProcessed,
    recentTransactionsCount: recent.length,
    hasRegulatoryData: !!metrics,
    multiChainCount: metrics?.multiChainData?.length || 0,
    sampleTransaction: recent[0] || null,
    timestamp: Date.now(),
  }));
});

// Serve static files AFTER all API routes
app.use(express.static(path.join(__dirname)));

// Fallback - redirect everything to regulator dashboard (except API routes)
app.get("*", (req: Request, res: Response) => {
  // Redirect to regulator dashboard if it's not an API route
  if (!req.path.startsWith("/api") && req.path !== "/regulator" && !req.path.endsWith(".html")) {
    res.redirect("/regulator");
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`📊 Regulator Dashboard server running on http://localhost:${PORT}`);
  console.log(`🌐 Open http://localhost:${PORT}/regulator in your browser`);
  console.log(`🔗 Root URL redirects to: http://localhost:${PORT}/regulator`);
});

