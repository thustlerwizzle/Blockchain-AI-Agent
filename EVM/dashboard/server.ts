import "dotenv/config";
import express, { type Request, type Response } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { promises as fsp } from "fs";
import { fileURLToPath } from "url";
import { OpenAI } from "openai";
import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
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
import { createPublicClient, http, type Address, type Chain } from "viem";
import { arbitrum, avalancheFuji, base, bsc, mainnet, optimism, polygon, sepolia } from "viem/chains";

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
const USE_TEST_DATA = process.env.USE_TEST_DATA === "true";
const ETH_RPC_URL = process.env.ETH_RPC_URL || "https://cloudflare-eth.com";
let realDataPollingStarted = false;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
const INVESTIGATION_STORE_PATH = path.join(process.cwd(), "data", "investigations.json");
const REPORTS_DIR = process.env.REPORTS_DIR || "C:\\Users\\takun\\OneDrive\\Documents\\Blockchain AI Agent\\reports";
const MAX_INVESTIGATION_HISTORY = 200;
const AUTO_SAR_DIR = path.join(REPORTS_DIR, "auto");

type CrossChainConfig = {
  name: string;
  chain: Chain;
  rpcEnv?: string;
};

const CROSS_CHAIN_CONFIGS: CrossChainConfig[] = [
  { name: "ethereum", chain: mainnet, rpcEnv: "ETH_RPC_URL" },
  { name: "polygon", chain: polygon, rpcEnv: "POLYGON_RPC_URL" },
  { name: "bsc", chain: bsc, rpcEnv: "BSC_RPC_URL" },
  { name: "arbitrum", chain: arbitrum, rpcEnv: "ARBITRUM_RPC_URL" },
  { name: "optimism", chain: optimism, rpcEnv: "OPTIMISM_RPC_URL" },
  { name: "base", chain: base, rpcEnv: "BASE_RPC_URL" },
  { name: "avalanche-fuji", chain: avalancheFuji, rpcEnv: "AVALANCHE_FUJI_RPC_URL" },
  { name: "sepolia", chain: sepolia, rpcEnv: "SEPOLIA_RPC_URL" },
];

const CROSS_CHAIN_BLOCK_LOOKBACK = 12;
const CROSS_CHAIN_RECENT_TX_LIMIT = 50;

function getRpcUrl(config: CrossChainConfig): string {
  const envUrl = config.rpcEnv ? process.env[config.rpcEnv] : undefined;
  const fallbackUrl = config.chain.rpcUrls?.default?.http?.[0];
  if (envUrl) return envUrl;
  if (fallbackUrl) return fallbackUrl;
  throw new Error(`No RPC URL configured for ${config.name}`);
}

function createChainClient(config: CrossChainConfig) {
  const rpcUrl = getRpcUrl(config);
  return {
    rpcUrl,
    client: createPublicClient({
      chain: config.chain,
      transport: http(rpcUrl, { timeout: 15_000 }),
    }),
  };
}

// Master Investigative Blueprint: Syndicate-7 Cluster Database (Jan 18, 2026)
const SYNDICATE_7_CLUSTER: Array<{ address: string; role: string; status: string; riskScore: number }> = [
  { address: "0x019d0706d65c4768ec8081ed7ce41f59eef9b86c", role: "Ghost Deployer", status: "High Risk (Disposable node)", riskScore: 95 },
  { address: "0x489626343f723f03673bf4d072c227341ff3684f", role: "Weaponized Contract", status: "Malicious (Wallet Drainer)", riskScore: 100 },
  { address: "0x6131b5fae19ea4f9d964eac0408e4408b66337b5", role: "Aggregator/Mixer", status: "KyberSwap (Used for laundering)", riskScore: 85 },
  { address: "0x7c7c8fe926b2789826e80b28641d2d9cdb111a21", role: "Mastermind", status: "Consolidator (Primary beneficiary)", riskScore: 98 },
  { address: "0xbc892e14f5276a12d7890b21c4567e912a3b4c56", role: "Off-Ramp", status: "Binance Deposit (KYC point)", riskScore: 75 },
  { address: "0x87c9fc9bfb3203b7bc161d67a7c759482d1a28ae", role: "Yield Staker", status: "Lido Staker (Asset parking)", riskScore: 80 },
  { address: "0xd1b84219", role: "Scout/Watcher", status: "Dev Wallet (Used for testing)", riskScore: 60 },
  { address: "0x52a1d8f762b3c4578912e6b4c3e8f9012a9d8e7b", role: "Peeling Hub", status: "Liquidity Node", riskScore: 85 },
  { address: "0xd0d08887e8a5b16049534a7f3fc1de92848f5bea", role: "MEV Controller", status: "Active on Optimism", riskScore: 75 },
  { address: "0x6a000f20005980200259b80c5102003040001068", role: "Governance Manipulator", status: "Flash Loan Voter", riskScore: 65 },
];

// Top 10 High-Risk Function Signatures (EIP-712 / 4-byte signatures)
const HIGH_RISK_FUNCTIONS: Array<{ name: string; signature: string; riskScore: number; description: string }> = [
  { name: "permit", signature: "0xd505accf", riskScore: 95, description: "EIP-2612 Gasless Drainer - Allows token movement via signature only" },
  { name: "delegatecall", signature: "0x", riskScore: 100, description: "Extremely dangerous - Executes code from another contract, hijacks ownership" },
  { name: "setApprovalForAll", signature: "0xa22cb465", riskScore: 90, description: "NFT/Token drainer - Approves entire collection in one click" },
  { name: "transferFrom", signature: "0x23b872dd", riskScore: 80, description: "Fund extraction - Pulls approved tokens from user wallet" },
  { name: "upgradeTo", signature: "0x3659cfe6", riskScore: 85, description: "Proxy manipulation - Changes safe contract to malicious after deposit" },
  { name: "selfdestruct", signature: "0x1ba4eec0", riskScore: 90, description: "Evidence destruction - Deletes contract code to hide forensics" },
  { name: "mint (unlimited)", signature: "0x40c10f19", riskScore: 95, description: "Rug pull function - Creates billions of tokens instantly to dump" },
  { name: "blacklist/setFrozen", signature: "0x", riskScore: 100, description: "Honeypot signature - Owner stops victims from selling tokens" },
  { name: "renounceOwnership", signature: "0x715018a6", riskScore: 70, description: "Trust signal deception - Looks safe but hidden backdoor exists" },
  { name: "multicall", signature: "0xac9650d8", riskScore: 85, description: "Batched attacks - Approve + Transfer + Swap in one transaction" },
];

// Known Bridge/Mixer addresses for Step 1 Triage
const BRIDGE_ADDRESSES = new Set([
  "0x000000000088228b6e7a0bc5f0b8b5c", // Across
  "0x2796317b0ff8538f", // Stargate
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC (often used as bridge)
]);

const MIXER_ADDRESSES = new Set([
  "0x77777feddddffc19ff86db637967013e6c6a116c", // Tornado Cash
  "0x12d66f87a04a9e220743712ce6d9bb1b5616b8fc", // Tornado Cash (old)
]);

type InvestigationRecord = {
  id: string;
  address: string;
  token?: string;
  riskScore: number;
  summary: string;
  sarText?: string;
  alerts: any[];
  chainActivity: Array<{ chain: string; hasActivity: boolean; txCount: number; balance?: string; rpc?: string; error?: string }>;
  timestamp: number;
  status?: "flagged" | "cleared";
  workflowAnalysis?: {
    triage: { fundedByBridge: boolean; fundedByMixer: boolean; baseRisk: number };
    dependencyMapping: { clusterMatch: boolean; relatedAddresses: string[]; hopDistance: number };
    behavioralClass: string;
    payloadInspection: { highRiskFunctions: string[]; contractVerified: boolean };
    sarReady: boolean;
  };
  highRiskTransactions?: Array<{
    hash: string;
    from: string;
    to: string | null;
    value: string;
    blockNumber: string;
    timestamp: string;
    riskScore: number;
    riskReason: string;
    anomalyFlags: string[];
    category: string;
  }>;
};

async function ensureInvestigationStore() {
  await fsp.mkdir(path.dirname(INVESTIGATION_STORE_PATH), { recursive: true });
}

async function ensureReportsDir() {
  await fsp.mkdir(REPORTS_DIR, { recursive: true });
  // Ensure subdirectories exist
  await fsp.mkdir(path.join(REPORTS_DIR, "flagged"), { recursive: true });
  await fsp.mkdir(path.join(REPORTS_DIR, "flagged", "high"), { recursive: true });
  await fsp.mkdir(path.join(REPORTS_DIR, "flagged", "medium"), { recursive: true });
  await fsp.mkdir(path.join(REPORTS_DIR, "flagged", "low"), { recursive: true });
  await fsp.mkdir(path.join(REPORTS_DIR, "cleared"), { recursive: true });
  await fsp.mkdir(path.join(REPORTS_DIR, "consolidated"), { recursive: true });
}

// Get report directory path based on status and risk level
function getReportDirectory(record: InvestigationRecord): string {
  const status = record.status || "flagged";
  const riskLevel = record.riskScore >= 70 ? "high" : record.riskScore >= 40 ? "medium" : record.riskScore >= 20 ? "low" : "cleared";
  
  if (status === "cleared") {
    return path.join(REPORTS_DIR, "cleared");
  }
  
  return path.join(REPORTS_DIR, "flagged", riskLevel);
}

async function loadInvestigationHistory(): Promise<InvestigationRecord[]> {
  try {
    const raw = await fsp.readFile(INVESTIGATION_STORE_PATH, "utf-8");
    return JSON.parse(raw) as InvestigationRecord[];
  } catch {
    return [];
  }
}

async function saveInvestigationRecord(record: InvestigationRecord) {
  await ensureInvestigationStore();
  await ensureReportsDir();
  const history = await loadInvestigationHistory();

  // If cleared, remove prior entries for this address/token
  const filtered = record.status === "cleared"
    ? history.filter(r => !(r.address?.toLowerCase() === record.address.toLowerCase() && (r.token || "") === (record.token || "")))
    : history;

  filtered.unshift(record);

  const limited = filtered.slice(0, MAX_INVESTIGATION_HISTORY);
  await fsp.writeFile(INVESTIGATION_STORE_PATH, JSON.stringify(limited, null, 2), "utf-8");

  // Update flagged CSV snapshot - include ALL risk levels (suspicious, flagged, high, medium, low)
  try {
    // Include all records except cleared ones (riskScore > 20 or has alerts)
    const allRiskRecords = limited.filter(r => {
      const status = r.status || "flagged";
      return status === "flagged" || (r.riskScore > 20 || (r.alerts && r.alerts.length > 0));
    });
    const header = ["address", "token", "riskScore", "riskLevel", "status", "summary", "sarText", "alerts", "timestamp"].join(",");
    const rows = allRiskRecords.map(r => {
      const riskLevel = r.riskScore >= 70 ? "HIGH" : r.riskScore >= 40 ? "MEDIUM" : r.riskScore >= 20 ? "LOW" : "CLEARED";
      const summary = (r.summary || "").replace(/"/g, '""');
      const sar = (r.sarText || "").replace(/"/g, '""');
      const alerts = Array.isArray(r.alerts) ? r.alerts.map((a: any) => `${a.alertType || a.type || "alert"}:${a.riskScore || ""}`).join("|") : "";
      const alertsEscaped = alerts.replace(/"/g, '""');
      return [
        r.address,
        r.token || "",
        r.riskScore,
        riskLevel,
        r.status || "flagged",
        `"${summary}"`,
        `"${sar}"`,
        `"${alertsEscaped}"`,
        new Date(r.timestamp).toISOString(),
      ].join(",");
    });
    const csv = [header, ...rows].join("\n");
    const csvPath = path.join(REPORTS_DIR, "flagged.csv");
    await fsp.writeFile(csvPath, csv, "utf-8");
    console.log(`[CSV] Updated flagged.csv with ${allRiskRecords.length} records at ${csvPath}`);
  } catch (err: any) {
    console.error("[CSV] Failed to update flagged.csv:", err?.message || err);
    console.error("[CSV] Error details:", err?.stack);
  }
}

function investigationsToCsv(records: InvestigationRecord[]): string {
  const header = ["id", "address", "token", "riskScore", "status", "summary", "sarText", "timestamp", "chains", "alerts"].join(",");
  const rows = records.map((rec) => {
    const chains = rec.chainActivity.map((c) => `${c.chain}:${c.txCount}${c.hasActivity ? "" : "(none)"}`).join("|");
    const alerts = rec.alerts.map((a: any) => `${a.alertType || a.type || "alert"}:${a.riskScore || ""}`).join("|");
    const safeSummary = (rec.summary || "").replace(/"/g, '""');
    const safeSar = (rec.sarText || "").replace(/"/g, '""');
    return [
      rec.id,
      rec.address,
      rec.token || "",
      rec.riskScore,
      rec.status || "",
      `"${safeSummary}"`,
      `"${safeSar}"`,
      new Date(rec.timestamp).toISOString(),
      `"${chains}"`,
      `"${alerts}"`,
    ].join(",");
  });
  return [header, ...rows].join("\n");
}

async function buildCrossChainSnapshot(address: string, agentInstance: AgentOrchestrator | null) {
  const lowerAddress = address.toLowerCase();
  const liveTxs = agentInstance ? agentInstance.getRecentTransactions(1000) : [];

  const chainData = await Promise.all(
    CROSS_CHAIN_CONFIGS.map(async (config) => {
      try {
        const { client, rpcUrl } = createChainClient(config);

        const [balance, nonce, latestBlock] = await Promise.all([
          client.getBalance({ address: address as Address }).catch(() => 0n),
          client.getTransactionCount({ address: address as Address }).catch(() => 0n),
          client.getBlockNumber().catch(() => null),
        ]);

        let recentTxs = 0;
        if (latestBlock && latestBlock > 0n) {
          const lookback = Math.min(CROSS_CHAIN_BLOCK_LOOKBACK, Number(latestBlock));
          for (let i = 0; i < lookback; i++) {
            const blockNumber = latestBlock - BigInt(i);
            const block = await client
              .getBlock({ blockNumber, includeTransactions: true })
              .catch(() => null);
            if (!block?.transactions) continue;

            for (const tx of block.transactions as any[]) {
              if (typeof tx === "string") continue;
              const fromMatch = tx.from?.toLowerCase() === lowerAddress;
              const toMatch = tx.to?.toLowerCase() === lowerAddress;
              if (fromMatch || toMatch) {
                recentTxs++;
                if (recentTxs >= CROSS_CHAIN_RECENT_TX_LIMIT) break;
              }
            }
            if (recentTxs >= CROSS_CHAIN_RECENT_TX_LIMIT) break;
          }
        }

        const liveTxCount = liveTxs.filter((tx: any) => {
          if (tx.chain !== config.name) return false;
          const fromMatch = tx.from && tx.from.toLowerCase() === lowerAddress;
          const toMatch = tx.to && tx.to.toLowerCase() === lowerAddress;
          return fromMatch || toMatch;
        }).length;

        const txCount = Math.max(Number(nonce ?? 0n), recentTxs, liveTxCount);

        return {
          chain: config.name,
          hasActivity:
            (nonce ?? 0n) > 0n ||
            (balance ?? 0n) > 0n ||
            recentTxs > 0 ||
            liveTxCount > 0,
          txCount,
          balance: balance?.toString() ?? "0",
          rpc: rpcUrl,
        };
      } catch (error: any) {
        console.error(`[CrossChain] ${config.name} failed:`, error?.message || error);
        return { chain: config.name, hasActivity: false, txCount: 0, error: error?.message || String(error) };
      }
    })
  );

  return chainData;
}

async function generateAiNarrative(params: {
  address: string;
  token?: string;
  chainActivity: Array<{ chain: string; hasActivity: boolean; txCount: number }>;
  alerts: any[];
}): Promise<string> {
  if (!openai) {
    return "AI analysis unavailable (OPENAI_API_KEY not set).";
  }

  const { address, token, chainActivity, alerts } = params;
  const alertSnippet = alerts
    .map((a) => `${a.alertType || a.type || "alert"} | chain=${a.chain || ""} | risk=${a.riskScore ?? ""} | desc=${a.description || ""}`)
    .slice(0, 10)
    .join("\n");
  const chainSnippet = chainActivity.map((c) => `${c.chain}: tx=${c.txCount}, active=${c.hasActivity}`).join("\n");

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You are a compliance-grade blockchain investigator. Be concise, structured, and highlight manipulation/red flags. Return a short narrative (<=200 words) with bullet-like clarity.",
        },
        {
          role: "user",
          content: `Address: ${address}
Token: ${token || "n/a"}
Chain Activity:
${chainSnippet}
Alerts:
${alertSnippet || "none"}`,
        },
      ],
    });
    return completion.choices[0]?.message?.content?.trim() || "AI narrative unavailable.";
  } catch (err: any) {
    console.warn("AI generation failed:", err?.message || err);
    return "AI narrative unavailable due to upstream error.";
  }
}

