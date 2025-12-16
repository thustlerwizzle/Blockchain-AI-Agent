# 🏛️ Regulatory Dashboard Guide

## Overview

The Regulatory Monitoring Dashboard provides comprehensive oversight tools for regulators to monitor, assess, and supervise blockchain activity in real-time.

## Access

- **Standard Dashboard**: http://localhost:3001
- **Regulatory Dashboard**: http://localhost:3001/regulator

## Key Features

### 1. Overall Risk Score
- **Real-time risk assessment** (0-100 scale)
- Visual progress bar with color coding
- Updates automatically every 5 seconds

### 2. Financial Health Monitoring
- **Health Score**: Overall financial stability (0-100)
- **Status Indicators**:
  - 🟢 Healthy (80-100)
  - 🟡 Moderate (60-79)
  - 🟠 At Risk (40-59)
  - 🔴 Critical (<40)
- **Key Metrics**:
  - Total Volume (24h)
  - Average Transaction Size
  - Transaction Velocity (tx/hour)
  - Balance Stability

### 3. Compliance Status
- **AML Compliance**: Anti-Money Laundering score (0-100%)
- **KYC Compliance**: Know Your Customer score (0-100%)
- Visual progress bars
- Automatic flagging when below 70%

### 4. Risk Breakdown
- **High Risk**: Transactions with risk score ≥ 70
- **Medium Risk**: Transactions with risk score 40-69
- **Low Risk**: Transactions with risk score < 40
- Visual distribution chart

### 5. Transaction Volume Analysis
- **Last 24 Hours**: Total volume
- **Last 7 Days**: Weekly volume
- **Last 30 Days**: Monthly volume
- **Trend**: Increasing/Decreasing/Stable
- **Growth Rate**: Percentage change

### 6. Suspicious Activity Tracking
- **Total Flagged**: All suspicious transactions
- **High Priority**: Critical alerts requiring immediate attention
- **Pattern Detection**: Common suspicious patterns identified

### 7. Compliance Violations
- Real-time violation tracking
- Severity levels: Low, Medium, High, Critical
- Detailed descriptions
- Timestamp tracking

### 8. Regulatory Recommendations
- AI-generated recommendations
- Actionable insights
- Priority-based suggestions

### 9. Suspicious Patterns
- Pattern type identification
- Frequency counts
- Pattern descriptions

## Alert System

The dashboard automatically displays alert banners when:
- Overall risk score ≥ 70
- Financial health < 40
- AML compliance < 70%
- KYC compliance < 70%

## Auto-Refresh

- Dashboard updates every 5 seconds
- Manual refresh button available
- Last updated timestamp displayed

## Regulatory Metrics Explained

### Risk Score Calculation
- Weighted combination of:
  - High-risk transaction ratio (40%)
  - Compliance scores (30%)
  - Suspicious activity ratio (20%)
  - Financial health (10%)

### Financial Health Score
Based on:
- Transaction volume patterns
- Large transaction frequency
- Transaction velocity
- Balance stability

### Compliance Scores
- **AML**: Based on suspicious transaction detection rate
- **KYC**: Based on new/unverified address ratio

## Usage Tips

1. **Monitor Overall Risk**: Check the main risk score first
2. **Review Financial Health**: Ensure system stability
3. **Check Compliance**: Verify AML/KYC scores are above 70%
4. **Review Violations**: Address any compliance violations immediately
5. **Follow Recommendations**: Implement suggested actions
6. **Track Patterns**: Monitor suspicious activity patterns

## Export & Reporting

(Coming soon: PDF export, CSV download, scheduled reports)

## Support

For questions or issues, refer to the main documentation or contact the development team.

