import type { TransactionEvent } from "../listener/blockchainListener.js";
import type { TransactionAnalysis } from "../analyzer/transactionAnalyzer.js";
import { createViemWalletClient } from "../viem/createViemWalletClient.js";
import type { Address } from "viem";

export interface Strategy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: StrategyCondition[];
  actions: StrategyAction[];
  metadata?: Record<string, any>;
}

export interface StrategyCondition {
  type: "risk_score" | "anomaly_flag" | "value_threshold" | "address_match" | "custom";
  operator: ">" | "<" | ">=" | "<=" | "==" | "!=" | "includes" | "not_includes";
  value: any;
  field?: string;
}

export interface StrategyAction {
  type: "alert" | "execute_transaction" | "log" | "webhook" | "custom";
  params: Record<string, any>;
}

export interface StrategyResult {
  strategyId: string;
  triggered: boolean;
  actionsExecuted: string[];
  timestamp: number;
}

export class StrategyExecutor {
  private strategies: Map<string, Strategy> = new Map();
  private executionHistory: StrategyResult[] = [];

  /**
   * Register a new strategy
   */
  registerStrategy(strategy: Strategy): void {
    this.strategies.set(strategy.id, strategy);
    console.log(`Strategy registered: ${strategy.name} (${strategy.id})`);
  }

  /**
   * Remove a strategy
   */
  removeStrategy(strategyId: string): void {
    this.strategies.delete(strategyId);
  }

  /**
   * Get all strategies
   */
  getStrategies(): Strategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Get enabled strategies
   */
  getEnabledStrategies(): Strategy[] {
    return Array.from(this.strategies.values()).filter((s) => s.enabled);
  }

  /**
   * Evaluate a transaction against all enabled strategies
   */
  async evaluateTransaction(
    tx: TransactionEvent,
    analysis: TransactionAnalysis
  ): Promise<StrategyResult[]> {
    const results: StrategyResult[] = [];
    const enabledStrategies = this.getEnabledStrategies();

    for (const strategy of enabledStrategies) {
      const triggered = this.evaluateConditions(strategy, tx, analysis);

      if (triggered) {
        const result = await this.executeStrategy(strategy, tx, analysis);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Evaluate strategy conditions
   */
  private evaluateConditions(
    strategy: Strategy,
    tx: TransactionEvent,
    analysis: TransactionAnalysis
  ): boolean {
    for (const condition of strategy.conditions) {
      const conditionMet = this.evaluateCondition(condition, tx, analysis);
      if (!conditionMet) {
        return false; // All conditions must be met (AND logic)
      }
    }
    return true;
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(
    condition: StrategyCondition,
    tx: TransactionEvent,
    analysis: TransactionAnalysis
  ): boolean {
    let actualValue: any;

    switch (condition.type) {
      case "risk_score":
        actualValue = analysis.riskScore;
        break;
      case "anomaly_flag":
        actualValue = analysis.anomalyFlags;
        break;
      case "value_threshold":
        actualValue = Number(tx.value);
        break;
      case "address_match":
        actualValue = condition.field === "from" ? tx.from : tx.to;
        break;
      default:
        return false;
    }

    return this.compareValues(actualValue, condition.operator, condition.value);
  }

  /**
   * Compare values based on operator
   */
  private compareValues(
    actual: any,
    operator: string,
    expected: any
  ): boolean {
    switch (operator) {
      case ">":
        return actual > expected;
      case "<":
        return actual < expected;
      case ">=":
        return actual >= expected;
      case "<=":
        return actual <= expected;
      case "==":
        return actual === expected;
      case "!=":
        return actual !== expected;
      case "includes":
        if (Array.isArray(actual)) {
          return actual.includes(expected);
        }
        return String(actual).includes(String(expected));
      case "not_includes":
        if (Array.isArray(actual)) {
          return !actual.includes(expected);
        }
        return !String(actual).includes(String(expected));
      default:
        return false;
    }
  }

  /**
   * Execute strategy actions
   */
  private async executeStrategy(
    strategy: Strategy,
    tx: TransactionEvent,
    analysis: TransactionAnalysis
  ): Promise<StrategyResult> {
    const executedActions: string[] = [];

    for (const action of strategy.actions) {
      try {
        await this.executeAction(action, tx, analysis);
        executedActions.push(action.type);
      } catch (error) {
        console.error(
          `Failed to execute action ${action.type} for strategy ${strategy.id}:`,
          error
        );
      }
    }

    const result: StrategyResult = {
      strategyId: strategy.id,
      triggered: true,
      actionsExecuted: executedActions,
      timestamp: Date.now(),
    };

    this.executionHistory.push(result);
    return result;
  }

  /**
   * Execute a single action
   */
  private async executeAction(
    action: StrategyAction,
    tx: TransactionEvent,
    analysis: TransactionAnalysis
  ): Promise<void> {
    switch (action.type) {
      case "alert":
        console.log(
          `🚨 ALERT [${action.params.title || "Strategy Triggered"}]:`,
          action.params.message || `Transaction ${tx.hash} triggered strategy`
        );
        break;

      case "log":
        console.log(
          `📝 LOG:`,
          action.params.message || JSON.stringify({ tx: tx.hash, analysis })
        );
        break;

      case "execute_transaction":
        await this.executeTransactionAction(action, tx);
        break;

      case "webhook":
        await this.executeWebhookAction(action, tx, analysis);
        break;

      default:
        console.warn(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Execute a transaction action
   */
  private async executeTransactionAction(
    action: StrategyAction,
    tx: TransactionEvent
  ): Promise<void> {
    try {
      const walletClient = createViemWalletClient();
      const params = action.params;

      if (params.to && params.value !== undefined) {
        const hash = await walletClient.sendTransaction({
          to: params.to as Address,
          value: BigInt(params.value),
          data: params.data,
        });

        console.log(`✅ Transaction executed: ${hash}`);
      }
    } catch (error) {
      console.error("Failed to execute transaction:", error);
      throw error;
    }
  }

  /**
   * Execute webhook action
   */
  private async executeWebhookAction(
    action: StrategyAction,
    tx: TransactionEvent,
    analysis: TransactionAnalysis
  ): Promise<void> {
    const url = action.params.url;
    if (!url) {
      throw new Error("Webhook URL not provided");
    }

    try {
      const response = await fetch(url, {
        method: action.params.method || "POST",
        headers: {
          "Content-Type": "application/json",
          ...action.params.headers,
        },
        body: JSON.stringify({
          transaction: tx,
          analysis,
          timestamp: Date.now(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error("Webhook execution failed:", error);
      throw error;
    }
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit?: number): StrategyResult[] {
    const history = [...this.executionHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }
}

