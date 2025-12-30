# 🚀 Deploy via Drag & Drop - Quick Guide

## Step-by-Step Instructions

### 1. Open Dashboard Folder
- File Explorer should now be open showing the `dashboard` folder
- Location: `EVM\dashboard\`

### 2. Open Netlify Drop Page
- Browser should now be open at: https://app.netlify.com/drop
- You'll see a drop zone area

### 3. Drag & Drop
- **Drag the entire `dashboard` FOLDER** from File Explorer
- **Drop it onto the Netlify drop zone** in your browser
- Wait ~20-30 seconds for upload

### 4. Get Your URL
- Netlify will show you a random URL like: `https://random-name-xxxxx.netlify.app`
- Your regulator dashboard will be at: `https://random-name-xxxxx.netlify.app`

## What's Included

✅ `regulator.html` - Main regulator dashboard  
✅ `index.html` - Redirects to regulator.html  
✅ `server.ts` - Server file (not used in static deployment)

## Access URLs

- **Root URL:** `https://your-site.netlify.app` → Shows regulator dashboard
- **Direct:** `https://your-site.netlify.app/regulator.html` → Shows regulator dashboard

## Note

⚠️ **API endpoints won't work** with drag-and-drop deployment (requires serverless functions setup).  
The HTML dashboard will work, but API calls (`/api/*`) need the full Netlify setup with functions.

For full functionality with APIs, use the CLI deployment method with `netlify init` and `netlify deploy --prod`.

## Current Status

✅ Dashboard folder ready  
✅ Index.html redirects to regulator  
✅ Only regulator dashboard accessible  
✅ Ready to drag & drop!