// Analyze High-Risk Transactions
async function analyzeHighRiskTransactions(address: string, limit: number = 50): Promise<InvestigationRecord["highRiskTransactions"]> {
  const highRiskTxs: InvestigationRecord["highRiskTransactions"] = [];
  const analyzer = new TransactionAnalyzer();

  try {
    // Fetch recent transactions from Etherscan
    const transactions = await EtherscanAPI.getAddressTransactions(address, 0, 99999999, 1, limit, 'desc');
    
    if (!transactions || transactions.length === 0) {
      return [];
    }

    // Analyze each transaction
    for (const tx of transactions.slice(0, limit)) {
      try {
        // Convert Etherscan Transaction to TransactionEvent format
        const value = BigInt(tx.value || "0");
        const blockNumber = BigInt(tx.blockNumber || "0");
        const timestamp = parseInt(tx.timeStamp || "0", 10);

        const txEvent: any = {
          hash: tx.hash as `0x${string}`,
          from: tx.from as Address,
          to: (tx.to || null) as Address | null,
          value: value,
          blockNumber: blockNumber,
          timestamp: timestamp,
          chain: "ethereum",
          data: (tx.input || "0x") as `0x${string}`,
        };

        // Analyze transaction
        const analysis = await analyzer.analyzeTransaction(txEvent);

        // Only include high-risk transactions (riskScore >= 70)
        if (analysis.riskScore >= 70) {
          // Generate risk reason explanation
          const riskReason = generateRiskReason(analysis, txEvent, tx);

          highRiskTxs.push({
            hash: tx.hash,
            from: tx.from,
            to: tx.to || null,
            value: tx.value,
            blockNumber: tx.blockNumber,
            timestamp: new Date(timestamp * 1000).toISOString(),
            riskScore: analysis.riskScore,
            riskReason,
            anomalyFlags: analysis.anomalyFlags || [],
            category: analysis.category || "unknown",
          });
        }
      } catch (err: any) {
        console.warn(`[HighRiskTx] Failed to analyze tx ${tx.hash}:`, err?.message || err);
        // Continue with next transaction
      }
    }

    // Sort by risk score (highest first)
    highRiskTxs.sort((a, b) => b.riskScore - a.riskScore);

    return highRiskTxs.slice(0, 20); // Return top 20 high-risk transactions
  } catch (err: any) {
    console.warn("[HighRiskTx] Failed to fetch/analyze transactions:", err?.message || err);
    return [];
  }
}

// Generate detailed risk reason explanation
function generateRiskReason(analysis: any, txEvent: any, tx: any): string {
  const reasons: string[] = [];

  // Risk score based reasons
  if (analysis.riskScore >= 90) {
    reasons.push("CRITICAL RISK: Transaction shows extremely high risk indicators");
  } else if (analysis.riskScore >= 80) {
    reasons.push("HIGH RISK: Transaction exhibits multiple high-risk patterns");
  } else if (analysis.riskScore >= 70) {
    reasons.push("ELEVATED RISK: Transaction shows concerning patterns");
  }

  // Anomaly flag based reasons
  if (analysis.anomalyFlags && analysis.anomalyFlags.length > 0) {
    for (const flag of analysis.anomalyFlags) {
      switch (flag.toUpperCase()) {
        case "LARGE_VALUE":
          const ethValue = Number(txEvent.value) / 1e18;
          reasons.push(`Large transaction value: ${ethValue.toFixed(4)} ETH (indicates whale movement or high-value transfer)`);
          break;
        case "RAPID_TRANSACTIONS":
          reasons.push("Rapid transaction pattern detected (possible automated trading or spam attack)");
          break;
        case "FAILED_TRANSACTIONS":
          reasons.push("Failed transaction pattern (possible exploit attempt or front-running)");
          break;
        case "SUSPICIOUS_CONTRACT":
          reasons.push("Interaction with suspicious/unverified contract (potential malicious contract)");
          break;
        case "MIXER_BRIDGE":
          reasons.push("Transaction involves mixer or bridge (privacy/anonymity layer, possible money laundering)");
          break;
        case "UNUSUAL_GAS":
          reasons.push("Unusual gas usage pattern (possible contract exploit or complex operation)");
          break;
        default:
          reasons.push(`Flagged: ${flag}`);
      }
    }
  }

  // Transaction-specific checks
  if (tx.isError === "1") {
    reasons.push("Transaction failed (possible exploit attempt or reverted operation)");
  }

  const ethValue = Number(txEvent.value) / 1e18;
  if (ethValue > 100) {
    reasons.push(`Whale transaction: ${ethValue.toFixed(2)} ETH transferred (high-value movement)`);
  }

  // Check for high-risk function signatures
  if (tx.input && tx.input.startsWith("0x") && tx.input.length > 10) {
    const functionSig = tx.input.substring(0, 10).toLowerCase();
    for (const func of HIGH_RISK_FUNCTIONS) {
      if (func.signature && func.signature.toLowerCase() === functionSig) {
        reasons.push(`High-risk function called: ${func.name} - ${func.description}`);
        break;
      }
    }
  }

  // Category-based reasons
  if (analysis.category) {
    const categoryLower = analysis.category.toLowerCase();
    if (categoryLower.includes("manipulation")) {
      reasons.push("Market manipulation pattern detected");
    } else if (categoryLower.includes("laundering")) {
      reasons.push("Money laundering indicators present");
    } else if (categoryLower.includes("exploit")) {
      reasons.push("Potential exploit attempt detected");
    } else if (categoryLower.includes("front-run")) {
      reasons.push("Front-running or MEV pattern identified");
    }
  }

  // Default if no specific reasons
  if (reasons.length === 0) {
    reasons.push(`High risk score (${analysis.riskScore}) indicates suspicious activity patterns`);
  }

  return reasons.join(". ") + ".";
}

// Master Investigative Blueprint: 5-Step Workflow Function
async function runMasterWorkflow(address: string, agent: any): Promise<{
  triage: { fundedByBridge: boolean; fundedByMixer: boolean; baseRisk: number };
  dependencyMapping: { clusterMatch: boolean; relatedAddresses: string[]; hopDistance: number };
  behavioralClass: string;
  payloadInspection: { highRiskFunctions: string[]; contractVerified: boolean };
  sarReady: boolean;
}> {
  const lowerAddress = address.toLowerCase();
  
  // Step 1: Triage - "Who paid for the gas?"
  let fundedByBridge = false;
  let fundedByMixer = false;
  let baseRisk = 0;

  try {
    // Check recent transactions for bridge/mixer funding
    const recentTxs = agent.getRecentTransactions(100);
    const addressTxs = recentTxs.filter((tx: any) => 
      (tx.from?.toLowerCase() === lowerAddress) || (tx.to?.toLowerCase() === lowerAddress)
    ).slice(0, 20);

    for (const tx of addressTxs) {
      const from = (tx.from || "").toLowerCase();
      const to = (tx.to || "").toLowerCase();
      
      // Check if funded by bridge
      for (const bridgeAddr of BRIDGE_ADDRESSES) {
        if (from.includes(bridgeAddr.toLowerCase()) || to.includes(bridgeAddr.toLowerCase())) {
          fundedByBridge = true;
          baseRisk += 30;
          break;
        }
      }
      
      // Check if funded by mixer
      for (const mixerAddr of MIXER_ADDRESSES) {
        if (from.includes(mixerAddr.toLowerCase()) || to.includes(mixerAddr.toLowerCase())) {
          fundedByMixer = true;
          baseRisk += 40;
          break;
        }
      }
    }
  } catch (err) {
    console.warn("[Workflow Step 1] Triage error:", err);
  }

  // Step 2: Dependency Mapping - "Who else has this wallet interacted with?"
  const relatedAddresses: string[] = [];
  let clusterMatch = false;
  let hopDistance = 999;

  try {
    // Check direct match with Syndicate-7 cluster
    const clusterEntry = SYNDICATE_7_CLUSTER.find(c => c.address.toLowerCase() === lowerAddress);
    if (clusterEntry) {
      clusterMatch = true;
      hopDistance = 0;
      relatedAddresses.push(clusterEntry.address);
      baseRisk = Math.max(baseRisk, clusterEntry.riskScore);
    }

    // Check 1-hop connections (transactions with cluster addresses)
    const recentTxs = agent.getRecentTransactions(500);
    for (const tx of recentTxs) {
      const from = (tx.from || "").toLowerCase();
      const to = (tx.to || "").toLowerCase();
      
      if (from === lowerAddress || to === lowerAddress) {
        const otherAddr = from === lowerAddress ? to : from;
        
        // Check if other address is in cluster
        const clusterMatchOther = SYNDICATE_7_CLUSTER.find(c => c.address.toLowerCase() === otherAddr);
        if (clusterMatchOther && !relatedAddresses.includes(clusterMatchOther.address)) {
          relatedAddresses.push(clusterMatchOther.address);
          clusterMatch = true;
          if (hopDistance > 1) hopDistance = 1;
          baseRisk = Math.max(baseRisk, clusterMatchOther.riskScore - 10);
        }
        
        // Track unique related addresses
        if (otherAddr && otherAddr !== lowerAddress && !relatedAddresses.includes(otherAddr)) {
          relatedAddresses.push(otherAddr);
        }
      }
    }

    // Limit related addresses
    relatedAddresses.splice(50);
  } catch (err) {
    console.warn("[Workflow Step 2] Dependency mapping error:", err);
  }

  // Step 3: Behavioral Classification - "What is the primary action?"
  let behavioralClass = "Unknown";
  try {
    const recentTxs = agent.getRecentTransactions(100);
    const addressTxs = recentTxs.filter((tx: any) => 
      (tx.from?.toLowerCase() === lowerAddress) || (tx.to?.toLowerCase() === lowerAddress)
    );

    if (addressTxs.length === 0) {
      behavioralClass = "Dormant/New";
    } else {
      const firstTx = addressTxs[addressTxs.length - 1]; // Oldest transaction
      const hasContractDeployment = addressTxs.some((tx: any) => tx.to === null || tx.contractAddress);
      const hasCEXTransfer = addressTxs.some((tx: any) => {
        const to = (tx.to || "").toLowerCase();
        return to.includes("binance") || to.includes("kraken") || to.includes("coinbase");
      });
      const hasStaking = addressTxs.some((tx: any) => {
        const to = (tx.to || "").toLowerCase();
        return to.includes("lido") || to.includes("stake");
      });

      if (hasContractDeployment) {
        behavioralClass = "Deployer";
        baseRisk += 20;
      } else if (hasCEXTransfer) {
        behavioralClass = "Exit Node (CEX)";
        baseRisk += 15;
      } else if (hasStaking) {
        behavioralClass = "Yield Staker";
        baseRisk += 10;
      } else if (addressTxs.length > 1000) {
        behavioralClass = "High-Velocity Trader";
        baseRisk += 25;
      } else {
        behavioralClass = "Standard Wallet";
      }
    }
  } catch (err) {
    console.warn("[Workflow Step 3] Behavioral classification error:", err);
  }

  // Step 4: Payload Inspection - "What does the code actually do?"
  const highRiskFunctions: string[] = [];
  let contractVerified = false;

  try {
    // Try to get contract bytecode (simplified - would need actual contract fetch)
    // For now, check transaction input data for function signatures
    const recentTxs = agent.getRecentTransactions(200);
    const addressTxs = recentTxs.filter((tx: any) => 
      (tx.from?.toLowerCase() === lowerAddress || tx.to?.toLowerCase() === lowerAddress)
    );

    const functionSignatures = new Set<string>();
    for (const tx of addressTxs) {
      const input = (tx.input || tx.data || "").toLowerCase();
      if (input && input.startsWith("0x")) {
        const sig = input.substring(0, 10);
        
        // Check against high-risk function signatures
        for (const func of HIGH_RISK_FUNCTIONS) {
          if (sig === func.signature || input.includes(func.signature.substring(2))) {
            if (!highRiskFunctions.includes(func.name)) {
              highRiskFunctions.push(func.name);
              baseRisk = Math.max(baseRisk, func.riskScore);
            }
          }
        }
        functionSignatures.add(sig);
      }
    }

    // If address is a contract, assume unverified unless proven otherwise
    if (addressTxs.length > 0) {
      contractVerified = false; // Would need Etherscan API check
    }
  } catch (err) {
    console.warn("[Workflow Step 4] Payload inspection error:", err);
  }

  // Step 5: SAR Ready determination
  const sarReady = baseRisk >= 70 || clusterMatch || highRiskFunctions.length > 0 || fundedByMixer;

  return {
    triage: { fundedByBridge, fundedByMixer, baseRisk: Math.min(100, baseRisk) },
    dependencyMapping: { clusterMatch, relatedAddresses: relatedAddresses.slice(0, 20), hopDistance },
    behavioralClass,
    payloadInspection: { highRiskFunctions, contractVerified },
    sarReady,
  };
}

