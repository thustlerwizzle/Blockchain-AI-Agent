# 🚀 Automatic Deployment Guide

## Quick Deploy

### Step 1: Login to Netlify (One-time setup)

```powershell
cd "C:\Users\takun\OneDrive\Documents\Blockchain AI Agent\Blockchain-AI-Agent\EVM"
netlify login
```

This will open a browser window. Click "Authorize" to link your Netlify account.

### Step 2: Deploy

```powershell
netlify deploy --prod
```

Or use the automated script:

```powershell
.\deploy-now.ps1
```

## What Gets Deployed

- ✅ `dashboard/` folder → Static HTML files (regulator.html, index.html)
- ✅ `netlify/functions/` → Serverless functions for API endpoints
- ✅ `netlify.toml` → Netlify configuration

## After Deployment

Your site will be available at:
- `https://your-site-name.netlify.app`
- Regulator dashboard: `https://your-site-name.netlify.app/regulator`

## Troubleshooting

### "Session expired" Error
```powershell
netlify logout
netlify login
```

### "Unauthorized" Error
- Make sure you're logged in: `netlify status`
- If not, run: `netlify login`

### Build Fails
- Check that all files are saved
- Verify `netlify.toml` exists
- Check Netlify build logs in dashboard

### API Calls Not Working
- Verify redirects in `netlify.toml` are correct
- Check function logs in Netlify dashboard
- Ensure serverless function file exists: `netlify/functions/server.ts`

## Current Status

✅ All localhost URLs fixed → Using relative paths (`/api/...`)
✅ Netlify configuration ready → `netlify.toml` configured
✅ Serverless functions ready → `netlify/functions/server.ts` created
✅ Static files ready → `dashboard/` folder configured

**Ready to deploy!** Just login and run the deploy command.



