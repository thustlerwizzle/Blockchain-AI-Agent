# 🚀 Blockchain AI Agent - Windows Deployment Script
# PowerShell script for deploying to cloud platforms

Write-Host "🚀 Blockchain AI Agent Deployment Helper" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Bun is installed
try {
    $bunVersion = bun --version
    Write-Host "✅ Bun is installed: $bunVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Bun is not installed. Please install Bun first:" -ForegroundColor Red
    Write-Host "   Visit: https://bun.sh" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Select deployment option:" -ForegroundColor Yellow
Write-Host "1) Railway (Recommended - Easy)" -ForegroundColor White
Write-Host "2) Render (GitHub integration)" -ForegroundColor White
Write-Host "3) Fly.io (Global edge deployment)" -ForegroundColor White
Write-Host "4) Show deployment instructions" -ForegroundColor White
Write-Host "5) Test local deployment" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Enter choice [1-5]"

switch ($choice) {
    "1" {
        Write-Host "🚂 Deploying to Railway..." -ForegroundColor Cyan
        Write-Host ""
        
        # Check if Railway CLI is installed
        try {
            railway --version | Out-Null
        } catch {
            Write-Host "📦 Installing Railway CLI..." -ForegroundColor Yellow
            npm i -g @railway/cli
        }
        
        Write-Host "🔐 Please login to Railway:" -ForegroundColor Yellow
        railway login
        
        Write-Host "🚀 Initializing Railway project..." -ForegroundColor Yellow
        railway init
        
        Write-Host "🚀 Deploying..." -ForegroundColor Yellow
        railway up
        
        Write-Host "✅ Deployment complete! Check your Railway dashboard for the URL." -ForegroundColor Green
    }
    "2" {
        Write-Host "🎨 Render Deployment Instructions:" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "1. Go to https://render.com and create a new Web Service" -ForegroundColor White
        Write-Host "2. Connect your GitHub repository" -ForegroundColor White
        Write-Host "3. Configure:" -ForegroundColor White
        Write-Host "   - Build Command: bun install" -ForegroundColor Gray
        Write-Host "   - Start Command: bun run start:dashboard" -ForegroundColor Gray
        Write-Host "   - Environment: Node" -ForegroundColor Gray
        Write-Host "   - Root Directory: EVM" -ForegroundColor Gray
        Write-Host "4. Add environment variables (optional):" -ForegroundColor White
        Write-Host "   - PORT=3001" -ForegroundColor Gray
        Write-Host "5. Deploy!" -ForegroundColor White
        Write-Host ""
        Write-Host "📝 Note: Render will auto-deploy on git push if connected to GitHub" -ForegroundColor Yellow
    }
    "3" {
        Write-Host "✈️  Deploying to Fly.io..." -ForegroundColor Cyan
        Write-Host ""
        Write-Host "📝 Fly.io CLI installation:" -ForegroundColor Yellow
        Write-Host "   Visit: https://fly.io/docs/getting-started/installing-flyctl/" -ForegroundColor White
        Write-Host ""
        Write-Host "After installing, run:" -ForegroundColor Yellow
        Write-Host "   fly auth login" -ForegroundColor White
        Write-Host "   fly launch" -ForegroundColor White
        Write-Host "   fly deploy" -ForegroundColor White
    }
    "4" {
        Write-Host ""
        Write-Host "📚 All Deployment Options:" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "🚂 Railway (Easiest):" -ForegroundColor Yellow
        Write-Host "   npm i -g @railway/cli" -ForegroundColor White
        Write-Host "   railway login" -ForegroundColor White
        Write-Host "   railway up" -ForegroundColor White
        Write-Host ""
        Write-Host "🎨 Render (GitHub Integration):" -ForegroundColor Yellow
        Write-Host "   Connect GitHub repo at render.com" -ForegroundColor White
        Write-Host "   Auto-deploys on push" -ForegroundColor White
        Write-Host ""
        Write-Host "✈️  Fly.io (Global Edge):" -ForegroundColor Yellow
        Write-Host "   Install Fly CLI, then: fly launch" -ForegroundColor White
        Write-Host ""
        Write-Host "📦 Direct Bun (Current - Local):" -ForegroundColor Yellow
        Write-Host "   bun run start:dashboard" -ForegroundColor White
        Write-Host ""
        Write-Host "📖 See QUICK_DEPLOY.md for detailed instructions" -ForegroundColor Cyan
    }
    "5" {
        Write-Host "🧪 Testing local deployment..." -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Starting server..." -ForegroundColor Yellow
        Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
        Write-Host ""
        bun run start:dashboard
    }
    default {
        Write-Host "❌ Invalid choice" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "✅ Done!" -ForegroundColor Green