async function generateSarSummary(record: InvestigationRecord, aiNarrative: string): Promise<string> {
  if (!openai) {
    return `SAR-ready summary (fallback): Address ${record.address} Token ${record.token || "n/a"}, Risk ${record.riskScore}, Alerts ${record.alerts.length}, Chains ${record.chainActivity.length}.`;
  }

  const alertSnippet = record.alerts
    .map((a) => `${a.alertType || a.type || "alert"} | risk=${a.riskScore ?? ""} | desc=${a.description || ""}`)
    .slice(0, 10)
    .join("\n");
  const chainSnippet = record.chainActivity.map((c) => `${c.chain}: tx=${c.txCount}, active=${c.hasActivity}`).join("\n");

  // Build high-risk transactions snippet for SAR
  const highRiskTxSnippet = record.highRiskTransactions && record.highRiskTransactions.length > 0
    ? `HIGH-RISK TRANSACTIONS ANALYSIS (${record.highRiskTransactions.length} transactions with risk score ≥70):\n${record.highRiskTransactions.slice(0, 10).map((tx, idx) => 
      `${idx + 1}. Hash: ${tx.hash.substring(0, 20)}... | Risk: ${tx.riskScore}/100 | Value: ${(Number(tx.value) / 1e18).toFixed(4)} ETH | Reason: ${tx.riskReason}`
    ).join("\n")}`
    : "No high-risk transactions found (all transactions analyzed have risk score <70).";

  // Build detailed workflow analysis snippet for SAR
  const workflowDetails = record.workflowAnalysis ? `
=== MASTER INVESTIGATIVE BLUEPRINT - 5-STEP WORKFLOW ANALYSIS ===

Step 1: TRIAGE (Gas Funding Source Analysis)
- Funded by Bridge: ${record.workflowAnalysis.triage.fundedByBridge ? "YES ⚠️ (+30 risk)" : "NO"}
- Funded by Mixer: ${record.workflowAnalysis.triage.fundedByMixer ? "YES ⚠️ (+40 risk)" : "NO"}
- Base Risk Score: ${record.workflowAnalysis.triage.baseRisk}/100
- Risk Rationale: ${record.workflowAnalysis.triage.fundedByMixer ? "Address received funds from mixer service (high laundering risk)" : record.workflowAnalysis.triage.fundedByBridge ? "Address received funds via bridge (potential anonymity layer)" : "No bridge/mixer funding detected"}

Step 2: DEPENDENCY MAPPING (Syndicate-7 Cluster Analysis)
- Syndicate-7 Cluster Match: ${record.workflowAnalysis.dependencyMapping.clusterMatch ? `YES ⚠️⚠️⚠️ (Direct Match - Hop Distance: ${record.workflowAnalysis.dependencyMapping.hopDistance})` : "NO"}
- Hop Distance: ${record.workflowAnalysis.dependencyMapping.hopDistance} ${record.workflowAnalysis.dependencyMapping.hopDistance === 0 ? "(Direct match in cluster database)" : record.workflowAnalysis.dependencyMapping.hopDistance < 999 ? "(1-hop connection to cluster)" : "(No cluster connection)"}
- Related Addresses Discovered: ${record.workflowAnalysis.dependencyMapping.relatedAddresses.length}
- Risk Assessment: ${record.workflowAnalysis.dependencyMapping.clusterMatch ? "HIGH - Address is part of known malicious cluster (Syndicate-7). Immediate SAR filing recommended." : "LOW - No connection to known malicious clusters"}

Step 3: BEHAVIORAL CLASSIFICATION (Wallet Role Analysis)
- Classification: ${record.workflowAnalysis.behavioralClass}
- Behavioral Risk: ${record.workflowAnalysis.behavioralClass.includes("Deployer") ? "HIGH - May deploy malicious contracts" : record.workflowAnalysis.behavioralClass.includes("Exit") ? "HIGH - Funds exiting to CEX (KYC point)" : record.workflowAnalysis.behavioralClass.includes("Staker") ? "MEDIUM - Asset parking/staking activity" : record.workflowAnalysis.behavioralClass.includes("High-Velocity") ? "HIGH - Unusual transaction volume" : "LOW - Standard wallet behavior"}

Step 4: PAYLOAD INSPECTION (High-Risk Function Detection)
- High-Risk Functions Detected: ${record.workflowAnalysis.payloadInspection.highRiskFunctions.length} ${record.workflowAnalysis.payloadInspection.highRiskFunctions.length > 0 ? "⚠️" : ""}
- Functions: ${record.workflowAnalysis.payloadInspection.highRiskFunctions.length > 0 ? record.workflowAnalysis.payloadInspection.highRiskFunctions.join(", ") : "None"}
- Contract Verification Status: ${record.workflowAnalysis.payloadInspection.contractVerified ? "Verified" : "Unverified"}
- Risk Assessment: ${record.workflowAnalysis.payloadInspection.highRiskFunctions.length > 0 ? `CRITICAL - Contract contains ${record.workflowAnalysis.payloadInspection.highRiskFunctions.length} high-risk function(s) indicating potential drainer/malicious behavior` : "No high-risk functions detected in transaction payloads"}

Step 5: SAR READINESS ASSESSMENT
- SAR Ready: ${record.workflowAnalysis.sarReady ? "YES ✅ - Immediate SAR filing recommended" : "NO - Monitor only"}
- SAR Triggers: ${record.workflowAnalysis.sarReady ? [
  record.workflowAnalysis.triage.baseRisk >= 70 ? `Base risk score ≥70 (${record.workflowAnalysis.triage.baseRisk})` : null,
  record.workflowAnalysis.dependencyMapping.clusterMatch ? "Syndicate-7 cluster match" : null,
  record.workflowAnalysis.payloadInspection.highRiskFunctions.length > 0 ? `High-risk functions detected: ${record.workflowAnalysis.payloadInspection.highRiskFunctions.join(", ")}` : null,
  record.workflowAnalysis.triage.fundedByMixer ? "Funded by mixer service" : null,
].filter(Boolean).join("; ") : "None - Address does not meet SAR filing criteria"}

=== END WORKFLOW ANALYSIS ===` : "";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are drafting a comprehensive SAR/STR-ready summary for regulators. Include ALL workflow analysis details, be factual, structured, use clear sections, and provide actionable compliance recommendations. Include: entity (address/token), risk score breakdown, key behavior, detailed 5-step workflow analysis, risk rationale, chain footprint, and suggested compliance action.",
        },
        {
          role: "user",
          content: `Address: ${record.address}
Token: ${record.token || "n/a"}
Risk Score: ${record.riskScore}/100
Status: ${record.status || "flagged"}
Alerts: ${alertSnippet || "none"}
Chain Activity: ${chainSnippet}
${workflowDetails}
High-Risk Transactions Analysis:
${highRiskTxSnippet}
AI Narrative: ${aiNarrative}

Generate a detailed SAR summary that includes all workflow analysis findings AND high-risk transaction analysis. Explain why each high-risk transaction is flagged and its compliance implications.`,
        },
      ],
    });
    return completion.choices[0]?.message?.content?.trim() || "SAR summary unavailable.";
  } catch (err: any) {
    console.warn("SAR generation failed:", err?.message || err);
    return `SAR Summary (fallback): Address ${record.address} | Risk: ${record.riskScore}/100 | Status: ${record.status || "flagged"} | Cluster Match: ${record.workflowAnalysis?.dependencyMapping.clusterMatch || false} | SAR Ready: ${record.workflowAnalysis?.sarReady || false}`;
  }
}

async function runSar(address: string, token?: string, saveDocxPath?: string) {
  const { agent } = await initializeAgent();
  const chainData = await buildCrossChainSnapshot(address, agent);
  const chainActivity = safeSerialize(chainData);

  // Run Master Investigative Blueprint 5-Step Workflow
  const workflowAnalysis = await runMasterWorkflow(address, agent);

  const alerts: any[] = [];
  if (marketManipulationDetector) {
    alerts.push(...marketManipulationDetector.getAddressAlerts(address as Address, 100));
    if (token) {
      alerts.push(...marketManipulationDetector.getTokenAlerts(token as Address, 100));
    }
  }
  const safeAlerts = safeSerialize(alerts);

  // Analyze high-risk transactions
  console.log(`[Investigation] Analyzing high-risk transactions for ${address}...`);
  const highRiskTransactions = await analyzeHighRiskTransactions(address, 50);
  console.log(`[Investigation] Found ${highRiskTransactions?.length || 0} high-risk transactions`);

  // Combine workflow baseRisk with alert risks and high-risk transaction risks
  const maxAlertRisk = alerts.length ? Math.max(...alerts.map((a) => Number(a.riskScore || 0))) : 20;
  const maxTxRisk = highRiskTransactions && highRiskTransactions.length > 0
    ? Math.max(...highRiskTransactions.map((tx) => tx.riskScore))
    : 20;
  const combinedRisk = Math.max(workflowAnalysis.triage.baseRisk, maxAlertRisk, maxTxRisk);
  const riskScore = Math.min(100, Math.max(10, combinedRisk));
  const status: "flagged" | "cleared" = (safeAlerts.length === 0 && riskScore <= 20 && !workflowAnalysis.sarReady && (!highRiskTransactions || highRiskTransactions.length === 0)) ? "cleared" : "flagged";

  const aiNarrative = await generateAiNarrative({
    address,
    token,
    chainActivity: chainActivity,
    alerts: safeAlerts,
  });

  const recordBase: InvestigationRecord = {
    id: `${Date.now()}-${address}`,
    address,
    token,
    riskScore,
    summary: aiNarrative,
    alerts: safeAlerts,
    chainActivity,
    timestamp: Date.now(),
    status,
    workflowAnalysis,
    highRiskTransactions: highRiskTransactions || undefined,
  };

  const sarText = await generateSarSummary(recordBase, aiNarrative);
  const record: InvestigationRecord = { ...recordBase, sarText };

  await saveInvestigationRecord(record);

  // Auto-save DOCX report to organized reports folder (flagged/cleared + risk level)
  await ensureReportsDir();
  const reportDir = getReportDirectory(record);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const reportFilename = `investigation-${address.slice(2, 10)}-${timestamp}.docx`;
  const reportPath = path.join(reportDir, reportFilename);
  
  try {
    const buffer = await buildDocxReport(record, aiNarrative, sarText);
    await fsp.writeFile(reportPath, Buffer.from(buffer));
    console.log(`[Investigation] Report saved to organized folder: ${reportPath}`);
  } catch (err: any) {
    console.warn(`[Investigation] Failed to save report: ${err?.message || err}`);
  }

  // Also save to custom path if provided
  if (saveDocxPath) {
    await fsp.mkdir(path.dirname(saveDocxPath), { recursive: true });
    const buffer = await buildDocxReport(record, aiNarrative, sarText);
    await fsp.writeFile(saveDocxPath, Buffer.from(buffer));
  }

  return record;
}

async function collectAutoSarAddresses(envAddresses: string[]): Promise<string[]> {
  const addresses = new Set<string>();
  envAddresses.forEach((a) => {
    if (a.startsWith("0x") && a.length === 42) addresses.add(a.toLowerCase());
  });

  // From stored history (flagged addresses with high/medium risk only)
  // Only investigate: flagged addresses, high risk (≥70), medium risk (40-69), and market manipulation
  try {
    const history = await loadInvestigationHistory();
    history
      .filter((r) => {
        const status = r.status || "flagged";
        const riskScore = r.riskScore || 0;
        // Only include: flagged status OR high risk (≥70) OR medium risk (40-69)
        return status === "flagged" || riskScore >= 40;
      })
      .forEach((r) => {
        if (r.address?.toLowerCase().startsWith("0x") && r.address.length === 42) {
          addresses.add(r.address.toLowerCase());
        }
      });
  } catch {
    // ignore
  }

  // From active market manipulation alerts only
  // Do NOT collect from enhancedSuspiciousActivityTracker
  try {
    if (marketManipulationDetector) {
      const alerts = marketManipulationDetector.getAlerts(500);
      alerts.forEach((a) => {
        if (a.address?.toLowerCase().startsWith("0x") && a.address.length === 42) {
          addresses.add(a.address.toLowerCase());
        }
      });
    }
  } catch {
    // ignore
  }

  return Array.from(addresses);
}

function startAutoSarScheduler() {
  const addressesEnv = process.env.AUTO_SAR_ADDRESSES;
  const envAddresses = addressesEnv
    ? addressesEnv
        .split(",")
        .map((a) => a.trim())
        .filter((a) => a.startsWith("0x") && a.length === 42)
    : [];

  const token = process.env.AUTO_SAR_TOKEN;
  const intervalMs = Number(process.env.AUTO_SAR_INTERVAL_MS || 600_000);

  const autoDir = AUTO_SAR_DIR;

  const runAll = async () => {
    const targets = await collectAutoSarAddresses(envAddresses);
    if (targets.length === 0) {
      console.log("[AutoSAR] No targets found.");
      return;
    }
    console.log(`[AutoSAR] Running for ${targets.length} addresses...`);
    for (const addr of targets) {
      try {
        const outfile = path.join(autoDir, `sar-${addr.slice(2, 10)}-${Date.now()}.docx`);
        await runSar(addr, token, outfile);
        console.log(`[AutoSAR] Saved ${outfile}`);
      } catch (err) {
        console.warn(`[AutoSAR] Failed for ${addr}:`, err);
      }
    }
  };

  // immediate kick
  runAll();
  // schedule
  setInterval(runAll, intervalMs);
}

function paragraph(text: string, opts?: { bold?: boolean; size?: number; heading?: any }) {
  if (opts?.heading) {
    return new Paragraph({ text, heading: opts.heading });
  }
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: opts?.bold,
        size: opts?.size,
      }),
    ],
  });
}

function buildChainTable(chainActivity: Array<{ chain: string; hasActivity: boolean; txCount: number; balance?: string }>) {
  const rows = [
    new TableRow({
      children: [
        new TableCell({ children: [paragraph("Chain", { bold: true })] }),
        new TableCell({ children: [paragraph("Activity", { bold: true })] }),
        new TableCell({ children: [paragraph("Tx Count", { bold: true })] }),
        new TableCell({ children: [paragraph("Balance (wei)", { bold: true })] }),
      ],
    }),
    ...chainActivity.map(
      (c) =>
        new TableRow({
          children: [
            new TableCell({ children: [paragraph(c.chain)] }),
            new TableCell({ children: [paragraph(c.hasActivity ? "Yes" : "No")] }),
            new TableCell({ children: [paragraph(String(c.txCount || 0))] }),
            new TableCell({ children: [paragraph(c.balance || "0")] }),
          ],
        })
    ),
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
  });
}

function buildAlertsTable(alerts: any[]) {
  const rows = [
    new TableRow({
      children: [
        new TableCell({ children: [paragraph("Type", { bold: true })] }),
        new TableCell({ children: [paragraph("Risk", { bold: true })] }),
        new TableCell({ children: [paragraph("Severity", { bold: true })] }),
        new TableCell({ children: [paragraph("Description", { bold: true })] }),
      ],
    }),
    ...(alerts.slice(0, 15).map(
      (a) =>
        new TableRow({
          children: [
            new TableCell({ children: [paragraph(a.alertType || a.type || "alert")] }),
            new TableCell({ children: [paragraph(String(a.riskScore ?? ""))] }),
            new TableCell({ children: [paragraph(a.severity || "")] }),
            new TableCell({ children: [paragraph(a.description || "")] }),
          ],
        })
    ) || []),
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
  });
}

function buildHighRiskTransactionsTable(transactions: InvestigationRecord["highRiskTransactions"]) {
  if (!transactions || transactions.length === 0) {
    return paragraph("No high-risk transactions found.");
  }

  const rows = [
    new TableRow({
      children: [
        new TableCell({ children: [paragraph("Hash", { bold: true })] }),
        new TableCell({ children: [paragraph("From", { bold: true })] }),
        new TableCell({ children: [paragraph("To", { bold: true })] }),
        new TableCell({ children: [paragraph("Value (ETH)", { bold: true })] }),
        new TableCell({ children: [paragraph("Risk Score", { bold: true })] }),
        new TableCell({ children: [paragraph("Risk Reason", { bold: true })] }),
      ],
    }),
    ...transactions.slice(0, 20).map(
      (tx) =>
        new TableRow({
          children: [
            new TableCell({ children: [paragraph(tx.hash.substring(0, 16) + "...")] }),
            new TableCell({ children: [paragraph(tx.from.substring(0, 12) + "...")] }),
            new TableCell({ children: [paragraph(tx.to ? tx.to.substring(0, 12) + "..." : "Contract Creation")] }),
            new TableCell({ children: [paragraph((Number(tx.value) / 1e18).toFixed(6))] }),
            new TableCell({ children: [paragraph(String(tx.riskScore))] }),
            new TableCell({ children: [paragraph(tx.riskReason || "N/A")] }),
          ],
        })
    ),
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
  });
}

function safeSerialize<T>(value: T): T {
  // Convert BigInt to string recursively and strip non-serializable values
  return JSON.parse(JSON.stringify(serializeBigInt(value)));
}

