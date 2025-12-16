# 🚀 Netlify Deployment Script for Windows
# Quick deployment to Netlify

Write-Host "🚀 Netlify Deployment Helper" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan
Write-Host ""

# Check if Netlify CLI is installed
try {
    $netlifyVersion = netlify --version
    Write-Host "✅ Netlify CLI is installed: $netlifyVersion" -ForegroundColor Green
} catch {
    Write-Host "📦 Installing Netlify CLI..." -ForegroundColor Yellow
    npm install -g netlify-cli
    Write-Host "✅ Netlify CLI installed!" -ForegroundColor Green
}

Write-Host ""
Write-Host "Select deployment option:" -ForegroundColor Yellow
Write-Host "1) Deploy to production (netlify deploy --prod)" -ForegroundColor White
Write-Host "2) Deploy preview (netlify deploy)" -ForegroundColor White
Write-Host "3) Initialize new site (netlify init)" -ForegroundColor White
Write-Host "4) Show GitHub integration instructions" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Enter choice [1-4]"

switch ($choice) {
    "1" {
        Write-Host "🚀 Deploying to production..." -ForegroundColor Cyan
        netlify deploy --prod
        Write-Host ""
        Write-Host "✅ Deployment complete!" -ForegroundColor Green
        Write-Host "Check your Netlify dashboard for the URL." -ForegroundColor Yellow
    }
    "2" {
        Write-Host "🧪 Creating preview deployment..." -ForegroundColor Cyan
        netlify deploy
        Write-Host ""
        Write-Host "✅ Preview deployment complete!" -ForegroundColor Green
    }
    "3" {
        Write-Host "🔧 Initializing Netlify site..." -ForegroundColor Cyan
        Write-Host "You'll be prompted to:" -ForegroundColor Yellow
        Write-Host "  - Login to Netlify (opens browser)" -ForegroundColor Gray
        Write-Host "  - Create or link a site" -ForegroundColor Gray
        Write-Host "  - Configure build settings" -ForegroundColor Gray
        Write-Host ""
        netlify init
    }
    "4" {
        Write-Host ""
        Write-Host "📚 GitHub Integration Instructions:" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "1. Push your code to GitHub:" -ForegroundColor White
        Write-Host "   git add ." -ForegroundColor Gray
        Write-Host "   git commit -m 'Ready for Netlify deployment'" -ForegroundColor Gray
        Write-Host "   git push" -ForegroundColor Gray
        Write-Host ""
        Write-Host "2. Go to: https://app.netlify.com" -ForegroundColor White
        Write-Host ""
        Write-Host "3. Click: 'Add new site' → 'Import an existing project'" -ForegroundColor White
        Write-Host ""
        Write-Host "4. Connect your GitHub repository" -ForegroundColor White
        Write-Host ""
        Write-Host "5. Configure:" -ForegroundColor White
        Write-Host "   - Base directory: EVM" -ForegroundColor Gray
        Write-Host "   - Build command: npm install" -ForegroundColor Gray
        Write-Host "   - Publish directory: dashboard" -ForegroundColor Gray
        Write-Host ""
        Write-Host "6. Click 'Deploy site'!" -ForegroundColor White
        Write-Host ""
        Write-Host "✅ Netlify will auto-deploy on every git push!" -ForegroundColor Green
    }
    default {
        Write-Host "❌ Invalid choice" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "📖 For more details, see DEPLOY_NETLIFY.md" -ForegroundColor Cyan

