import "dotenv/config";
import { AgentOrchestrator } from "./agent/agentOrchestrator.js";
import { ReinforcementLearning } from "./learning/reinforcementLearning.js";
import { DeFiModuleManager } from "./defi/defiModules.js";
import { RegulatoryMetricsCalculator } from "./regulator/regulatoryMetrics.js";
import { DABAComplianceChecker } from "./regulator/dabaCompliance.js";
import { OpenZeppelinMonitor } from "./monitor/openzeppelinMonitor.js";
import { readFileSync } from "fs";
import { join } from "path";
import type { Strategy } from "./strategy/strategyExecutor.js";

// Initialize components
// Monitor ALL major blockchain platforms for comprehensive coverage
const agent = new AgentOrchestrator({
  chains: [
    // Mainnets - Real production data
    "ethereum",
    "polygon", 
    "bsc",
    "arbitrum",
    "optimism",
    "base",
    // Testnets for testing
    "avalanche-fuji",
    "sepolia",
  ],
  enableAnalysis: true,
  enableStrategies: true,
  analysisConfig: {
    riskThreshold: 70,
    enableAIAnalysis: true,
  },
});

const rl = new ReinforcementLearning({
  learningRate: 0.1,
  discountFactor: 0.95,
  initialExplorationRate: 1.0,
});

const regulatoryMetrics = new RegulatoryMetricsCalculator();

// Initialize DABA (Bermuda) compliance checker
const dabaCompliance = new DABAComplianceChecker({
  licenseClass: "F", // Class F - Full operation license
  headOfficeInBermuda: true,
  capitalRequirement: BigInt("1000000000000000000000"), // 1000 ETH
});

// Initialize OpenZeppelin Monitor
const openzeppelinMonitor = new OpenZeppelinMonitor();

// Load monitor triggers from config
try {
  const triggersConfig = JSON.parse(
    readFileSync(join(process.cwd(), "config", "monitor-triggers.json"), "utf-8")
  );
  openzeppelinMonitor.loadTriggersFromConfig(triggersConfig);
  console.log(`📡 Loaded ${triggersConfig.length} monitor triggers`);
} catch (error) {
  console.warn("Could not load monitor triggers config:", error);
}

// Connect all components to agent
agent.setReinforcementLearning(rl);
agent.setRegulatoryMetrics(regulatoryMetrics);
agent.setDABACompliance(dabaCompliance);
agent.setOpenZeppelinMonitor(openzeppelinMonitor);

const defiManager = new DeFiModuleManager();

// Register example strategies
const exampleStrategies: Strategy[] = [
  {
    id: "high-risk-alert",
    name: "High Risk Alert",
    description: "Alert when risk score exceeds 80",
    enabled: true,
    conditions: [
      {
        type: "risk_score",
        operator: ">=",
        value: 80,
      },
    ],
    actions: [
      {
        type: "alert",
        params: {
          title: "High Risk Transaction Detected",
          message: "A transaction with high risk score has been detected",
        },
      },
    ],
  },
  {
    id: "large-value-monitor",
    name: "Large Value Monitor",
    description: "Monitor transactions with large values",
    enabled: true,
    conditions: [
      {
        type: "value_threshold",
        operator: ">",
        value: 1000000000000000000n, // 1 ETH in wei
      },
    ],
    actions: [
      {
        type: "log",
        params: {
          message: "Large value transaction detected",
        },
      },
    ],
  },
];

// Register strategies
for (const strategy of exampleStrategies) {
  agent.registerStrategy(strategy);
}

// Main function
async function main() {
  console.log("🌐 Blockchain AI Agent - Starting...\n");

  // Display configuration
  console.log("📋 Configuration:");
  console.log(`   Chains: ${agent.getStats().chainsMonitored}`);
  console.log(`   Strategies: ${agent.getStrategies().length}`);
  console.log(`   DeFi Modules: ${defiManager.getEnabledModules().length}`);
  console.log("");

  // Start the agent
  await agent.start();

  // Display stats periodically
  setInterval(() => {
    const stats = agent.getStats();
    const metrics = rl.getPerformanceMetrics();

    console.log("\n📊 Agent Statistics:");
    console.log(`   Transactions Processed: ${stats.transactionsProcessed}`);
    console.log(`   Suspicious Transactions: ${stats.suspiciousTransactions}`);
    console.log(`   Strategies Triggered: ${stats.strategiesTriggered}`);
    console.log(`   Uptime: ${Math.floor(stats.uptime / 1000)}s`);
    console.log(`   Average Reward: ${metrics.averageReward.toFixed(2)}`);
    console.log(`   Success Rate: ${(metrics.successRate * 100).toFixed(2)}%`);
  }, 30000); // Every 30 seconds

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n\n🛑 Shutting down agent...");
    agent.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("\n\n🛑 Shutting down agent...");
    agent.stop();
    process.exit(0);
  });
}

// Run the agent
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