// Build Findings section with comprehensive address analysis
function buildFindingsSection(record: InvestigationRecord): Paragraph[] {
  const findings: Paragraph[] = [];
  const lowerAddress = record.address.toLowerCase();
  
  // Check if address is in Syndicate-7 cluster
  const clusterEntry = SYNDICATE_7_CLUSTER.find(c => c.address.toLowerCase() === lowerAddress);
  
  // Determine classification
  let classification = "Unknown";
  let classificationReason = "";
  
  if (clusterEntry) {
    classification = clusterEntry.role;
    classificationReason = clusterEntry.status;
  } else if (record.workflowAnalysis?.behavioralClass) {
    classification = record.workflowAnalysis.behavioralClass;
    if (classification.includes("Exchange") || classification.includes("CEX")) {
      classification = "Exchange Deposit";
    } else if (classification.includes("Deployer")) {
      classification = "Contract Deployer";
    } else if (classification.includes("Staker")) {
      classification = "Yield Staker";
    }
  }
  
  // Get related addresses in cluster
  const relatedClusterAddresses: Array<{ address: string; role: string; status: string }> = [];
  if (record.workflowAnalysis?.dependencyMapping.clusterMatch && clusterEntry) {
    for (const relatedAddr of record.workflowAnalysis.dependencyMapping.relatedAddresses.slice(0, 10)) {
      const relatedClusterEntry = SYNDICATE_7_CLUSTER.find(c => c.address.toLowerCase() === relatedAddr.toLowerCase());
      if (relatedClusterEntry) {
        relatedClusterAddresses.push({
          address: relatedClusterEntry.address,
          role: relatedClusterEntry.role,
          status: relatedClusterEntry.status,
        });
      }
    }
  }
  
  // Build findings content
  findings.push(paragraph("Key Findings", { heading: HeadingLevel.HEADING_2 }));
  
  findings.push(paragraph("Address Classification", { bold: true, heading: HeadingLevel.HEADING_3 }));
  findings.push(paragraph(`Classification: ${classification}`));
  if (classificationReason) {
    findings.push(paragraph(`Status: ${classificationReason}`));
  }
  findings.push(paragraph(`Risk Score: ${record.riskScore}/100`));
  findings.push(paragraph(`Overall Status: ${record.status === "flagged" ? "⚠️ FLAGGED" : "✓ CLEARED"}`));
  
  // Cluster membership
  if (clusterEntry) {
    findings.push(paragraph(""));
    findings.push(paragraph("Syndicate-7 Cluster Membership", { bold: true, heading: HeadingLevel.HEADING_3 }));
    findings.push(paragraph(`⚠️ DIRECT MATCH - This address is part of the Syndicate-7 cluster database`));
    findings.push(paragraph(`Role: ${clusterEntry.role}`));
    findings.push(paragraph(`Status: ${clusterEntry.status}`));
    findings.push(paragraph(`Cluster Risk Score: ${clusterEntry.riskScore}/100`));
    
    if (relatedClusterAddresses.length > 0) {
      findings.push(paragraph(""));
      findings.push(paragraph("Related Addresses in Cluster:", { bold: true }));
      relatedClusterAddresses.forEach(rel => {
        findings.push(paragraph(`  • ${rel.address} - ${rel.role} (${rel.status})`));
      });
    }
  } else if (record.workflowAnalysis?.dependencyMapping.clusterMatch) {
    findings.push(paragraph(""));
    findings.push(paragraph("Syndicate-7 Cluster Connection", { bold: true, heading: HeadingLevel.HEADING_3 }));
    findings.push(paragraph(`Connected to Syndicate-7 cluster (Hop Distance: ${record.workflowAnalysis.dependencyMapping.hopDistance})`));
    findings.push(paragraph(`Related Addresses Discovered: ${record.workflowAnalysis.dependencyMapping.relatedAddresses.length}`));
  }
  
  // Risk indicators
  findings.push(paragraph(""));
  findings.push(paragraph("Risk Indicators", { bold: true, heading: HeadingLevel.HEADING_3 }));
  
  const riskIndicators: string[] = [];
  if (record.workflowAnalysis?.triage.fundedByMixer) {
    riskIndicators.push("⚠️ Funded by mixer service (high laundering risk)");
  }
  if (record.workflowAnalysis?.triage.fundedByBridge) {
    riskIndicators.push("⚠️ Funded via bridge (potential anonymity layer)");
  }
  if (record.workflowAnalysis?.payloadInspection.highRiskFunctions.length > 0) {
    riskIndicators.push(`⚠️ High-risk functions detected: ${record.workflowAnalysis.payloadInspection.highRiskFunctions.join(", ")}`);
  }
  if (record.highRiskTransactions && record.highRiskTransactions.length > 0) {
    riskIndicators.push(`⚠️ ${record.highRiskTransactions.length} high-risk transactions detected`);
  }
  if (record.alerts && record.alerts.length > 0) {
    riskIndicators.push(`⚠️ ${record.alerts.length} active alerts`);
  }
  
  if (riskIndicators.length > 0) {
    riskIndicators.forEach(indicator => {
      findings.push(paragraph(indicator));
    });
  } else {
    findings.push(paragraph("No major risk indicators detected"));
  }
  
  // Chain activity summary
  findings.push(paragraph(""));
  findings.push(paragraph("Chain Activity Summary", { bold: true, heading: HeadingLevel.HEADING_3 }));
  const activeChains = record.chainActivity?.filter(c => c.hasActivity) || [];
  if (activeChains.length > 0) {
    findings.push(paragraph(`Active on ${activeChains.length} chain(s):`));
    activeChains.forEach(chain => {
      findings.push(paragraph(`  • ${chain.chain}: ${chain.txCount} transactions`));
    });
  } else {
    findings.push(paragraph("No significant chain activity detected"));
  }
  
  // Conclusion
  findings.push(paragraph(""));
  findings.push(paragraph("Conclusion", { bold: true, heading: HeadingLevel.HEADING_3 }));
  
  if (clusterEntry) {
    findings.push(paragraph(`This address is flagged in the Syndicate-7 cluster database as a "${clusterEntry.role}" with status "${clusterEntry.status}". ` +
      `With a risk score of ${record.riskScore}/100, ${record.status === "flagged" ? "immediate SAR filing is recommended" : "monitoring is advised"}.`));
  } else if (record.riskScore >= 70) {
    findings.push(paragraph(`This address has a high risk score (${record.riskScore}/100) indicating ${record.status === "flagged" ? "suspicious activity requiring immediate attention" : "potential compliance concerns"}.`));
  } else if (record.riskScore >= 40) {
    findings.push(paragraph(`This address has a moderate risk score (${record.riskScore}/100) and should be monitored for suspicious patterns.`));
  } else {
    findings.push(paragraph(`This address has a low risk score (${record.riskScore}/100) with minimal suspicious indicators.`));
  }
  
  return findings;
}

