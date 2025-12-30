# 🚀 Deployment Guide - Regulator Dashboard

## Quick Start

### Option 1: GitHub Integration (Recommended)

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Regulator dashboard ready for deployment"
   git push
   ```

2. **Deploy on Netlify:**
   - Go to: https://app.netlify.com
   - Click "Add new site" → "Import an existing project"
   - Connect your GitHub repository
   - Configure:
     - **Base directory:** `EVM`
     - **Publish directory:** `dashboard`
     - **Build command:** (leave blank)
   - Click "Deploy site"

3. **Environment Variables (Optional):**
   - Go to: Site settings → Environment variables
   - Add API keys if needed (see `.env.example`)
   - **Note:** API keys are NOT required - app works offline!

### Option 2: Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Initialize
netlify init
# Choose: Create & configure a new project
# Site name: regulator-dashboard
# Directory: dashboard
# Functions: netlify/functions

# Deploy
netlify deploy --prod
```

### Option 3: Drag & Drop (Static Only)

1. Go to: https://app.netlify.com/drop
2. Drag the `dashboard` folder
3. **Note:** API functions won't work with this method

## Environment Variables

### Required: None! ✅

The application works completely offline with rule-based analysis.

### Optional API Keys:

If you want enhanced features, add these in Netlify Dashboard (Site settings → Environment variables):

```
GOOGLE_AI_API_KEY=your_key_here (optional)
OPENAI_API_KEY=your_key_here (optional)
ETHERSCAN_API_KEY=your_key_here (optional)
PORT=3001 (default)
```

**See `.env.example` for detailed configuration options.**

## Features Available Without API Keys

✅ **Financial Statement Analysis** - Rule-based analysis  
✅ **DeFi Trends Research** - Comprehensive market research  
✅ **PDF Upload & Analysis** - Full PDF parsing support  
✅ **DABA Compliance** - Regulatory compliance checking  
✅ **All Dashboard Features** - Fully functional

## Features Requiring API Keys (Optional)

🔑 **Enhanced AI Analysis** - If using Google/OpenAI APIs  
🔑 **Additional Blockchain Data** - If using Etherscan API

## Troubleshooting

### API Endpoints Not Working

1. Check Functions tab in Netlify dashboard
2. Verify `server` function is deployed
3. Check function logs for errors
4. Ensure `netlify.toml` redirects are correct

### Data Not Loading

1. Hard refresh browser: `Ctrl + Shift + R`
2. Check browser console (F12) for errors
3. Verify API endpoints return data: `https://your-site.netlify.app/api/test`
4. Check Netlify function logs

### Deployment Issues

See `TROUBLESHOOT_DEPLOYMENT.md` for detailed troubleshooting.

## Project Structure

```
EVM/
├── dashboard/              # Frontend files
│   ├── regulator.html     # Main regulator dashboard
│   └── index.html         # Redirects to regulator
├── netlify/
│   └── functions/
│       └── server.ts      # Serverless functions (API endpoints)
├── netlify.toml           # Netlify configuration
├── .env.example           # Environment variables template
└── package.json           # Dependencies
```

## Support

For issues or questions:
1. Check browser console (F12) for errors
2. Check Netlify function logs
3. Review deployment logs in Netlify dashboard



