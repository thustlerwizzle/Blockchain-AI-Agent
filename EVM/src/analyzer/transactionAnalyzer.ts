import OpenAI from "openai";
import type { TransactionEvent } from "../listener/blockchainListener.js";

export interface TransactionAnalysis {
  riskScore: number; // 0-100
  anomalyFlags: string[];
  category: string;
  summary: string;
  recommendations: string[];
  suspicious: boolean;
}

export interface AnalyzerConfig {
  openaiApiKey?: string;
  riskThreshold?: number;
  enableAIAnalysis?: boolean;
}

export class TransactionAnalyzer {
  private openai: OpenAI | null = null;
  private riskThreshold: number;
  private enableAIAnalysis: boolean;
  private transactionHistory: Map<string, TransactionEvent[]> = new Map();

  constructor(config: AnalyzerConfig = {}) {
    this.riskThreshold = config.riskThreshold || 70;
    this.enableAIAnalysis = config.enableAIAnalysis ?? true;

    if (config.openaiApiKey || process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: config.openaiApiKey || process.env.OPENAI_API_KEY,
      });
    }
  }

  /**
   * Analyze a transaction for anomalies and risks
   */
  async analyzeTransaction(
    tx: TransactionEvent
  ): Promise<TransactionAnalysis> {
    const anomalyFlags: string[] = [];
    let riskScore = 0;

    // Rule-based analysis
    const ruleBasedAnalysis = this.ruleBasedAnalysis(tx);
    riskScore += ruleBasedAnalysis.riskScore;
    anomalyFlags.push(...ruleBasedAnalysis.flags);

    // Pattern-based analysis
    const patternAnalysis = this.patternBasedAnalysis(tx);
    riskScore += patternAnalysis.riskScore;
    anomalyFlags.push(...patternAnalysis.flags);

    // AI-based analysis (if enabled)
    let aiAnalysis: { summary: string; recommendations: string[] } = { summary: "", recommendations: [] };
    if (this.enableAIAnalysis && this.openai) {
      try {
        aiAnalysis = await this.aiAnalysis(tx, anomalyFlags);
      } catch (error) {
        console.error("AI analysis failed:", error);
      }
    }

    const suspicious = riskScore >= this.riskThreshold;

    return {
      riskScore: Math.min(100, riskScore),
      anomalyFlags: [...new Set(anomalyFlags)],
      category: this.categorizeTransaction(tx),
      summary:
        aiAnalysis.summary ||
        `Transaction ${suspicious ? "flagged" : "normal"} with risk score ${riskScore}`,
      recommendations: aiAnalysis.recommendations || [],
      suspicious,
    };
  }

  /**
   * Rule-based analysis
   */
  private ruleBasedAnalysis(tx: TransactionEvent): {
    riskScore: number;
    flags: string[];
  } {
    let riskScore = 0;
    const flags: string[] = [];

    // Large value transactions
    const valueInEth = Number(tx.value) / 1e18;
    if (valueInEth > 100) {
      riskScore += 20;
      flags.push("LARGE_VALUE");
    }
    if (valueInEth > 1000) {
      riskScore += 30;
      flags.push("VERY_LARGE_VALUE");
    }

    // Zero value with data (contract interaction)
    if (tx.value === BigInt(0) && tx.data && tx.data.length > 2) {
      riskScore += 10;
      flags.push("CONTRACT_INTERACTION");
    }

    // Missing recipient (contract creation)
    if (!tx.to) {
      riskScore += 15;
      flags.push("CONTRACT_CREATION");
    }

    return { riskScore, flags };
  }

  /**
   * Pattern-based analysis
   */
  private patternBasedAnalysis(tx: TransactionEvent): {
    riskScore: number;
    flags: string[];
  } {
    let riskScore = 0;
    const flags: string[] = [];

    // Check transaction history for this address
    const fromHistory = this.transactionHistory.get(tx.from) || [];
    const toHistory = tx.to
      ? this.transactionHistory.get(tx.to) || []
      : [];

    // Rapid transactions (potential bot activity)
    const recentFromTxs = fromHistory.filter(
      (h) => Date.now() - h.timestamp * 1000 < 60000
    );
    if (recentFromTxs.length > 5) {
      riskScore += 25;
      flags.push("RAPID_TRANSACTIONS");
    }

    // First-time address
    if (fromHistory.length === 0) {
      riskScore += 5;
      flags.push("NEW_ADDRESS");
    }

    // Update history
    fromHistory.push(tx);
    if (fromHistory.length > 100) {
      fromHistory.shift();
    }
    this.transactionHistory.set(tx.from, fromHistory);

    if (tx.to) {
      toHistory.push(tx);
      if (toHistory.length > 100) {
        toHistory.shift();
      }
      this.transactionHistory.set(tx.to, toHistory);
    }

    return { riskScore, flags };
  }

  /**
   * AI-based analysis using OpenAI
   */
  private async aiAnalysis(
    tx: TransactionEvent,
    flags: string[]
  ): Promise<{ summary: string; recommendations: string[] }> {
    if (!this.openai) {
      return { summary: "", recommendations: [] };
    }

    const prompt = `Analyze this blockchain transaction and provide insights:

Transaction Details:
- Hash: ${tx.hash}
- From: ${tx.from}
- To: ${tx.to || "Contract Creation"}
- Value: ${tx.value.toString()} wei
- Chain: ${tx.chain}
- Anomaly Flags: ${flags.join(", ") || "None"}

Provide:
1. A brief summary of the transaction
2. Risk assessment
3. Recommendations for monitoring or action

Format as JSON with keys: summary, riskLevel, recommendations (array)`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a blockchain security analyst. Analyze transactions and provide concise, actionable insights.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        return {
          summary: parsed.summary || "",
          recommendations: parsed.recommendations || [],
        };
      }
    } catch (error) {
      console.error("AI analysis error:", error);
    }

    return { summary: "", recommendations: [] };
  }

  /**
   * Categorize transaction type
   */
  private categorizeTransaction(tx: TransactionEvent): string {
    if (!tx.to) return "CONTRACT_CREATION";
    if (tx.value === BigInt(0) && tx.data) return "CONTRACT_INTERACTION";
    if (tx.value > BigInt(0)) return "VALUE_TRANSFER";
    return "UNKNOWN";
  }

  /**
   * Batch analyze multiple transactions
   */
  async analyzeBatch(
    transactions: TransactionEvent[]
  ): Promise<TransactionAnalysis[]> {
    return Promise.all(
      transactions.map((tx) => this.analyzeTransaction(tx))
    );
  }
}