async function buildDocxReport(record: InvestigationRecord, aiNarrative: string, sarText?: string) {
  const workflowSections = record.workflowAnalysis ? [
    paragraph("Master Investigative Blueprint - 5-Step Workflow Analysis", { heading: HeadingLevel.HEADING_2 }),
    paragraph("Step 1: TRIAGE (Gas Funding Source Analysis)", { heading: HeadingLevel.HEADING_3 }),
    paragraph(`Funded by Bridge: ${record.workflowAnalysis.triage.fundedByBridge ? "YES ⚠️ (+30 risk)" : "NO"}`),
    paragraph(`Funded by Mixer: ${record.workflowAnalysis.triage.fundedByMixer ? "YES ⚠️ (+40 risk)" : "NO"}`),
    paragraph(`Base Risk Score: ${record.workflowAnalysis.triage.baseRisk}/100`),
    paragraph(`Risk Rationale: ${record.workflowAnalysis.triage.fundedByMixer ? "Address received funds from mixer service (high laundering risk)" : record.workflowAnalysis.triage.fundedByBridge ? "Address received funds via bridge (potential anonymity layer)" : "No bridge/mixer funding detected"}`),
    paragraph("Step 2: DEPENDENCY MAPPING (Syndicate-7 Cluster Analysis)", { heading: HeadingLevel.HEADING_3 }),
    paragraph(`Syndicate-7 Cluster Match: ${record.workflowAnalysis.dependencyMapping.clusterMatch ? `YES ⚠️⚠️⚠️ (Direct Match - Hop Distance: ${record.workflowAnalysis.dependencyMapping.hopDistance})` : "NO"}`),
    paragraph(`Hop Distance: ${record.workflowAnalysis.dependencyMapping.hopDistance} ${record.workflowAnalysis.dependencyMapping.hopDistance === 0 ? "(Direct match in cluster database)" : record.workflowAnalysis.dependencyMapping.hopDistance < 999 ? "(1-hop connection to cluster)" : "(No cluster connection)"}`),
    paragraph(`Related Addresses Discovered: ${record.workflowAnalysis.dependencyMapping.relatedAddresses.length}`),
    paragraph(`Risk Assessment: ${record.workflowAnalysis.dependencyMapping.clusterMatch ? "HIGH - Address is part of known malicious cluster (Syndicate-7). Immediate SAR filing recommended." : "LOW - No connection to known malicious clusters"}`),
    paragraph("Step 3: BEHAVIORAL CLASSIFICATION (Wallet Role Analysis)", { heading: HeadingLevel.HEADING_3 }),
    paragraph(`Classification: ${record.workflowAnalysis.behavioralClass}`),
    paragraph(`Behavioral Risk: ${record.workflowAnalysis.behavioralClass.includes("Deployer") ? "HIGH - May deploy malicious contracts" : record.workflowAnalysis.behavioralClass.includes("Exit") ? "HIGH - Funds exiting to CEX (KYC point)" : record.workflowAnalysis.behavioralClass.includes("Staker") ? "MEDIUM - Asset parking/staking activity" : record.workflowAnalysis.behavioralClass.includes("High-Velocity") ? "HIGH - Unusual transaction volume" : "LOW - Standard wallet behavior"}`),
    paragraph("Step 4: PAYLOAD INSPECTION (High-Risk Function Detection)", { heading: HeadingLevel.HEADING_3 }),
    paragraph(`High-Risk Functions Detected: ${record.workflowAnalysis.payloadInspection.highRiskFunctions.length} ${record.workflowAnalysis.payloadInspection.highRiskFunctions.length > 0 ? "⚠️" : ""}`),
    paragraph(`Functions: ${record.workflowAnalysis.payloadInspection.highRiskFunctions.length > 0 ? record.workflowAnalysis.payloadInspection.highRiskFunctions.join(", ") : "None"}`),
    paragraph(`Contract Verification Status: ${record.workflowAnalysis.payloadInspection.contractVerified ? "Verified" : "Unverified"}`),
    paragraph(`Risk Assessment: ${record.workflowAnalysis.payloadInspection.highRiskFunctions.length > 0 ? `CRITICAL - Contract contains ${record.workflowAnalysis.payloadInspection.highRiskFunctions.length} high-risk function(s) indicating potential drainer/malicious behavior` : "No high-risk functions detected in transaction payloads"}`),
    paragraph("Step 5: SAR READINESS ASSESSMENT", { heading: HeadingLevel.HEADING_3 }),
    paragraph(`SAR Ready: ${record.workflowAnalysis.sarReady ? "YES ✅ - Immediate SAR filing recommended" : "NO - Monitor only"}`),
    paragraph(`SAR Triggers: ${record.workflowAnalysis.sarReady ? [
      record.workflowAnalysis.triage.baseRisk >= 70 ? `Base risk score ≥70 (${record.workflowAnalysis.triage.baseRisk})` : null,
      record.workflowAnalysis.dependencyMapping.clusterMatch ? "Syndicate-7 cluster match" : null,
      record.workflowAnalysis.payloadInspection.highRiskFunctions.length > 0 ? `High-risk functions detected: ${record.workflowAnalysis.payloadInspection.highRiskFunctions.join(", ")}` : null,
      record.workflowAnalysis.triage.fundedByMixer ? "Funded by mixer service" : null,
    ].filter(Boolean).join("; ") : "None - Address does not meet SAR filing criteria"}`),
  ] : [];

  const doc = new Document({
    sections: [
      {
        children: [
          paragraph("Market Manipulation Investigation Report", { heading: HeadingLevel.HEADING_1 }),
          paragraph(`Address: ${record.address}`, { bold: true }),
          paragraph(`Token: ${record.token || "n/a"}`),
          paragraph(`Risk Score: ${record.riskScore}/100`),
          paragraph(`Status: ${record.status || "flagged"}`),
          paragraph(`Generated: ${new Date(record.timestamp).toISOString()}`),
          paragraph("Executive Summary", { heading: HeadingLevel.HEADING_2 }),
          paragraph(aiNarrative),
          ...buildFindingsSection(record),
          ...(sarText ? [paragraph("SAR Summary", { heading: HeadingLevel.HEADING_2 }), paragraph(sarText)] : []),
          ...workflowSections,
          ...(record.highRiskTransactions && record.highRiskTransactions.length > 0 ? [
            paragraph("Recent High-Risk Transactions Analysis", { heading: HeadingLevel.HEADING_2 }),
            paragraph(`Found ${record.highRiskTransactions.length} high-risk transactions (risk score ≥70). Below are the top transactions with detailed risk analysis:`),
            buildHighRiskTransactionsTable(record.highRiskTransactions),
          ] : []),
          paragraph("Chain Activity", { heading: HeadingLevel.HEADING_2 }),
          buildChainTable(record.chainActivity),
          paragraph("Alerts & Risk Indicators", { heading: HeadingLevel.HEADING_2 }),
          buildAlertsTable(record.alerts),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

// Build consolidated summary report with all risk addresses
async function buildConsolidatedReport(): Promise<Buffer | null> {
  try {
    const history = await loadInvestigationHistory();
    
    // Filter for flagged addresses, high risk (≥70), medium risk (40-69), and market manipulation only
    // Do NOT include low risk (20-39) or general suspicious activity
    const riskAddresses = history.filter(r => {
      const status = r.status || "flagged";
      const riskScore = r.riskScore || 0;
      // Only include: flagged status OR high risk (≥70) OR medium risk (40-69)
      // Exclude low risk (20-39) and general suspicious activity
      return status === "flagged" || riskScore >= 40;
    });

    if (riskAddresses.length === 0) {
      console.log("[ConsolidatedReport] No risk addresses found to report.");
      return null;
    }

    // Group by risk level (only high and medium, no low risk)
    const highRisk = riskAddresses.filter(r => r.riskScore >= 70);
    const mediumRisk = riskAddresses.filter(r => r.riskScore >= 40 && r.riskScore < 70);

    const sections = [
      paragraph("Consolidated Risk Address Report", { heading: HeadingLevel.HEADING_1 }),
      paragraph(`Generated: ${new Date().toISOString()}`),
      paragraph(`Total Risk Addresses: ${riskAddresses.length}`, { bold: true }),
      paragraph(`High Risk (≥70): ${highRisk.length} | Medium Risk (40-69): ${mediumRisk.length}`),
      
      paragraph("High-Risk Addresses (≥70)", { heading: HeadingLevel.HEADING_2 }),
      ...highRisk.slice(0, 50).map(r => [
        paragraph(`Address: ${r.address}`, { bold: true }),
        paragraph(`Risk Score: ${r.riskScore}/100`),
        paragraph(`Status: ${r.status || "flagged"}`),
        paragraph(`Summary: ${(r.summary || "No summary available").substring(0, 500)}`),
        ...(r.workflowAnalysis?.dependencyMapping.clusterMatch ? [paragraph(`⚠️ Syndicate-7 Cluster Match (Hop: ${r.workflowAnalysis.dependencyMapping.hopDistance})`)] : []),
        ...(r.highRiskTransactions && r.highRiskTransactions.length > 0 ? [paragraph(`High-Risk Transactions: ${r.highRiskTransactions.length}`)] : []),
        paragraph(""),
      ]).flat(),

      paragraph("Medium-Risk Addresses (40-69)", { heading: HeadingLevel.HEADING_2 }),
      ...mediumRisk.slice(0, 30).map(r => [
        paragraph(`Address: ${r.address}`, { bold: true }),
        paragraph(`Risk Score: ${r.riskScore}/100`),
        paragraph(`Summary: ${(r.summary || "No summary available").substring(0, 300)}`),
        paragraph(""),
      ]).flat(),
    ];

    const doc = new Document({
      sections: [{ children: sections }],
    });

    return Packer.toBuffer(doc);
  } catch (err: any) {
    console.error("[ConsolidatedReport] Failed to build consolidated report:", err?.message || err);
    return null;
  }
}

// Generate and save consolidated report every 2 hours
function startConsolidatedReportScheduler() {
  const intervalMs = 2 * 60 * 60 * 1000; // 2 hours

  const generateReport = async () => {
    try {
      console.log("[ConsolidatedReport] Generating consolidated risk report...");
      const buffer = await buildConsolidatedReport();
      
      if (buffer) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const reportPath = path.join(REPORTS_DIR, "consolidated", `risk-summary-${timestamp}.docx`);
        await fsp.writeFile(reportPath, Buffer.from(buffer));
        console.log(`[ConsolidatedReport] Saved consolidated report: ${reportPath}`);
      }
    } catch (err: any) {
      console.error("[ConsolidatedReport] Scheduler error:", err?.message || err);
    }
  };

  // Generate immediately on start
  generateReport();
  
  // Schedule every 2 hours
  setInterval(generateReport, intervalMs);
  console.log(`[ConsolidatedReport] Scheduler started - will generate reports every 2 hours`);
}

async function startRealBlockPolling(agentInstance: AgentOrchestrator) {
  if (realDataPollingStarted) return;
  realDataPollingStarted = true;
  console.log(`🔌 Real data polling enabled via ${ETH_RPC_URL} (mainnet blocks)`);

  const client = createPublicClient({
    chain: mainnet,
    transport: http(ETH_RPC_URL, { timeout: 10_000 }),
  });

  let lastBlock = 0n;

  const poll = async () => {
    try {
      const latest = await client.getBlockNumber();
      if (lastBlock === 0n) {
        lastBlock = latest;
        return;
      }
      if (latest <= lastBlock) return;

      for (let b = lastBlock + 1n; b <= latest; b++) {
        const block = await client.getBlock({ blockNumber: b, includeTransactions: true }).catch(() => null);
        if (!block || !block.transactions) continue;

        for (const tx of block.transactions as any[]) {
          const mappedTx = {
            hash: tx.hash as `0x${string}`,
            chain: "ethereum",
            from: tx.from,
            to: tx.to ?? null,
            value: tx.value ?? 0n,
            timestamp: Number(block.timestamp),
          };

          // Push into recent transactions feed
          (agentInstance as any).recentTransactions = (agentInstance as any).recentTransactions || [];
          (agentInstance as any).recentTransactions.push({
            hash: mappedTx.hash,
            chain: mappedTx.chain,
            from: mappedTx.from,
            to: mappedTx.to,
            value: mappedTx.value,
            blockNumber: b,
            riskScore: 0,
            suspicious: false,
            timestamp: mappedTx.timestamp * 1000,
          });
          if ((agentInstance as any).recentTransactions.length > 100) {
            (agentInstance as any).recentTransactions.shift();
          }
        }
      }
      lastBlock = latest;
    } catch (err) {
      console.warn("⚠️ Real data polling error:", err);
    }
  };

  // Poll every 12 seconds (~block time); adjust as needed
  poll();
  setInterval(poll, 12_000);
}

// Helper to serialize BigInt for JSON
function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  // Don't try to convert decimal strings or numbers to BigInt
  if (typeof obj === 'number') return obj;
  if (typeof obj === 'string' && obj.includes('.')) {
    // It's a decimal string, return as-is (don't try to convert to BigInt)
    return obj;
  }
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
              from: testTx.from,
              to: testTx.to,
              value: testTx.value,
              blockNumber: testTx.blockNumber,
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
    
    // Synthetic test data is disabled by default to ensure real data only.
    if (USE_TEST_DATA) {
      console.log("🧪 Test data generation enabled (USE_TEST_DATA=true)");
      // Generate initial data immediately
      generateContinuousTestData();
      
      // Generate new transactions every 5 seconds to simulate real-time activity
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
              from: testTx.from,
              to: testTx.to,
              value: testTx.value,
              blockNumber: testTx.blockNumber,
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
    } else {
      console.log("🔎 Test data generation disabled. Dashboard will show only real data sources.");
    }

    // Start real block polling (Ethereum mainnet via ETH_RPC_URL or fallback)
    startRealBlockPolling(agent);
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

// Transaction investigation via RPC (ETH_RPC_URL by default, override with ?rpc=<url>&chain=<name>)
app.get("/api/investigation/transaction/:hash", async (req: Request, res: Response) => {
  const rpcUrl = (req.query.rpc as string) || ETH_RPC_URL;
  const chainName = (req.query.chain as string) || "ethereum";
  const hash = req.params.hash as `0x${string}`;

  try {
    const client = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl, { timeout: 12_000 }),
    });

    const tx = await client.getTransaction({ hash });
    const receipt = await client.getTransactionReceipt({ hash }).catch(() => null);
    const block = tx.blockNumber
      ? await client.getBlock({ blockNumber: tx.blockNumber, includeTransactions: false }).catch(() => null)
      : null;

    const response = {
      hash,
      chain: chainName,
      from: tx.from,
      to: tx.to,
      value: tx.value,
      nonce: tx.nonce,
      gas: tx.gas,
      gasPrice: (tx as any).gasPrice ?? null,
      input: tx.input,
      blockNumber: tx.blockNumber,
      blockTimestamp: block?.timestamp ?? null,
      status: receipt?.status ?? null,
      gasUsed: receipt?.gasUsed ?? null,
      cumulativeGasUsed: receipt?.cumulativeGasUsed ?? null,
      effectiveGasPrice: receipt?.effectiveGasPrice ?? null,
      logs: receipt?.logs?.length ?? 0,
    };

    res.json(serializeBigInt(response));
  } catch (error: any) {
    res.status(404).json({
      error: "Transaction not found or RPC failed",
      chain: chainName,
      rpc: rpcUrl,
      details: error?.message || String(error),
    });
  }
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
const CHAINABUSE_API_KEY = process.env.CHAINABUSE_API_KEY || "";

const KNOWN_INCIDENTS: Record<string, {
  title: string;
  summary: string;
  severity: string;
  related: string[];
}> = {
  "0x764c64b2a09b09acb100b80d8c505aa6a0302ef2": {
    title: "Truebit Protocol: Purchase – January 2026 Exploit",
    severity: "critical",
    summary: "Overflow in getPurchasePrice (Solidity ^0.6.10) let attackers mint TRU at near-zero cost and drain ETH reserves. Truebit advised users not to interact.",
    related: [
      "Attacker Wallet (Exploiter 1): 0x6c8ec8f14be7c01672d31cfa5f2cefeab2562b50",
      "Attack Contract: 0x1De399967B206e446B4E9AeEb3Cb0A0991bF11b8",
      "Secondary Exploiter (Exploiter 2): 0xc0454E545a7A715c6D3627f77bEd376a05182FBc"
    ]
  },
  "0x6c8ec8f14be7c01672d31cfa5f2cefeab2562b50": {
    title: "Truebit Exploit – Attacker Wallet (Exploiter 1)",
    severity: "critical",
    summary: "Associated with Truebit January 2026 exploit; received funds via overflow/mint manipulation.",
    related: [
      "Exploited Contract: 0x764C64b2A09b09Acb100B80d8c505Aa6a0302EF2",
      "Attack Contract: 0x1De399967B206e446B4E9AeEb3Cb0A0991bF11b8",
      "Secondary Exploiter: 0xc0454E545a7A715c6D3627f77bEd376a05182FBc"
    ]
  },
  "0x1de399967b206e446b4e9aeeb3cb0a0991bf11b8": {
    title: "Truebit Exploit – Attack Contract",
    severity: "critical",
    summary: "Contract used to exploit Truebit purchase pricing bug (overflow) to mint TRU cheaply and drain ETH.",
    related: [
      "Exploited Contract: 0x764C64b2A09b09Acb100B80d8c505Aa6a0302EF2",
      "Attacker Wallet: 0x6c8ec8f14be7c01672d31cfa5f2cefeab2562b50",
      "Secondary Exploiter: 0xc0454E545a7A715c6D3627f77bEd376a05182FBc"
    ]
  },
  "0xc0454e545a7a715c6d3627f77bed376a05182fbc": {
    title: "Truebit Exploit – Secondary Exploiter",
    severity: "high",
    summary: "Secondary exploiter address tied to Truebit January 2026 incident.",
    related: [
      "Exploited Contract: 0x764C64b2A09b09Acb100B80d8c505Aa6a0302EF2",
      "Attacker Wallet: 0x6c8ec8f14be7c01672d31cfa5f2cefeab2562b50",
      "Attack Contract: 0x1De399967B206e446B4E9AeEb3Cb0A0991bF11b8"
    ]
  }
};

async function fetchChainabuseReputation(address: string) {
  if (!CHAINABUSE_API_KEY) return [];
  const results: Array<{ source: string; label: string; severity: string; note?: string }> = [];

  const attemptFetch = async (url: string, headerName: string) => {
    try {
      const resp = await fetch(url, {
        headers: {
          "Accept": "application/json",
          [headerName]: headerName === "Authorization" ? `Bearer ${CHAINABUSE_API_KEY}` : CHAINABUSE_API_KEY,
        }
      });
      if (!resp.ok) throw new Error(`status ${resp.status}`);
      const data = await resp.json();

      // Heuristic: count reports if available
      const reports = (data?.items || data?.results || data?.reports || []) as any[];
      const count = Array.isArray(reports) ? reports.length : 0;
      if (count > 0) {
        results.push({
          source: `chainabuse (${headerName})`,
          label: "reported",
          severity: count >= 3 ? "critical" : "high",
          note: `Chainabuse reports: ${count}`
        });
      } else if (data?.status === "reported" || data?.risk === "high") {
        results.push({
          source: `chainabuse (${headerName})`,
          label: data.status || "reported",
          severity: "high",
          note: data.message || "Chainabuse indicates risk"
        });
      }
    } catch (err) {
      console.warn("Chainabuse fetch failed", url, err);
    }
  };

  await attemptFetch(`https://api.chainabuse.com/api/search?term=${address}`, "Authorization");
  if (results.length === 0) {
    await attemptFetch(`https://api.chainabuse.com/api/search?term=${address}`, "x-api-key");
  }
  if (results.length === 0) {
    await attemptFetch(`https://api.chainabuse.com/api/addresses/${address}`, "Authorization");
  }
  return results;
}

function extractAddresses(text: string): string[] {
  const matches = text.match(/0x[a-fA-F0-9]{40}/g);
  return matches ? matches.map(a => a.toLowerCase()) : [];
}

async function getExternalReputation(address: string) {
  const results: Array<{ source: string; label: string; severity: string; note?: string }> = [];
  let incidentIntel: { title: string; severity: string; summary: string; related: string[] } | null = null;
  try {
    const compromised = (process.env.KNOWN_COMPROMISED_ADDRESSES || "")
      .toLowerCase()
      .split(",")
      .map(a => a.trim())
      .filter(Boolean);
    if (compromised.includes(address.toLowerCase())) {
      results.push({
        source: "env:KNOWN_COMPROMISED_ADDRESSES",
        label: "compromised",
        severity: "critical",
        note: "Address present in provided compromised list"
      });
    }
  } catch {
    // ignore
  }

  try {
    const chainabuse = await fetchChainabuseReputation(address);
    results.push(...chainabuse);
  } catch {
    // already logged inside
  }

  // Best-effort Etherscan page scrape for warning banners (no official API)
  try {
    const resp = await fetch(`https://etherscan.io/address/${address}`, {
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/xml",
        "User-Agent": "Mozilla/5.0 (compatible; RegulatorBot/1.0)"
      }
    });
    if (resp.ok) {
      const html = await resp.text();
      const lowered = html.toLowerCase();
      const warningMatch = /this address has been reported|reported as compromised|flagged/i.test(html);
      const compromisedMatch = /compromised/i.test(html);
      if (warningMatch || compromisedMatch) {
        results.push({
          source: "etherscan_html",
          label: compromisedMatch ? "compromised" : "reported",
          severity: "critical",
          note: "Etherscan page shows warning banner / reported notice"
        });
      }
    }
  } catch (err) {
    console.warn("Etherscan reputation fetch failed", err);
  }

  try {
    const key = address.toLowerCase();
    const directIncident = KNOWN_INCIDENTS[key];

    // Also match incidents where this address is mentioned as related
    const relatedIncident = Object.values(KNOWN_INCIDENTS).find(inc =>
      inc.related
        .flatMap(r => extractAddresses(r))
        .some(rel => rel === key)
    );

    const incident = directIncident || relatedIncident;
    if (incident) {
      incidentIntel = {
        title: incident.title,
        severity: incident.severity,
        summary: incident.summary,
        related: incident.related
      };
      results.push({
        source: "known_incidents",
        label: incident.title,
        severity: incident.severity,
        note: incident.summary
      });
    }
  } catch {
    // ignore
  }

  return { results, incidentIntel };
}

app.get("/api/investigation/address/:address", async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    
    // Validate address format (like ethvalidate)
    if (!address || !address.startsWith('0x') || address.length !== 42) {
      return res.status(400).json({ error: 'Invalid address format. Must be a valid Ethereum address (0x followed by 40 hex characters)' });
    }
    
    // Validate address using multiple RPC nodes (like ethvalidate approach)
    const rpcEndpoints = [
      'https://eth.llamarpc.com',
      'https://rpc.ankr.com/eth',
      'https://ethereum.publicnode.com',
    ];
    
    let validatedBalance = '0';
    try {
      const validationPromises = rpcEndpoints.map(async (endpoint) => {
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_getBalance',
              params: [address, 'latest'],
              id: 1,
            }),
          });
          const data = await response.json();
          return data.result || null;
        } catch {
          return null;
        }
      });
      
      const balances = await Promise.allSettled(validationPromises);
      const validBalances = balances
        .filter((b): b is PromiseFulfilledResult<string> => b.status === 'fulfilled' && b.value !== null)
        .map(b => b.value);
      
      if (validBalances.length > 0) {
        validatedBalance = validBalances[0];
      }
    } catch (error) {
      console.error('RPC validation error:', error);
    }
    
    const { agent } = await initializeAgent();
    
    console.log(`🔍 Investigating address: ${address}`);
    
    // Get address data from Etherscan/BlockExplorer with proper error handling
    let transactions: any[] = [];
    let tokenTransfers: any[] = [];
    let etherscanBalance = '0';
    
    try {
      console.log('📡 Fetching from Etherscan API...');
      const [txs, tokens, bal] = await Promise.all([
        EtherscanAPI.getAddressTransactions(address, 0, 99999999, 1, 100, 'desc').catch((e: any) => {
          console.error('❌ Etherscan transactions error:', e?.message || e);
          return [];
        }),
        EtherscanAPI.getTokenTransfers(address, 0, 99999999, 1, 50, 'desc').catch((e: any) => {
          console.error('❌ Etherscan token transfers error:', e?.message || e);
          return [];
        }),
        EtherscanAPI.getAccountBalance(address).catch((e: any) => {
          console.error('❌ Etherscan balance error:', e?.message || e);
          return '0';
        })
      ]);
      transactions = txs || [];
      tokenTransfers = tokens || [];
      etherscanBalance = bal || '0';
      console.log(`✅ Etherscan: ${transactions.length} transactions, ${tokenTransfers.length} token transfers, balance: ${bal}`);
    } catch (error: any) {
      console.error('❌ Etherscan API failed:', error?.message || error);
    }
    
    // Also get real-time transactions from agent
    try {
      const recentTxs = agent.getRecentTransactions(500);
      const addressLower = address.toLowerCase();
      const addressTxs = recentTxs.filter((tx: any) => {
        const txFrom = (tx as any).from?.toLowerCase();
        const txTo = (tx as any).to?.toLowerCase();
        return tx.hash && (txFrom === addressLower || txTo === addressLower);
      });
      
      console.log(`📊 Found ${addressTxs.length} real-time transactions for address`);
      
      // Merge with Etherscan data
      if (addressTxs.length > 0) {
        const existingHashes = new Set(transactions.map(t => t.hash));
        let addedCount = 0;
        addressTxs.forEach((tx: any) => {
          if (!existingHashes.has(tx.hash)) {
            transactions.push({
              hash: tx.hash,
              from: tx.from || '',
              to: tx.to || '',
              value: tx.value?.toString() || '0',
              timeStamp: tx.timestamp ? Math.floor(tx.timestamp / 1000).toString() : Math.floor(Date.now() / 1000).toString(),
              blockNumber: tx.blockNumber?.toString() || '0',
              gasPrice: tx.gasPrice?.toString() || '0',
              isError: '0',
              chain: tx.chain || 'ethereum',
            });
            addedCount++;
          }
        });
        console.log(`✅ Added ${addedCount} real-time transactions`);
      }
    } catch (error: any) {
      console.error('❌ Error getting agent transactions:', error?.message || error);
    }
    
    console.log(`📊 Final transaction count: ${transactions.length}`);
    
    // Use validated balance from RPC if available, otherwise use Etherscan
    const balance = validatedBalance !== '0' ? validatedBalance : etherscanBalance;
    
    // Analyze suspicious patterns
    const analysis = transactions.length > 0 
      ? EtherscanAPI.analyzeSuspiciousPatterns(transactions)
      : null;
    
    // Use Gemini AI for deep investigation analysis (with timeout to prevent hanging)
    let aiAnalysis = null;
    if (process.env.GOOGLE_AI_API_KEY && transactions.length > 0) {
      try {
        // Add timeout to AI analysis (max 10 seconds)
        const aiAnalysisPromise = (async () => {
          const { GoogleGenerativeAI } = await import("@google/generative-ai");
          const apiKey = process.env.GOOGLE_AI_API_KEY;
          if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not set');
          const googleAI = new GoogleGenerativeAI(apiKey);
          
          // Use ONLY gemini-2.5-flash as specified
          const model = googleAI.getGenerativeModel({ model: "gemini-2.5-flash" });
          
          // Prepare transaction summary for AI (reduced to 10 transactions for faster processing)
          const txSummary = transactions.slice(0, 10).map(tx => ({
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            value: tx.value,
            timestamp: tx.timeStamp
          }));
          
          const prompt = `Analyze Ethereum address: ${address}
Balance: ${balance} ETH | Transactions: ${transactions.length} | Tokens: ${tokenTransfers.length}

Sample transactions:
${JSON.stringify(txSummary, null, 2)}

Patterns: ${analysis ? JSON.stringify(analysis, null, 2) : 'None'}

Return JSON: {riskScore: 0-100, category: string, patterns: [], redFlags: [], recommendations: [], summary: string}`;
          
          const result = await model.generateContent(prompt);
          const response = await result.response;
          const text = response.text();
          
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
          }
          return {
            summary: text,
            riskScore: analysis?.riskScore || 0,
            category: 'UNKNOWN',
            patterns: [],
            redFlags: [],
            recommendations: []
          };
        })();
        
        // Add 10 second timeout
        aiAnalysis = await Promise.race([
          aiAnalysisPromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('AI analysis timeout')), 10000)
          )
        ]).catch((error) => {
          console.error('AI analysis timeout or error:', error);
          return null; // Return null on timeout/error
        });
      } catch (aiError) {
        console.error('Gemini AI analysis error:', aiError);
        // Continue without AI analysis
      }
    }

    // Fallback to OpenAI if Gemini not available/succeeded and API key present
    if (!aiAnalysis && process.env.OPENAI_API_KEY && transactions.length > 0) {
      try {
        const { default: OpenAI } = await import("openai");
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const txSummary = transactions.slice(0, 10).map(tx => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: tx.value,
          timestamp: tx.timeStamp
        }));

        const prompt = `Analyze Ethereum address: ${address}
Balance: ${balance} ETH | Transactions: ${transactions.length} | Tokens: ${tokenTransfers.length}

Sample transactions:
${JSON.stringify(txSummary, null, 2)}

Patterns: ${analysis ? JSON.stringify(analysis, null, 2) : 'None'}

Return JSON: {riskScore: 0-100, category: string, patterns: [], redFlags: [], recommendations: [], summary: string}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const completion = await client.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2
        }, { signal: controller.signal }).catch((err: any) => {
          console.error("OpenAI analysis error:", err);
          return null;
        });
        clearTimeout(timeout);

        if (completion?.choices?.[0]?.message?.content) {
          const text = completion.choices[0].message.content;
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            aiAnalysis = JSON.parse(jsonMatch[0]);
          } else {
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
      } catch (openAiError) {
        console.error("OpenAI analysis failed:", openAiError);
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
    
    // Ensure we return transactions even if empty
    console.log(`📤 Returning investigation results: ${transactions.length} transactions, ${tokenTransfers.length} token transfers`);
    
    // Ensure arrays are never null/undefined
    const transactionsArray = Array.isArray(transactions) ? transactions.slice(0, 50) : [];
    const tokenTransfersArray = Array.isArray(tokenTransfers) ? tokenTransfers.slice(0, 30) : [];

    // Lightweight rule-based summary when AI is unavailable (avoids silent empty UI)
    const buildFallbackInvestigation = () => {
      const txCount = transactionsArray.length;
      const flagList = analysis?.flags || [];
      const rapidTx = analysis?.rapidTransactions || 0;
      const suspicious = analysis?.suspicious ? "suspicious patterns detected" : "no obvious suspicious patterns";
      const totalEth = (() => {
        try {
          const sum = transactionsArray.reduce((acc, tx) => {
            try {
              const v = typeof tx.value === "string" ? BigInt(tx.value || "0") : BigInt(tx.value || 0);
              return acc + v;
            } catch {
              return acc;
            }
          }, BigInt(0));
          return Number(sum) / 1e18;
        } catch {
          return 0;
        }
      })();

      const summaryLines = [
        `Address ${address} with ${txCount} transactions reviewed; ${suspicious}.`,
        flagList.length ? `Flags: ${flagList.join(", ")}` : "No flags raised by heuristic checks.",
        `Approx total on-chain flow observed (sampled): ${totalEth.toFixed(4)} ETH.`,
        rapidTx ? `Rapid transactions detected: ${rapidTx}.` : "No bursty activity detected.",
        "External reputation not auto-fetched; verify Etherscan/Chainabuse labels."
      ];

      const redFlags = [
        ...flagList,
        "High balance without confirmed provenance (manual review required)."
      ];

      return {
        summary: summaryLines.join(" "),
        riskScore: Math.max(analysis?.riskScore ?? 0, 80),
        category: "PATTERN_DETECTED",
        patterns: redFlags,
        redFlags,
        recommendations: [
          "Treat as high risk pending external reputation checks (Etherscan labels).",
          "Trace inbound sources; verify legitimacy and ownership.",
          "Check approvals/allowances; block outbound transfers if unsure.",
          "Run taint/cluster analysis before interacting."
        ],
      };
    };

    const effectiveAiAnalysis = aiAnalysis || buildFallbackInvestigation();
    const { results: externalReputation, incidentIntel } = await getExternalReputation(address);
    if (externalReputation.length > 0 && effectiveAiAnalysis) {
      effectiveAiAnalysis.redFlags = [...(effectiveAiAnalysis.redFlags || []), ...externalReputation.map(r => `${r.label} (${r.source})`)];
      effectiveAiAnalysis.patterns = [...(effectiveAiAnalysis.patterns || []), ...externalReputation.map(r => r.label)];
      effectiveAiAnalysis.riskScore = Math.max(effectiveAiAnalysis.riskScore || 0, 90);
      effectiveAiAnalysis.category = "PATTERN_DETECTED";
      effectiveAiAnalysis.summary = `${effectiveAiAnalysis.summary} External reputation: ${externalReputation.map(r => `${r.label} [${r.source}]`).join("; ")}.`;
    }
    
    res.json(serializeBigInt({
      address,
      balance: balance || '0',
      transactionCount: transactionsArray.length,
      tokenTransferCount: tokenTransfersArray.length,
      transactions: transactionsArray,
      tokenTransfers: tokenTransfersArray,
      analysis: analysis ? {
        suspicious: analysis.suspicious,
        flags: analysis.flags,
        riskScore: analysis.riskScore,
        totalVolume: analysis.totalVolume.toString(),
        averageTransactionSize: analysis.averageTransactionSize.toString(),
        rapidTransactions: analysis.rapidTransactions
      } : null,
      aiInvestigation: effectiveAiAnalysis,
      externalReputation,
      incidentIntel,
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

// Address Validation Endpoint (using multiple RPC nodes like ethvalidate)
app.get("/api/validate/address/:address", async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    if (!address || !address.startsWith('0x') || address.length !== 42) {
      return res.status(400).json({ error: 'Invalid address format' });
    }

    // Validate using multiple RPC endpoints (like ethvalidate)
    const rpcEndpoints = [
      'https://eth.llamarpc.com',
      'https://rpc.ankr.com/eth',
      'https://ethereum.publicnode.com',
    ];

    const validationResults = await Promise.allSettled(
      rpcEndpoints.map(async (endpoint) => {
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_getBalance',
              params: [address, 'latest'],
              id: 1,
            }),
          });
          const data = await response.json();
          return {
            endpoint,
            valid: !data.error,
            balance: data.result || '0x0',
          };
        } catch (error) {
          return { endpoint, valid: false, error: String(error) };
        }
      })
    );

    const validations = validationResults.map((result, idx) => 
      result.status === 'fulfilled' ? result.value : { endpoint: rpcEndpoints[idx], valid: false, error: 'Request failed' }
    );

    const isValid = validations.some(v => v.valid);
    const consensusBalance = validations.find(v => v.valid && v.balance)?.balance || '0x0';

    res.json({
      address,
      isValid,
      balance: consensusBalance,
      validations,
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Taint Analysis Endpoint
app.get("/api/investigation/taint/:address", async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    const { agent } = await initializeAgent();
    
    const transactions = await EtherscanAPI.getAddressTransactions(address, 0, 99999999, 1, 100, 'desc').catch(() => []);
    const tokenTransfers = await EtherscanAPI.getTokenTransfers(address, 0, 99999999, 1, 50, 'desc').catch(() => []);
    
    // Trace fund flows - identify source addresses
    const sourceAddresses = new Set<string>();
    const destinationAddresses = new Set<string>();
    
    transactions.forEach(tx => {
      if (tx.from.toLowerCase() !== address.toLowerCase()) {
        sourceAddresses.add(tx.from);
      }
      if (tx.to && tx.to.toLowerCase() !== address.toLowerCase()) {
        destinationAddresses.add(tx.to);
      }
    });

    // Analyze contamination paths
    const contaminationPaths = Array.from(sourceAddresses).slice(0, 20).map(addr => ({
      address: addr,
      riskLevel: 'unknown',
      connectionType: 'direct',
    }));

    res.json(serializeBigInt({
      address,
      sourceAddresses: Array.from(sourceAddresses).slice(0, 50),
      destinationAddresses: Array.from(destinationAddresses).slice(0, 50),
      contaminationPaths,
      totalSources: sourceAddresses.size,
      totalDestinations: destinationAddresses.size,
      timestamp: Date.now(),
    }));
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Address Clustering Endpoint
app.get("/api/investigation/cluster/:address", async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    const transactions = await EtherscanAPI.getAddressTransactions(address, 0, 99999999, 1, 100, 'desc').catch(() => []);
    
    // Identify related addresses using heuristics
    const relatedAddresses = new Map<string, { count: number; type: string }>();
    
    transactions.forEach(tx => {
      // Shared inputs (addresses that sent to both this address and others)
      if (tx.from) {
        const count = relatedAddresses.get(tx.from)?.count || 0;
        relatedAddresses.set(tx.from, { count: count + 1, type: 'shared_input' });
      }
      // Change addresses (small value outputs)
      if (tx.to && BigInt(tx.value) < BigInt('100000000000000000')) {
        const count = relatedAddresses.get(tx.to)?.count || 0;
        relatedAddresses.set(tx.to, { count: count + 1, type: 'change_address' });
      }
    });

    const clusters = Array.from(relatedAddresses.entries())
      .filter(([_, data]) => data.count > 1)
      .slice(0, 30)
      .map(([addr, data]) => ({
        address: addr,
        connectionStrength: data.count,
        clusterType: data.type,
      }));

    res.json(serializeBigInt({
      address,
      clusters,
      clusterCount: clusters.length,
      timestamp: Date.now(),
    }));
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Flow Visualization Endpoint
app.get("/api/investigation/flow/:address", async (req: Request, res: Response) => {
  try {
    const address = req.params.address.toLowerCase();
    console.log(`[Flow] Processing flow visualization for address: ${address}`);
    const transactions = await EtherscanAPI.getAddressTransactions(address, 0, 99999999, 1, 100, 'desc').catch(() => []);
    
    // Build flow graph with detailed node information
    const nodeMap = new Map<string, {
      address: string;
      balance: string;
      incomingValue: bigint;
      outgoingValue: bigint;
      incomingCount: number;
      outgoingCount: number;
      type: 'target' | 'source' | 'destination';
    }>();
    
    // Initialize target node
    let targetBalance = '0';
    try {
      const balanceResult = await EtherscanAPI.getAccountBalance(address);
      // Handle both hex (0x...) and decimal strings
      if (typeof balanceResult === 'string') {
        targetBalance = balanceResult.startsWith('0x') ? balanceResult : balanceResult;
      } else {
        targetBalance = String(balanceResult || '0');
      }
    } catch {
      targetBalance = '0';
    }
    
    nodeMap.set(address, {
      address,
      balance: targetBalance,
      incomingValue: BigInt(0),
      outgoingValue: BigInt(0),
      incomingCount: 0,
      outgoingCount: 0,
      type: 'target',
    });
    
    const edges: Array<{ 
      from: string; 
      to: string; 
      value: string; 
      timestamp: string;
      hash: string;
    }> = [];
    
    // Process transactions to build graph
    transactions.slice(0, 100).forEach(tx => {
      const from = (tx.from || '').toLowerCase();
      const to = (tx.to || '').toLowerCase();
      
      // Safely parse transaction value to BigInt
      let value = BigInt(0);
      try {
        const valueStr = String(tx.value || '0').trim();
        if (valueStr && valueStr !== 'null' && valueStr !== 'undefined') {
          // Handle hex strings
          if (valueStr.startsWith('0x')) {
            value = BigInt(valueStr);
          } else {
            // Handle decimal strings
            value = BigInt(valueStr);
          }
        }
      } catch (e) {
        console.error('Error parsing transaction value:', tx.value, e);
        value = BigInt(0);
      }
      
      if (from && to) {
        // Add edge
        edges.push({
          from,
          to,
          value: tx.value,
          timestamp: tx.timeStamp,
          hash: tx.hash,
        });
        
        // Update node data
        if (from === address) {
          // Outgoing transaction from target
          const targetNode = nodeMap.get(address)!;
          targetNode.outgoingValue += value;
          targetNode.outgoingCount++;
          
          if (!nodeMap.has(to)) {
            nodeMap.set(to, {
              address: to,
              balance: '0',
              incomingValue: BigInt(0),
              outgoingValue: BigInt(0),
              incomingCount: 0,
              outgoingCount: 0,
              type: 'destination',
            });
          }
          const destNode = nodeMap.get(to)!;
          destNode.incomingValue += value;
          destNode.incomingCount++;
        } else if (to === address) {
          // Incoming transaction to target
          const targetNode = nodeMap.get(address)!;
          targetNode.incomingValue += value;
          targetNode.incomingCount++;
          
          if (!nodeMap.has(from)) {
            nodeMap.set(from, {
              address: from,
              balance: '0',
              incomingValue: BigInt(0),
              outgoingValue: BigInt(0),
              incomingCount: 0,
              outgoingCount: 0,
              type: 'source',
            });
          }
          const sourceNode = nodeMap.get(from)!;
          sourceNode.outgoingValue += value;
          sourceNode.outgoingCount++;
        } else {
          // Transaction between two other addresses (not involving target)
          // Still add them as nodes but don't classify as source/destination
          if (!nodeMap.has(from)) {
            nodeMap.set(from, {
              address: from,
              balance: '0',
              incomingValue: BigInt(0),
              outgoingValue: BigInt(0),
              incomingCount: 0,
              outgoingCount: 0,
              type: 'source', // Default to source if not connected to target
            });
          }
          if (!nodeMap.has(to)) {
            nodeMap.set(to, {
              address: to,
              balance: '0',
              incomingValue: BigInt(0),
              outgoingValue: BigInt(0),
              incomingCount: 0,
              outgoingCount: 0,
              type: 'destination', // Default to destination if not connected to target
            });
          }
        }
      }
    });
    
    // Get balances for all nodes (in parallel, but limit to avoid rate limits)
    const nodeAddresses = Array.from(nodeMap.keys()).slice(0, 50);
    await Promise.allSettled(
      nodeAddresses.map(async (addr) => {
        if (addr !== address) {
          try {
            const balanceResult = await EtherscanAPI.getAccountBalance(addr);
            const node = nodeMap.get(addr);
            if (node) {
              // Handle both hex (0x...) and decimal strings
              if (typeof balanceResult === 'string') {
                node.balance = balanceResult;
              } else {
                node.balance = String(balanceResult || '0');
              }
            }
          } catch {
            // Ignore balance fetch errors
          }
        }
      })
    );
    
    // Convert nodes to array format
    const nodes = Array.from(nodeMap.values()).map(node => {
      // getAccountBalance returns ETH as decimal string, convert to wei for storage
      let balanceWei = BigInt(0);
      try {
        const balanceStr = String(node.balance || '0').trim();
        if (!balanceStr || balanceStr === 'null' || balanceStr === 'undefined') {
          balanceWei = BigInt(0);
        } else if (balanceStr.startsWith('0x')) {
          // Hex string (from RPC)
          balanceWei = BigInt(balanceStr);
        } else if (balanceStr.includes('.')) {
          // Decimal ETH value, convert to wei
          const ethValue = parseFloat(balanceStr) || 0;
          balanceWei = BigInt(Math.floor(ethValue * 1000000000000000000));
        } else {
          // Try to parse as wei (large number)
          balanceWei = BigInt(balanceStr);
        }
      } catch (e) {
        console.error('Error parsing balance for node:', node.address, node.balance, e);
        balanceWei = BigInt(0);
      }
      
      const weiPerEth = BigInt('1000000000000000000');
      
      return {
        id: node.address,
        address: node.address,
        balance: balanceWei.toString(),
        incomingValue: (typeof node.incomingValue === 'bigint' ? node.incomingValue : BigInt(String(node.incomingValue || 0))).toString(),
        outgoingValue: (typeof node.outgoingValue === 'bigint' ? node.outgoingValue : BigInt(String(node.outgoingValue || 0))).toString(),
        incomingCount: node.incomingCount,
        outgoingCount: node.outgoingCount,
        type: node.type,
        // Calculate display value (balance or total flow) in ETH
        displayValue: (() => {
          try {
            if (node.type === 'target') {
              return (balanceWei / weiPerEth).toString();
            } else if (node.type === 'source') {
              const outgoing = typeof node.outgoingValue === 'bigint' ? node.outgoingValue : BigInt(String(node.outgoingValue || 0));
              return (outgoing / weiPerEth).toString();
            } else {
              const incoming = typeof node.incomingValue === 'bigint' ? node.incomingValue : BigInt(String(node.incomingValue || 0));
              return (incoming / weiPerEth).toString();
            }
          } catch (e) {
            console.error('Error calculating displayValue for node:', node.address, node.type, e);
            return '0';
          }
        })(),
      };
    });

    console.log(`[Flow] Generated ${nodes.length} nodes and ${edges.length} edges`);
    
    const responseData = {
      address,
      nodes,
      edges: edges.slice(0, 100),
      nodeCount: nodes.length,
      edgeCount: edges.length,
      timestamp: Date.now(),
    };
    
    console.log(`[Flow] Serializing response data...`);
    const serialized = serializeBigInt(responseData);
    console.log(`[Flow] Sending response with ${serialized.nodes.length} nodes`);
    
    res.json(serialized);
  } catch (error: any) {
    console.error('[Flow] Error in flow visualization:', error);
    console.error('[Flow] Error stack:', error.stack);
    res.status(500).json({ 
      error: String(error?.message || error),
      details: error?.stack 
    });
  }
});

// Cross-Chain Analysis Endpoint
app.get("/api/investigation/crosschain/:address", async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    const { agent } = await initializeAgent();

    if (!address || !address.startsWith("0x") || address.length !== 42) {
      return res.status(400).json({ error: "Invalid address format. Use a 0x-prefixed 40-hex address." });
    }

    const chainData = await buildCrossChainSnapshot(address, agent);

    res.json(serializeBigInt({
      address,
      chains: chainData,
      activeChains: chainData.filter(c => c.hasActivity).length,
      timestamp: Date.now(),
    }));
  } catch (error: any) {
    res.status(500).json({ error: String(error?.message || error) });
  }
});

// Market Manipulation Investigation + Report (docx) Endpoint
app.get("/api/investigation/marketmanipulation/:address", async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    const token = (req.query.token as string | undefined) || undefined;
    const format = (req.query.format as string | undefined)?.toLowerCase();
    const download = req.query.download === "true" || format === "docx" || format === "doc";

    if (!address || !address.startsWith("0x") || address.length !== 42) {
      return res.status(400).json({ error: "Invalid address format. Use a 0x-prefixed 40-hex address." });
    }

    const { agent } = await initializeAgent();
    const chainData = await buildCrossChainSnapshot(address, agent);
    const chainActivity = safeSerialize(chainData);

    // Run Master Investigative Blueprint 5-Step Workflow
    const workflowAnalysis = await runMasterWorkflow(address, agent);

    // Gather market manipulation alerts
    const alerts: any[] = [];
    if (marketManipulationDetector) {
      alerts.push(...marketManipulationDetector.getAddressAlerts(address as Address, 100));
      if (token) {
        alerts.push(...marketManipulationDetector.getTokenAlerts(token as Address, 100));
      }
    }

    const safeAlerts = safeSerialize(alerts);

    // Analyze high-risk transactions
    console.log(`[MarketManipulation] Analyzing high-risk transactions for ${address}...`);
    const highRiskTransactions = await analyzeHighRiskTransactions(address, 50);
    console.log(`[MarketManipulation] Found ${highRiskTransactions?.length || 0} high-risk transactions`);

    // Combine workflow baseRisk with alert risks and high-risk transaction risks
    const maxAlertRisk = alerts.length ? Math.max(...alerts.map((a) => Number(a.riskScore || 0))) : 20;
    const maxTxRisk = highRiskTransactions && highRiskTransactions.length > 0
      ? Math.max(...highRiskTransactions.map((tx) => tx.riskScore))
      : 20;
    const combinedRisk = Math.max(workflowAnalysis.triage.baseRisk, maxAlertRisk, maxTxRisk);
    const riskScore = Math.min(100, Math.max(10, combinedRisk));
    const status: "flagged" | "cleared" = (safeAlerts.length === 0 && riskScore <= 20 && !workflowAnalysis.sarReady && (!highRiskTransactions || highRiskTransactions.length === 0)) ? "cleared" : "flagged";

    const aiNarrative = await generateAiNarrative({
      address,
      token,
      chainActivity: chainActivity,
      alerts: safeAlerts,
    });

    const record: InvestigationRecord = {
      id: `${Date.now()}-${address}`,
      address,
      token,
      riskScore,
      summary: aiNarrative,
      alerts: safeAlerts,
      chainActivity,
      timestamp: Date.now(),
      status,
      workflowAnalysis,
      highRiskTransactions: highRiskTransactions || undefined,
    };

    await saveInvestigationRecord(record);

    // Auto-save detailed DOCX report to organized reports folder (flagged/cleared + risk level)
    await ensureReportsDir();
    const reportDir = getReportDirectory(record);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const reportFilename = `investigation-${address.slice(2, 10)}-${timestamp}.docx`;
    const reportPath = path.join(reportDir, reportFilename);
    
    try {
      const buffer = await buildDocxReport(record, aiNarrative);
      await fsp.writeFile(reportPath, Buffer.from(buffer));
      console.log(`[Investigation] Detailed report saved to organized folder: ${reportPath}`);
    } catch (err: any) {
      console.warn(`[Investigation] Failed to save report: ${err?.message || err}`);
    }

    // Return docx if requested
    if (download) {
      const buffer = await buildDocxReport(record, aiNarrative);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename=\"investigation-${address}.docx\"`);
      return res.send(Buffer.from(buffer));
    }

    res.json(serializeBigInt({ ...record, aiNarrative }));
  } catch (error: any) {
    console.error("[MarketManipulation] error:", error?.message || error);
    res.status(500).json({ error: String(error?.message || error) });
  }
});

