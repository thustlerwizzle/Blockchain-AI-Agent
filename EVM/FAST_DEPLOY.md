# ⚡ FAST DEPLOYMENT - Quick Methods

## Method 1: Drag & Drop (FASTEST - 30 seconds!)

1. **Go to:** https://app.netlify.com/drop
2. **Drag the entire `dashboard` folder** from:
   ```
   C:\Users\takun\OneDrive\Documents\Blockchain AI Agent\Blockchain-AI-Agent\EVM\dashboard
   ```
3. **Wait for upload** (~10-20 seconds)
4. **Get your URL instantly!**

**Note:** This creates a basic site. For API functions, use Method 2.

## Method 2: GitHub Integration (BEST - Auto-deploys)

1. **Push to GitHub** (if not already):
   ```bash
   git add .
   git commit -m "Ready for Netlify"
   git push
   ```

2. **Go to:** https://app.netlify.com
3. **Click:** "Add new site" → "Import an existing project"
4. **Connect GitHub**
5. **Select your repository**
6. **Configure:**
   - Base directory: `EVM`
   - Build command: (leave blank)
   - Publish directory: `dashboard`
7. **Deploy!**

Auto-deploys on every git push!

## Method 3: Netlify CLI (If already initialized)

If you already ran `netlify init`:

```powershell
cd "C:\Users\takun\OneDrive\Documents\Blockchain AI Agent\Blockchain-AI-Agent\EVM"
netlify deploy --prod
```

That's it!

## Method 4: Zip Upload (Alternative)

1. **Create a zip** of the `dashboard` folder
2. **Go to:** https://app.netlify.com/drop
3. **Drag the zip file**
4. **Netlify will extract and deploy**

## Recommended: Method 1 (Drag & Drop)

**Fastest way right now:**
- Open File Explorer
- Navigate to: `EVM\dashboard`
- Drag the entire `dashboard` folder to: https://app.netlify.com/drop
- Done in 30 seconds!

