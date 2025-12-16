# 🧪 Testing Guide - Verify Data Flow

## Quick Test Commands

### 1. Test API Endpoints

```powershell
# Test stats endpoint
Invoke-RestMethod -Uri "http://localhost:3001/api/stats"

# Test regulatory endpoint
Invoke-RestMethod -Uri "http://localhost:3001/api/regulatory"

# Test DABA endpoint
Invoke-RestMethod -Uri "http://localhost:3001/api/daba"

# Test monitor triggers
Invoke-RestMethod -Uri "http://localhost:3001/api/monitor/triggers"

# Test monitor events
Invoke-RestMethod -Uri "http://localhost:3001/api/monitor/events"

# Test endpoint (verification)
Invoke-RestMethod -Uri "http://localhost:3001/api/test"
```

### 2. Verify Dashboard

1. Open browser: http://localhost:3001/regulator
2. Check browser console (F12) for any errors
3. Verify data is updating every 5 seconds
4. Check all sections display data:
   - DABA Compliance Status
   - Multi-Chain Data
   - Overall Risk Score
   - Financial Health
   - Compliance Status
   - Risk Breakdown
   - Transaction Volume
   - Suspicious Activity
   - Monitor Triggers
   - Monitor Events

### 3. Expected Data

When system is running, you should see:
- ✅ Transactions Processed: > 0
- ✅ Recent Transactions: 10 items
- ✅ Multi-Chain Data: 6+ chains
- ✅ Risk Score: 0-100
- ✅ Financial Health: 0-100
- ✅ Monitor Triggers: 5 triggers
- ✅ Monitor Events: May be 0 initially

## Troubleshooting

### No Data Showing

1. **Check if agent is running:**
   ```powershell
   Invoke-RestMethod -Uri "http://localhost:3001/api/stats" | Select-Object running
   ```

2. **Check server logs** for errors

3. **Verify test data generation:**
   - Wait 10 seconds after server start
   - Test data should auto-generate

4. **Check browser console** for JavaScript errors

### BigInt Serialization Errors

- Fixed with `serializeBigInt()` helper
- All API responses now serialize BigInt values

### Dashboard Not Updating

- Check browser console for fetch errors
- Verify server is running on port 3001
- Check CORS settings
- Verify auto-refresh interval (5 seconds)

## Success Indicators

✅ **System is working if you see:**
- Agent status: RUNNING
- Transactions processed: > 0
- Recent transactions displayed
- Risk scores calculated
- Multi-chain data showing
- Triggers listed
- Dashboard updating automatically