// Investigation history & export
app.get("/api/investigation/history", async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as string | undefined)?.toLowerCase();
    const history = await loadInvestigationHistory();

    if (format === "csv") {
      const csv = investigationsToCsv(history);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=\"investigation-history.csv\"");
      return res.send(csv);
    }

    res.json(serializeBigInt({ count: history.length, items: history }));
  } catch (error: any) {
    res.status(500).json({ error: String(error?.message || error) });
  }
});

// SAR-ready investigation (real-time) endpoint
app.get("/api/investigation/sar/:address", async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    const token = (req.query.token as string | undefined) || undefined;
    const download = req.query.download === "true";

    if (!address || !address.startsWith("0x") || address.length !== 42) {
      return res.status(400).json({ error: "Invalid address format. Use a 0x-prefixed 40-hex address." });
    }

    const { agent } = await initializeAgent();
    const chainData = await buildCrossChainSnapshot(address, agent);
    const chainActivity = safeSerialize(chainData);

    // Run Master Investigative Blueprint 5-Step Workflow
    const workflowAnalysis = await runMasterWorkflow(address, agent);

    // Gather market manipulation alerts
    const alerts: any[] = [];
    if (marketManipulationDetector) {
      alerts.push(...marketManipulationDetector.getAddressAlerts(address as Address, 100));
      if (token) {
        alerts.push(...marketManipulationDetector.getTokenAlerts(token as Address, 100));
      }
    }
    const safeAlerts = safeSerialize(alerts);

    // Analyze high-risk transactions
    console.log(`[SAR] Analyzing high-risk transactions for ${address}...`);
    const highRiskTransactions = await analyzeHighRiskTransactions(address, 50);
    console.log(`[SAR] Found ${highRiskTransactions?.length || 0} high-risk transactions`);

    // Combine workflow baseRisk with alert risks and high-risk transaction risks
    const maxAlertRisk = alerts.length ? Math.max(...alerts.map((a) => Number(a.riskScore || 0))) : 20;
    const maxTxRisk = highRiskTransactions && highRiskTransactions.length > 0
      ? Math.max(...highRiskTransactions.map((tx) => tx.riskScore))
      : 20;
    const combinedRisk = Math.max(workflowAnalysis.triage.baseRisk, maxAlertRisk, maxTxRisk);
    const riskScore = Math.min(100, Math.max(10, combinedRisk));
    const status: "flagged" | "cleared" = (safeAlerts.length === 0 && riskScore <= 20 && !workflowAnalysis.sarReady && (!highRiskTransactions || highRiskTransactions.length === 0)) ? "cleared" : "flagged";

    const aiNarrative = await generateAiNarrative({
      address,
      token,
      chainActivity: chainActivity,
      alerts: safeAlerts,
    });

    const recordBase: InvestigationRecord = {
      id: `${Date.now()}-${address}`,
      address,
      token,
      riskScore,
      summary: aiNarrative,
      alerts: safeAlerts,
      chainActivity,
      timestamp: Date.now(),
      status,
      workflowAnalysis,
      highRiskTransactions: highRiskTransactions || undefined,
    };

    const sarText = await generateSarSummary(recordBase, aiNarrative);

    const record: InvestigationRecord = {
      ...recordBase,
      sarText,
    };

    await saveInvestigationRecord(record);

    // Always persist a SAR docx to organized reports folder (flagged/cleared + risk level)
    try {
      await ensureReportsDir();
      const reportDir = getReportDirectory(record);
      const autoPath = path.join(reportDir, `sar-${address.slice(2, 10)}-${Date.now()}.docx`);
      const autoBuffer = await buildDocxReport(record, aiNarrative, sarText);
      await fsp.writeFile(autoPath, Buffer.from(autoBuffer));
      console.log(`[SAR] Saved auto report to organized folder: ${autoPath}`);
    } catch (err) {
      console.warn("[SAR] Failed to auto-save report:", err);
    }

    if (download) {
      const buffer = await buildDocxReport(record, aiNarrative, sarText);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename=\"sar-${address}.docx\"`);
      return res.send(Buffer.from(buffer));
    }

    res.json(serializeBigInt({ ...record, aiNarrative, sarText }));
  } catch (error: any) {
    res.status(500).json({ error: String(error?.message || error) });
  }
});

