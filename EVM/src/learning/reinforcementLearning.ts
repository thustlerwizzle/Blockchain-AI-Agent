import type { TransactionAnalysis } from "../analyzer/transactionAnalyzer.js";
import type { StrategyResult } from "../strategy/strategyExecutor.js";

export interface LearningState {
  totalRewards: number;
  episodeCount: number;
  actionHistory: ActionRecord[];
  performanceMetrics: PerformanceMetrics;
}

export interface ActionRecord {
  timestamp: number;
  action: string;
  reward: number;
  context: Record<string, any>;
}

export interface PerformanceMetrics {
  averageReward: number;
  successRate: number;
  totalActions: number;
  bestAction: string;
}

export class ReinforcementLearning {
  private state: LearningState;
  private learningRate: number;
  private discountFactor: number;
  private explorationRate: number;
  private minExplorationRate: number;
  private explorationDecay: number;

  constructor(config: {
    learningRate?: number;
    discountFactor?: number;
    initialExplorationRate?: number;
    minExplorationRate?: number;
    explorationDecay?: number;
  } = {}) {
    this.learningRate = config.learningRate || 0.1;
    this.discountFactor = config.discountFactor || 0.95;
    this.explorationRate = config.initialExplorationRate || 1.0;
    this.minExplorationRate = config.minExplorationRate || 0.01;
    this.explorationDecay = config.explorationDecay || 0.995;

    this.state = {
      totalRewards: 0,
      episodeCount: 0,
      actionHistory: [],
      performanceMetrics: {
        averageReward: 0,
        successRate: 0,
        totalActions: 0,
        bestAction: "",
      },
    };
  }

  /**
   * Calculate reward based on transaction analysis and strategy results
   */
  calculateReward(
    analysis: TransactionAnalysis,
    strategyResults: StrategyResult[]
  ): number {
    let reward = 0;

    // Positive reward for detecting suspicious transactions
    if (analysis.suspicious) {
      reward += 10;
    }

    // Positive reward for high-risk transactions caught
    if (analysis.riskScore >= 70) {
      reward += 5;
    }

    // Positive reward for successful strategy execution
    for (const result of strategyResults) {
      if (result.triggered && result.actionsExecuted.length > 0) {
        reward += 2;
      }
    }

    // Negative reward for false positives (low risk but flagged)
    if (!analysis.suspicious && analysis.riskScore < 30) {
      reward -= 1;
    }

    // Negative reward for missing high-risk transactions
    if (analysis.riskScore >= 80 && !analysis.suspicious) {
      reward -= 5;
    }

    return reward;
  }

  /**
   * Update learning state with new experience
   */
  update(
    analysis: TransactionAnalysis,
    strategyResults: StrategyResult[],
    action: string
  ): void {
    const reward = this.calculateReward(analysis, strategyResults);

    // Record action
    const actionRecord: ActionRecord = {
      timestamp: Date.now(),
      action,
      reward,
      context: {
        riskScore: analysis.riskScore,
        suspicious: analysis.suspicious,
        strategiesTriggered: strategyResults.length,
      },
    };

    this.state.actionHistory.push(actionRecord);
    this.state.totalRewards += reward;
    this.state.episodeCount++;

    // Update performance metrics
    this.updatePerformanceMetrics();

    // Decay exploration rate
    this.explorationRate = Math.max(
      this.minExplorationRate,
      this.explorationRate * this.explorationDecay
    );

    // Keep history limited
    if (this.state.actionHistory.length > 1000) {
      this.state.actionHistory.shift();
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(): void {
    const history = this.state.actionHistory;
    if (history.length === 0) return;

    const totalRewards = history.reduce((sum, record) => sum + record.reward, 0);
    const successfulActions = history.filter((record) => record.reward > 0).length;

    this.state.performanceMetrics = {
      averageReward: totalRewards / history.length,
      successRate: successfulActions / history.length,
      totalActions: history.length,
      bestAction: this.findBestAction(),
    };
  }

  /**
   * Find the best performing action
   */
  private findBestAction(): string {
    const actionRewards = new Map<string, number[]>();

    for (const record of this.state.actionHistory) {
      if (!actionRewards.has(record.action)) {
        actionRewards.set(record.action, []);
      }
      actionRewards.get(record.action)!.push(record.reward);
    }

    let bestAction = "";
    let bestAverage = -Infinity;

    for (const [action, rewards] of actionRewards.entries()) {
      const average = rewards.reduce((a, b) => a + b, 0) / rewards.length;
      if (average > bestAverage) {
        bestAverage = average;
        bestAction = action;
      }
    }

    return bestAction;
  }

  /**
   * Decide whether to explore or exploit
   */
  shouldExplore(): boolean {
    return Math.random() < this.explorationRate;
  }

  /**
   * Get current learning state
   */
  getState(): LearningState {
    return { ...this.state };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.state.performanceMetrics };
  }

  /**
   * Reset learning state
   */
  reset(): void {
    this.state = {
      totalRewards: 0,
      episodeCount: 0,
      actionHistory: [],
      performanceMetrics: {
        averageReward: 0,
        successRate: 0,
        totalActions: 0,
        bestAction: "",
      },
    };
    this.explorationRate = 1.0;
  }
}

