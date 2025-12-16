# 📡 OpenZeppelin Monitor Integration

## Overview

This system integrates monitoring capabilities inspired by [OpenZeppelin Monitor](https://github.com/OpenZeppelin/openzeppelin-monitor), a blockchain monitoring service that watches for specific on-chain activities and triggers notifications based on configurable conditions.

## Features

### Trigger-Based Monitoring
- **Configurable Triggers**: Define custom monitoring rules
- **Multiple Conditions**: Combine conditions with AND logic
- **Action Execution**: Execute actions when triggers fire
- **Cooldown Periods**: Prevent trigger spam
- **Network Filtering**: Monitor specific chains or all chains

### Supported Condition Types
- `address_match`: Match specific addresses (from/to)
- `value_threshold`: Monitor transaction values
- `function_call`: Detect specific function calls
- `event_emitted`: Detect contract events
- `risk_score`: Monitor risk scores
- `anomaly_flag`: Detect anomaly flags
- `custom`: Custom condition logic

### Supported Actions
- `notification`: Console notifications
- `webhook`: HTTP webhook calls
- `email`: Email notifications (placeholder)
- `log`: Logging
- `alert`: Alert generation
- `execute`: Script execution (disabled for security)

## Configuration

Triggers are configured in `config/monitor-triggers.json`:

```json
{
  "id": "high-risk-alert",
  "name": "High Risk Transaction Alert",
  "enabled": true,
  "network": "*",
  "conditions": [
    {
      "type": "risk_score",
      "operator": ">=",
      "value": 80
    }
  ],
  "actions": [
    {
      "type": "alert",
      "config": {
        "message": "🚨 High-risk transaction detected"
      }
    }
  ],
  "cooldown": 60000
}
```

## Default Triggers

The system comes with pre-configured triggers:

1. **High Risk Transaction Alert**: Alerts when risk score ≥ 80
2. **Large Value Monitor**: Monitors transactions > 1 ETH
3. **Suspicious Activity Detection**: Detects rapid transaction patterns
4. **Contract Interaction Monitor**: Monitors specific contract interactions
5. **DABA Compliance Alert**: Alerts for DABA compliance violations

## API Endpoints

### Get All Triggers
```
GET /api/monitor/triggers
```

### Get Monitor Events
```
GET /api/monitor/events?limit=100&triggerId=optional
```

### Register New Trigger
```
POST /api/monitor/triggers
Content-Type: application/json

{
  "id": "custom-trigger",
  "name": "Custom Trigger",
  "enabled": true,
  "network": "*",
  "conditions": [...],
  "actions": [...]
}
```

## Dashboard Integration

The regulatory dashboard displays:
- **Monitor Triggers**: All configured triggers with status
- **Monitor Events**: Recent trigger events with details
- **Real-time Updates**: Auto-refreshes every 5 seconds

## Usage Example

### Creating a Custom Trigger

```typescript
const customTrigger = {
  id: "my-custom-trigger",
  name: "My Custom Monitor",
  enabled: true,
  network: "ethereum",
  conditions: [
    {
      type: "address_match",
      operator: "==",
      field: "to",
      value: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
    },
    {
      type: "value_threshold",
      operator: ">",
      value: "1000000000000000000" // 1 ETH
    }
  ],
  actions: [
    {
      type: "webhook",
      config: {
        webhookUrl: "https://your-webhook-url.com/alert"
      }
    }
  ],
  cooldown: 300000 // 5 minutes
};

// Register via API
fetch('http://localhost:3001/api/monitor/triggers', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(customTrigger)
});
```

## Integration with OpenZeppelin Monitor

While OpenZeppelin Monitor is written in Rust, this TypeScript implementation provides:
- ✅ Same trigger-based monitoring concepts
- ✅ Configurable conditions and actions
- ✅ Real-time transaction evaluation
- ✅ Event history tracking
- ✅ Webhook and notification support
- ✅ Integration with existing dashboard

## Architecture

```
Transaction Event
    ↓
OpenZeppelin Monitor
    ↓
Evaluate Conditions
    ↓
Execute Actions
    ↓
Store Events
    ↓
Dashboard Display
```

## Security Considerations

- **Script Execution**: Disabled by default for security
- **Webhook Validation**: Validate webhook URLs before use
- **Cooldown Periods**: Prevent trigger spam
- **Network Filtering**: Limit triggers to specific networks

## References

- [OpenZeppelin Monitor GitHub](https://github.com/OpenZeppelin/openzeppelin-monitor)
- [OpenZeppelin Monitor Documentation](https://docs.openzeppelin.com/monitor)