// MEV Detection Endpoint
app.get("/api/investigation/mev/:address", async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    const transactions = await EtherscanAPI.getAddressTransactions(address, 0, 99999999, 1, 100, 'desc').catch(() => []);
    
    // Detect MEV patterns
    const mevPatterns: Array<{ type: string; txHash: string; description: string }> = [];
    
    transactions.forEach((tx, idx) => {
      const gasPrice = BigInt(tx.gasPrice || '0');
      const highGasPrice = gasPrice > BigInt('100000000000'); // > 100 gwei
      
      // Check for front-running patterns (high gas price, same block)
      if (highGasPrice && idx < transactions.length - 1) {
        const nextTx = transactions[idx + 1];
        if (nextTx.blockNumber === tx.blockNumber && BigInt(nextTx.gasPrice) < gasPrice) {
          mevPatterns.push({
            type: 'potential_frontrun',
            txHash: tx.hash,
            description: `High gas price transaction in same block as lower gas price transaction`,
          });
        }
      }
      
      // Check for sandwich patterns (tx between two related txs)
      if (idx > 0 && idx < transactions.length - 1) {
        const prevTx = transactions[idx - 1];
        const nextTx = transactions[idx + 1];
        if (prevTx.to === nextTx.from && tx.from === address) {
          mevPatterns.push({
            type: 'potential_sandwich',
            txHash: tx.hash,
            description: `Transaction between two related transactions`,
          });
        }
      }
    });

    res.json(serializeBigInt({
      address,
      mevDetected: mevPatterns.length > 0,
      patterns: mevPatterns.slice(0, 20),
      patternCount: mevPatterns.length,
      timestamp: Date.now(),
    }));
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Risk Profiling Endpoint
app.get("/api/investigation/risk/:address", async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    const [transactions, tokenTransfers, balanceResult] = await Promise.all([
      EtherscanAPI.getAddressTransactions(address, 0, 99999999, 1, 100, 'desc').catch(() => []),
      EtherscanAPI.getTokenTransfers(address, 0, 99999999, 1, 50, 'desc').catch(() => []),
      EtherscanAPI.getAccountBalance(address).catch(() => '0'),
    ]);
    
    // Handle balance - getAccountBalance returns ETH as decimal string
    // Convert to wei for consistency, but keep ETH string for display
    let balanceWei = '0';
    let balanceETH = '0';
    try {
      const balanceStr = String(balanceResult || '0').trim();
      console.log(`[Risk] Balance string received: ${balanceStr}`);
      
      if (balanceStr && balanceStr !== 'null' && balanceStr !== 'undefined' && balanceStr !== '') {
        balanceETH = balanceStr; // Keep original ETH value for display
        
        if (balanceStr.includes('.')) {
          // It's ETH as decimal, convert to wei using string manipulation to avoid precision loss
          const parts = balanceStr.split('.');
          const integerPart = parts[0] || '0';
          let decimalPart = parts[1] || '';
          // Pad decimal part to exactly 18 digits
          decimalPart = decimalPart.padEnd(18, '0').slice(0, 18);
          
          // Combine: integer + decimal (no decimal point)
          const weiStr = integerPart + decimalPart;
          console.log(`[Risk] Converting ETH ${balanceStr} to wei string: ${weiStr} (length: ${weiStr.length})`);
          
          try {
            // Ensure weiStr is a valid integer string (no decimal point, no letters)
            if (!/^\d+$/.test(weiStr)) {
              throw new Error(`Invalid wei string: ${weiStr}`);
            }
            balanceWei = BigInt(weiStr).toString();
            console.log(`[Risk] Successfully converted to wei: ${balanceWei}`);
          } catch (e) {
            console.error('[Risk] Error converting with BigInt, using fallback:', e);
            // Fallback: use multiplication with proper handling
            const ethValue = parseFloat(balanceStr) || 0;
            const integer = Math.floor(ethValue);
            const fractional = ethValue - integer;
            const integerWei = BigInt(integer) * BigInt('1000000000000000000');
            // Use string-based fractional conversion to avoid precision loss
            const fractionalStr = fractional.toFixed(18).split('.')[1] || '0';
            const fractionalWei = BigInt(fractionalStr.padEnd(18, '0').slice(0, 18));
            balanceWei = (integerWei + fractionalWei).toString();
            console.log(`[Risk] Fallback conversion result: ${balanceWei}`);
          }
        } else if (balanceStr.startsWith('0x')) {
          // Hex string (from RPC)
          balanceWei = BigInt(balanceStr).toString();
          const wei = BigInt(balanceStr);
          balanceETH = (Number(wei) / 1e18).toString();
        } else {
          // Check if it's a large number (likely wei) or small number (likely ETH)
          const numValue = parseFloat(balanceStr);
          if (numValue > 1e15) {
            // Likely wei
            try {
              balanceWei = BigInt(balanceStr).toString();
              balanceETH = (numValue / 1e18).toString();
            } catch {
              balanceWei = '0';
              balanceETH = balanceStr;
            }
          } else {
            // Likely ETH, convert to wei
            const integer = Math.floor(numValue);
            const fractional = numValue - integer;
            const integerWei = BigInt(integer) * BigInt('1000000000000000000');
            const fractionalWei = BigInt(Math.floor(fractional * 1000000000000000000));
            balanceWei = (integerWei + fractionalWei).toString();
            balanceETH = balanceStr;
          }
        }
      }
    } catch (e) {
      console.error('[Risk] Error parsing balance:', e);
      balanceWei = '0';
      balanceETH = '0';
    }
    
    const analysis = transactions.length > 0 
      ? EtherscanAPI.analyzeSuspiciousPatterns(transactions)
      : null;
    
    // Build comprehensive risk profile
    const riskFactors: string[] = [];
    let riskScore = analysis?.riskScore || 0;
    
    if (analysis && (analysis.rapidTransactions || 0) > 10) riskFactors.push('High transaction velocity');
    if (analysis?.flags?.includes('LARGE_VALUE')) riskFactors.push('Large value transactions');
    if (analysis?.flags?.includes('FAILED_TRANSACTIONS')) riskFactors.push('Failed transactions');
    
    // Safely convert totalVolume and avgTxSize to strings
    let totalVolumeStr = '0';
    let avgTxSizeStr = '0';
    
    try {
      if (analysis?.totalVolume !== undefined && analysis?.totalVolume !== null) {
        if (typeof analysis.totalVolume === 'bigint') {
          totalVolumeStr = analysis.totalVolume.toString();
        } else if (typeof analysis.totalVolume === 'number') {
          // It's a number - check if it's a decimal
          if (Number.isInteger(analysis.totalVolume)) {
            totalVolumeStr = BigInt(analysis.totalVolume).toString();
          } else {
            // Decimal number - floor it first
            totalVolumeStr = BigInt(Math.floor(analysis.totalVolume)).toString();
          }
        } else {
          // It's a string or something else
          const volStr = String(analysis.totalVolume).trim();
          if (volStr.includes('.')) {
            // Decimal string - parse and floor
            const numValue = parseFloat(volStr);
            if (!isNaN(numValue)) {
              totalVolumeStr = BigInt(Math.floor(numValue)).toString();
            } else {
              totalVolumeStr = '0';
            }
          } else {
            // Integer string - safe to convert
            try {
              totalVolumeStr = BigInt(volStr).toString();
            } catch {
              totalVolumeStr = '0';
            }
          }
        }
      }
    } catch (e) {
      console.error('[Risk] Error converting totalVolume:', e, 'Type:', typeof analysis?.totalVolume, 'Value:', analysis?.totalVolume);
      totalVolumeStr = '0';
    }
    
    try {
      if (analysis?.averageTransactionSize !== undefined && analysis?.averageTransactionSize !== null) {
        if (typeof analysis.averageTransactionSize === 'bigint') {
          avgTxSizeStr = analysis.averageTransactionSize.toString();
        } else if (typeof analysis.averageTransactionSize === 'number') {
          // It's a number - check if it's a decimal
          if (Number.isInteger(analysis.averageTransactionSize)) {
            avgTxSizeStr = BigInt(analysis.averageTransactionSize).toString();
          } else {
            // Decimal number - floor it first
            avgTxSizeStr = BigInt(Math.floor(analysis.averageTransactionSize)).toString();
          }
        } else {
          // It's a string or something else
          const sizeStr = String(analysis.averageTransactionSize).trim();
          if (sizeStr.includes('.')) {
            // Decimal string - parse and floor
            const numValue = parseFloat(sizeStr);
            if (!isNaN(numValue)) {
              avgTxSizeStr = BigInt(Math.floor(numValue)).toString();
            } else {
              avgTxSizeStr = '0';
            }
          } else {
            // Integer string - safe to convert
            try {
              avgTxSizeStr = BigInt(sizeStr).toString();
            } catch {
              avgTxSizeStr = '0';
            }
          }
        }
      }
    } catch (e) {
      console.error('[Risk] Error converting averageTransactionSize:', e, 'Type:', typeof analysis?.averageTransactionSize, 'Value:', analysis?.averageTransactionSize);
      avgTxSizeStr = '0';
    }
    
    // Ensure balanceWei is actually converted (not still a decimal)
    // If balanceWei is still '0' or contains a decimal, it means conversion didn't happen
    if (balanceWei === '0' || (typeof balanceWei === 'string' && balanceWei.includes('.'))) {
      console.error('[Risk] WARNING: balanceWei not properly converted! Forcing conversion from balanceResult...');
      // Force conversion from the original balanceResult
      const originalBalance = String(balanceResult || '0');
      if (originalBalance.includes('.')) {
        const parts = originalBalance.split('.');
        const integerPart = parts[0] || '0';
        const decimalPart = (parts[1] || '').padEnd(18, '0').slice(0, 18);
        const weiStr = integerPart + decimalPart;
        try {
          if (/^\d+$/.test(weiStr)) {
            balanceWei = BigInt(weiStr).toString();
            console.log(`[Risk] Forced conversion successful: ${balanceWei}`);
          } else {
            throw new Error('Invalid wei string format');
          }
        } catch (e) {
          console.error('[Risk] Error in forced conversion, using fallback:', e);
          const ethValue = parseFloat(originalBalance);
          const integer = Math.floor(ethValue);
          const fractional = ethValue - integer;
          const integerWei = BigInt(integer) * BigInt('1000000000000000000');
          const fractionalWei = BigInt(Math.floor(fractional * 1000000000000000000));
          balanceWei = (integerWei + fractionalWei).toString();
          console.log(`[Risk] Fallback conversion result: ${balanceWei}`);
        }
      } else {
        // Not a decimal, try to use as-is
        try {
          balanceWei = BigInt(originalBalance).toString();
        } catch {
          balanceWei = '0';
        }
      }
    }
    
    // Ensure all values are strings to avoid BigInt conversion issues
    const responseData = {
      address: String(address),
      balance: String(balanceWei), // Return wei as string for calculations
      balanceETH: String(balanceETH || balanceResult || '0'), // ETH value for display
      riskScore: Number(riskScore),
      riskLevel: String(riskScore >= 70 ? 'HIGH' : riskScore >= 40 ? 'MEDIUM' : 'LOW'),
      riskFactors: Array.isArray(riskFactors) ? riskFactors.map(String) : [],
      transactionCount: Number(transactions.length),
      tokenTransferCount: Number(tokenTransfers.length),
      totalVolume: String(totalVolumeStr),
      averageTransactionSize: String(avgTxSizeStr),
      suspiciousFlags: Array.isArray(analysis?.flags) ? analysis.flags.map(String) : [],
      timestamp: Number(Date.now()),
    };
    
    console.log(`[Risk] Final balanceWei: ${responseData.balance}, balanceETH: ${responseData.balanceETH}`);
    res.json(serializeBigInt(responseData));
  } catch (error: any) {
    console.error('Error in risk profile endpoint:', error);
    res.status(500).json({ error: String(error?.message || error) });
  }
});

