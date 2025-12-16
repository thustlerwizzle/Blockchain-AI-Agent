# 📤 Push Project to GitHub - Quick Guide

## Step 1: Configure Git (One-time setup)

If you haven't set your git identity yet, run:

```bash
git config --global user.email "your-email@example.com"
git config --global user.name "Your Name"
```

## Step 2: Add All Files

```bash
cd "C:\Users\takun\OneDrive\Documents\Blockchain AI Agent\Blockchain-AI-Agent"
git add .
```

## Step 3: Commit Changes

```bash
git commit -m "Add deployment configuration, environment example, and updated regulator dashboard"
```

## Step 4: Push to GitHub

```bash
git push
```

## What's Included

✅ `.env.example` - Environment variables template with API key instructions  
✅ `README_DEPLOYMENT.md` - Complete deployment guide  
✅ `netlify.toml` - Netlify configuration  
✅ `netlify/functions/server.ts` - Serverless functions  
✅ `dashboard/regulator.html` - Updated regulator dashboard  
✅ All deployment configurations

## After Pushing

1. Go to: https://app.netlify.com
2. Click "Add new site" → "Import an existing project"
3. Connect your GitHub repository
4. Configure:
   - **Base directory:** `EVM`
   - **Publish directory:** `dashboard`
   - **Build command:** (leave blank)
5. Click "Deploy site"

Netlify will automatically:
- Deploy static files
- Include serverless functions
- Use your `netlify.toml` configuration
- Auto-deploy on every git push!

## Environment Variables in Netlify

After deployment:
1. Go to: Site settings → Environment variables
2. Add API keys if needed (see `.env.example` for details)
3. **Note:** API keys are NOT required - app works offline!

