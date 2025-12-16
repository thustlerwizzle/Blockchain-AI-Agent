# 🚀 Create New Netlify Site for Regulator Dashboard

## Quick Steps

You're logged in to Netlify! Now create a new site:

### Method 1: Interactive (Easiest)

```powershell
cd "C:\Users\takun\OneDrive\Documents\Blockchain AI Agent\Blockchain-AI-Agent\EVM"
netlify init
```

**When prompted:**
1. Choose: **"Create & configure a new project"** (use arrow keys)
2. Team: Select your team
3. Site name: Enter **`regulator-dashboard`** (or your preferred name)
4. Build command: **Leave blank** (press Enter)
5. Directory: Enter **`dashboard`**
6. Functions directory: Enter **`netlify/functions`**

Then deploy:
```powershell
netlify deploy --prod
```

### Method 2: Direct Create (Faster)

```powershell
cd "C:\Users\takun\OneDrive\Documents\Blockchain AI Agent\Blockchain-AI-Agent\EVM"

# Create new site
netlify sites:create --name regulator-dashboard

# Link it (will ask for site ID - paste from above)
netlify link

# Deploy
netlify deploy --prod --dir=dashboard --functions=netlify/functions
```

### Method 3: Use Existing Config

If `netlify.toml` exists (it does), just:

```powershell
cd "C:\Users\takun\OneDrive\Documents\Blockchain AI Agent\Blockchain-AI-Agent\EVM"
netlify init
# Choose "Create & configure a new project"
# It will read netlify.toml automatically

netlify deploy --prod
```

## What Gets Deployed

- ✅ `dashboard/regulator.html` - Main regulator dashboard
- ✅ `dashboard/index.html` - Main dashboard
- ✅ `netlify/functions/server.ts` - API serverless functions
- ✅ All static assets

## After Deployment

Your site will be at: `https://your-site-name.netlify.app`
Regulator dashboard: `https://your-site-name.netlify.app/regulator`

## Verify Deployment

```powershell
# Check status
netlify status

# Open site in browser
netlify open:site
```

## Current Status

✅ Logged in to Netlify
✅ Configuration files ready (`netlify.toml`)
✅ All API URLs fixed (relative paths)
✅ Ready to create new site!

**Run `netlify init` to start!**