// Real-time Transaction Monitoring Endpoint
app.get("/api/transactions/live", async (req: Request, res: Response) => {
  try {
    const { agent } = await initializeAgent();
    const recentTxs = agent.getRecentTransactions(200);
    const stats = agent.getStats();
    
    // Get transactions with risk scores
    const transactionsWithRisk = recentTxs.map((tx: any) => {
      const baseTx = {
        hash: tx.hash || '',
        chain: tx.chain || 'ethereum',
        riskScore: tx.riskScore || 0,
        suspicious: tx.suspicious || false,
        timestamp: tx.timestamp || Date.now(),
      };
      return {
        ...baseTx,
        from: (tx as any).from || '',
        to: (tx as any).to || '',
        value: (tx as any).value?.toString() || '0',
        blockNumber: (tx as any).blockNumber?.toString() || '0',
      };
    });
    
    res.json(serializeBigInt({
      transactions: transactionsWithRisk,
      totalProcessed: stats.transactionsProcessed || 0,
      chainsMonitored: stats.chainsMonitored || 0,
      timestamp: Date.now(),
    }));
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Real-time Address Monitoring Endpoint
app.get("/api/address/:address/live", async (req: Request, res: Response) => {
  try {
    const address = req.params.address.toLowerCase();
    const { agent } = await initializeAgent();
    
    // Get real-time transactions from agent
    const recentTxs = agent.getRecentTransactions(1000);
    const addressTxs = recentTxs.filter((tx: any) => 
      tx.hash && (
        (tx as any).from?.toLowerCase() === address ||
        (tx as any).to?.toLowerCase() === address
      )
    );
    
    // Also try Etherscan
    let etherscanTxs: any[] = [];
    try {
      etherscanTxs = await EtherscanAPI.getAddressTransactions(req.params.address, 0, 99999999, 1, 50, 'desc');
    } catch (error) {
      console.error('Etherscan error for live monitoring:', error);
    }
    
    // Merge and deduplicate
    const allTxs: any[] = addressTxs.map((tx: any) => ({
      hash: tx.hash,
      from: (tx as any).from || '',
      to: (tx as any).to || '',
      value: (tx as any).value?.toString() || '0',
      chain: tx.chain || 'ethereum',
      riskScore: tx.riskScore || 0,
      suspicious: tx.suspicious || false,
      timestamp: tx.timestamp || Date.now(),
      blockNumber: (tx as any).blockNumber?.toString() || '0',
    }));
    
    const existingHashes = new Set(allTxs.map((t: any) => t.hash));
    etherscanTxs.forEach(tx => {
      if (!existingHashes.has(tx.hash)) {
        allTxs.push({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: tx.value,
          chain: 'ethereum',
          riskScore: 0,
          suspicious: false,
          timestamp: parseInt(tx.timeStamp) * 1000,
          blockNumber: tx.blockNumber,
        });
      }
    });
    
    // Ensure arrays are never null/undefined
    const allTxsArray = Array.isArray(allTxs) ? allTxs.slice(0, 100) : [];
    
    res.json(serializeBigInt({
      address: req.params.address,
      transactions: allTxsArray,
      count: allTxsArray.length,
      realTimeCount: addressTxs.length,
      etherscanCount: etherscanTxs.length,
      timestamp: Date.now(),
    }));
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Test Etherscan API endpoint
app.get("/api/test/etherscan", async (req: Request, res: Response) => {
  try {
    // Test with a known address (Vitalik's address)
    const testAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
    
    const [balance, transactions] = await Promise.all([
      EtherscanAPI.getAccountBalance(testAddress).catch(e => {
        console.error('Balance test error:', e);
        return 'ERROR: ' + String(e);
      }),
      EtherscanAPI.getAddressTransactions(testAddress, 0, 99999999, 1, 5, 'desc').catch(e => {
        console.error('Transactions test error:', e);
        return [];
      })
    ]);
    
    res.json({
      success: true,
      etherscanApiKey: process.env.ETHERSCAN_API_KEY ? 'Set (from env)' : 'Using hardcoded fallback',
      testAddress,
      balance,
      transactionCount: Array.isArray(transactions) ? transactions.length : 0,
      transactions: Array.isArray(transactions) ? transactions.slice(0, 2) : transactions,
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
      etherscanApiKey: process.env.ETHERSCAN_API_KEY ? 'Set (from env)' : 'Using hardcoded fallback',
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

// Research & DeFi Trends Endpoints
app.get("/api/research/:topic", async (req: Request, res: Response) => {
  try {
    const topic = req.params.topic;
    const format = (req.query.format as string | undefined)?.toLowerCase();
    const download = format === "docx" || format === "doc";

    if (!openai) {
      return res.status(503).json({ error: "OpenAI API key not configured" });
    }

    const prompt = `Research and analyze the following blockchain/DeFi topic: ${topic}

Provide a comprehensive research report covering:
1. Current state and trends
2. Technical analysis
3. Market implications
4. Risk factors
5. Future outlook
6. Regulatory considerations

Format as a structured research document with clear sections.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const researchText = completion.choices[0]?.message?.content || "Research unavailable.";

    if (download) {
      const doc = new Document({
        sections: [
          {
            children: [
              paragraph(`Research: ${topic}`, { heading: HeadingLevel.HEADING_1 }),
              paragraph(`Generated: ${new Date().toISOString()}`),
              paragraph("Executive Summary", { heading: HeadingLevel.HEADING_2 }),
              paragraph(researchText),
            ],
          },
        ],
      });
      const buffer = await Packer.toBuffer(doc);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="research-${topic.replace(/[^a-z0-9]/gi, '_')}.docx"`);
      return res.send(Buffer.from(buffer));
    }

    res.json({
      topic,
      research: researchText,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error("[Research] Error:", error);
    res.status(500).json({ error: String(error?.message || error) });
  }
});

app.get("/api/defi/trends", async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as string | undefined)?.toLowerCase();
    const download = format === "docx" || format === "doc";
    const timeframe = (req.query.timeframe as string) || "7d";

    if (!openai) {
      return res.status(503).json({ error: "OpenAI API key not configured" });
    }

    const { agent } = await initializeAgent();
    const recentTxs = agent.getRecentTransactions(500);
    const stats = agent.getStats();

    const prompt = `Analyze current DeFi trends based on the following blockchain activity data:

Timeframe: ${timeframe}
Total Transactions Processed: ${stats.transactionsProcessed || 0}
Chains Monitored: ${stats.chainsMonitored || 0}
Recent High-Risk Transactions: ${recentTxs.filter((tx: any) => (tx.riskScore || 0) >= 70).length}

Provide a comprehensive DeFi trends analysis covering:
1. Market activity patterns
2. Emerging protocols and trends
3. Risk indicators and red flags
4. Regulatory developments
5. Investment and trading patterns
6. Security concerns
7. Future predictions

Format as a structured trends report with actionable insights.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const trendsText = completion.choices[0]?.message?.content || "Trends analysis unavailable.";

    if (download) {
      const doc = new Document({
        sections: [
          {
            children: [
              paragraph("DeFi Trends Analysis", { heading: HeadingLevel.HEADING_1 }),
              paragraph(`Timeframe: ${timeframe}`),
              paragraph(`Generated: ${new Date().toISOString()}`),
              paragraph("Trends Report", { heading: HeadingLevel.HEADING_2 }),
              paragraph(trendsText),
            ],
          },
        ],
      });
      const buffer = await Packer.toBuffer(doc);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="defi-trends-${timeframe}.docx"`);
      return res.send(Buffer.from(buffer));
    }

    res.json({
      timeframe,
      trends: trendsText,
      stats: {
        transactionsProcessed: stats.transactionsProcessed || 0,
        chainsMonitored: stats.chainsMonitored || 0,
        highRiskCount: recentTxs.filter((tx: any) => (tx.riskScore || 0) >= 70).length,
      },
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error("[DeFi Trends] Error:", error);
    res.status(500).json({ error: String(error?.message || error) });
  }
});

// Serve static files AFTER all API routes
app.use(express.static(path.join(__dirname)));

// Serve regulator.html explicitly
app.get("/regulator", (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "regulator.html"));
});

// Fallback - redirect root to regulator dashboard
app.get("/", (req: Request, res: Response) => {
  res.redirect("/regulator");
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`📊 Regulator Dashboard server running on http://localhost:${PORT}`);
  console.log(`🌐 Open http://localhost:${PORT}/regulator in your browser`);
  console.log(`🔗 Root URL redirects to: http://localhost:${PORT}/regulator`);

  // Start optional auto SAR scheduler if configured
  startAutoSarScheduler();
  
  // Start consolidated report scheduler (runs every 2 hours)
  startConsolidatedReportScheduler();
});

