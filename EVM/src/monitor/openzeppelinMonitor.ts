/**
 * OpenZeppelin Monitor Integration
 * Inspired by https://github.com/OpenZeppelin/openzeppelin-monitor
 * 
 * Provides trigger-based monitoring with configurable conditions
 * and notification capabilities
 */

import type { TransactionEvent } from "../listener/blockchainListener.js";
import type { TransactionAnalysis } from "../analyzer/transactionAnalyzer.js";
import type { Address } from "viem";

export interface MonitorTrigger {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  network: string;
  conditions: TriggerCondition[];
  actions: TriggerAction[];
  cooldown?: number; // milliseconds
  lastTriggered?: number;
}

export interface TriggerCondition {
  type: 
    | "address_match" 
    | "value_threshold" 
    | "function_call"
    | "event_emitted"
    | "risk_score"
    | "anomaly_flag"
    | "custom";
  operator?: "==" | "!=" | ">" | "<" | ">=" | "<=" | "includes" | "not_includes";
  value: any;
  field?: string;
  contractAddress?: Address;
  functionSignature?: string;
  eventSignature?: string;
}

export interface TriggerAction {
  type: "notification" | "webhook" | "email" | "log" | "alert" | "execute";
  config: {
    webhookUrl?: string;
    emailTo?: string[];
    emailSubject?: string;
    message?: string;
    template?: string;
    script?: string;
  };
}

export interface MonitorEvent {
  triggerId: string;
  triggerName: string;
  timestamp: number;
  transaction: TransactionEvent;
  analysis?: TransactionAnalysis;
  matchedConditions: string[];
  actionResults: {
    action: string;
    success: boolean;
    result?: any;
  }[];
}

export class OpenZeppelinMonitor {
  private triggers: Map<string, MonitorTrigger> = new Map();
  private eventHistory: MonitorEvent[] = [];
  private readonly maxHistorySize = 10000;

  /**
   * Register a monitoring trigger
   */
  registerTrigger(trigger: MonitorTrigger): void {
    this.triggers.set(trigger.id, trigger);
    console.log(`📡 Monitor trigger registered: ${trigger.name} (${trigger.id})`);
  }

  /**
   * Remove a trigger
   */
  removeTrigger(triggerId: string): void {
    this.triggers.delete(triggerId);
  }

  /**
   * Get all triggers
   */
  getTriggers(): MonitorTrigger[] {
    return Array.from(this.triggers.values());
  }

  /**
   * Get enabled triggers
   */
  getEnabledTriggers(): MonitorTrigger[] {
    return Array.from(this.triggers.values()).filter((t) => t.enabled);
  }

  /**
   * Evaluate a transaction against all triggers
   */
  async evaluateTransaction(
    tx: TransactionEvent,
    analysis?: TransactionAnalysis
  ): Promise<MonitorEvent[]> {
    const events: MonitorEvent[] = [];
    const enabledTriggers = this.getEnabledTriggers();

    for (const trigger of enabledTriggers) {
      // Check network match
      if (trigger.network !== tx.chain && trigger.network !== "*") {
        continue;
      }

      // Check cooldown
      if (trigger.cooldown && trigger.lastTriggered) {
        const timeSinceLastTrigger = Date.now() - trigger.lastTriggered;
        if (timeSinceLastTrigger < trigger.cooldown) {
          continue;
        }
      }

      // Evaluate conditions
      const matchedConditions: string[] = [];
      let allConditionsMet = true;

      for (const condition of trigger.conditions) {
        const conditionMet = this.evaluateCondition(condition, tx, analysis);
        if (conditionMet) {
          matchedConditions.push(condition.type);
        } else {
          allConditionsMet = false;
          break; // All conditions must be met (AND logic)
        }
      }

      if (allConditionsMet) {
        // Execute actions
        const actionResults = await this.executeActions(trigger, tx, analysis);

        const event: MonitorEvent = {
          triggerId: trigger.id,
          triggerName: trigger.name,
          timestamp: Date.now(),
          transaction: tx,
          analysis,
          matchedConditions,
          actionResults,
        };

        events.push(event);
        this.eventHistory.push(event);

        console.log(`📡 Monitor trigger "${trigger.name}" matched! Event created.`);
        console.log(`   Conditions matched: ${matchedConditions.join(', ')}`);
        console.log(`   Transaction: ${tx.hash} on ${tx.chain}`);

        // Update last triggered time
        trigger.lastTriggered = Date.now();

        // Keep history limited
        if (this.eventHistory.length > this.maxHistorySize) {
          this.eventHistory.shift();
        }
      }
    }

    return events;
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(
    condition: TriggerCondition,
    tx: TransactionEvent,
    analysis?: TransactionAnalysis
  ): boolean {
    switch (condition.type) {
      case "address_match":
        const address = condition.field === "from" ? tx.from : tx.to;
        return this.compareValues(address, condition.operator || "==", condition.value);

      case "value_threshold":
        return this.compareValues(
          Number(tx.value),
          condition.operator || ">",
          Number(condition.value)
        );

      case "function_call":
        if (!tx.data || !condition.functionSignature) return false;
        return tx.data.startsWith(condition.functionSignature.slice(0, 10)); // First 4 bytes

      case "risk_score":
        if (!analysis) return false;
        return this.compareValues(
          analysis.riskScore,
          condition.operator || ">=",
          condition.value
        );

      case "anomaly_flag":
        if (!analysis) return false;
        const hasFlag = analysis.anomalyFlags.includes(condition.value);
        return condition.operator === "not_includes" ? !hasFlag : hasFlag;

      case "event_emitted":
        // Would need to decode logs for full event matching
        // For now, check if transaction has data (likely event)
        return !!tx.data && tx.data.length > 2;

      default:
        return false;
    }
  }

  /**
   * Compare values based on operator
   */
  private compareValues(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case "==":
        return actual === expected;
      case "!=":
        return actual !== expected;
      case ">":
        return actual > expected;
      case "<":
        return actual < expected;
      case ">=":
        return actual >= expected;
      case "<=":
        return actual <= expected;
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
   * Execute trigger actions
   */
  private async executeActions(
    trigger: MonitorTrigger,
    tx: TransactionEvent,
    analysis?: TransactionAnalysis
  ): Promise<MonitorEvent["actionResults"]> {
    const results: MonitorEvent["actionResults"] = [];

    for (const action of trigger.actions) {
      try {
        let result: any;

        switch (action.type) {
          case "notification":
            result = await this.sendNotification(action, tx, analysis);
            break;

          case "webhook":
            result = await this.sendWebhook(action, tx, analysis);
            break;

          case "email":
            result = await this.sendEmail(action, tx, analysis);
            break;

          case "log":
            result = this.logEvent(action, tx, analysis);
            break;

          case "alert":
            result = this.createAlert(action, tx, analysis);
            break;

          case "execute":
            result = await this.executeScript(action, tx, analysis);
            break;

          default:
            result = { error: "Unknown action type" };
        }

        results.push({
          action: action.type,
          success: !result.error,
          result,
        });
      } catch (error) {
        results.push({
          action: action.type,
          success: false,
          result: { error: String(error) },
        });
      }
    }

    return results;
  }

  /**
   * Send notification
   */
  private async sendNotification(
    action: TriggerAction,
    tx: TransactionEvent,
    analysis?: TransactionAnalysis
  ): Promise<any> {
    const message = this.interpolateTemplate(
      action.config.message || "Trigger activated: ${triggerName}",
      { tx, analysis, triggerName: "Monitor Trigger" }
    );

    console.log(`🔔 NOTIFICATION: ${message}`);
    return { success: true, message };
  }

  /**
   * Send webhook
   */
  private async sendWebhook(
    action: TriggerAction,
    tx: TransactionEvent,
    analysis?: TransactionAnalysis
  ): Promise<any> {
    if (!action.config.webhookUrl) {
      throw new Error("Webhook URL not provided");
    }

    const payload = {
      transaction: tx,
      analysis,
      timestamp: Date.now(),
    };

    const response = await fetch(action.config.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.statusText}`);
    }

    return { success: true, status: response.status };
  }

  /**
   * Send email (placeholder - would need email service)
   */
  private async sendEmail(
    action: TriggerAction,
    tx: TransactionEvent,
    analysis?: TransactionAnalysis
  ): Promise<any> {
    // Would integrate with email service (SMTP, SendGrid, etc.)
    console.log(`📧 EMAIL: Would send to ${action.config.emailTo?.join(", ")}`);
    return { success: true, note: "Email service not configured" };
  }

  /**
   * Log event
   */
  private logEvent(
    action: TriggerAction,
    tx: TransactionEvent,
    analysis?: TransactionAnalysis
  ): any {
    const message = this.interpolateTemplate(
      action.config.message || "Event logged",
      { tx, analysis }
    );
    console.log(`📝 LOG: ${message}`);
    return { success: true, logged: true };
  }

  /**
   * Create alert
   */
  private createAlert(
    action: TriggerAction,
    tx: TransactionEvent,
    analysis?: TransactionAnalysis
  ): any {
    const message = this.interpolateTemplate(
      action.config.message || "Alert triggered",
      { tx, analysis }
    );
    console.log(`🚨 ALERT: ${message}`);
    return { success: true, alert: message };
  }

  /**
   * Execute script (placeholder - security risk if implemented)
   */
  private async executeScript(
    action: TriggerAction,
    tx: TransactionEvent,
    analysis?: TransactionAnalysis
  ): Promise<any> {
    // WARNING: Executing scripts is a security risk
    // This is a placeholder - actual implementation should be sandboxed
    console.warn("⚠️ Script execution not implemented for security reasons");
    return { success: false, error: "Script execution disabled" };
  }

  /**
   * Interpolate template variables
   */
  private interpolateTemplate(template: string, context: any): string {
    return template.replace(/\${(\w+)}/g, (match, key) => {
      const keys = key.split(".");
      let value = context;
      for (const k of keys) {
        value = value?.[k];
      }
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Get event history
   */
  getEventHistory(limit?: number): MonitorEvent[] {
    const history = [...this.eventHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Get events for a specific trigger
   */
  getTriggerEvents(triggerId: string, limit?: number): MonitorEvent[] {
    const events = this.eventHistory.filter((e) => e.triggerId === triggerId);
    return limit ? events.slice(-limit).reverse() : events.reverse();
  }

  /**
   * Load triggers from configuration (JSON format)
   */
  loadTriggersFromConfig(config: MonitorTrigger[]): void {
    for (const trigger of config) {
      this.registerTrigger(trigger);
    }
  }
}

