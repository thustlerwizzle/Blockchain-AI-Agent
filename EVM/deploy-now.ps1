# 🚀 Automatic Deployment Script for Netlify
# Run this script to deploy automatically

Write-Host "🚀 Netlify Automatic Deployment" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Continue"

# Check Netlify CLI
Write-Host "📦 Checking Netlify CLI..." -ForegroundColor Yellow
try {
    $netlifyVersion = netlify --version 2>&1
    Write-Host "✅ Netlify CLI found: $netlifyVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Netlify CLI not found. Installing..." -ForegroundColor Red
    npm install -g netlify-cli
}

Write-Host ""

# Check if logged in
Write-Host "🔐 Checking Netlify authentication..." -ForegroundColor Yellow
try {
    $status = netlify status 2>&1
    if ($LASTEXITCODE -ne 0 -or $status -like "*Error*" -or $status -like "*expired*" -or $status -like "*login*") {
        Write-Host "⚠️  Not logged in to Netlify" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Please login to Netlify:" -ForegroundColor Cyan
        Write-Host "1. Run: netlify login" -ForegroundColor White
        Write-Host "2. A browser window will open" -ForegroundColor White
        Write-Host "3. Authorize the CLI" -ForegroundColor White
        Write-Host ""
        Write-Host "After logging in, run this script again to deploy." -ForegroundColor Yellow
        Write-Host ""
        netlify login
        Write-Host ""
        Write-Host "✅ Login complete! Deploying now..." -ForegroundColor Green
    } else {
        Write-Host "✅ Already logged in to Netlify" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Could not check status. Attempting login..." -ForegroundColor Yellow
    netlify login
}

Write-Host ""

# Deploy
Write-Host "🚀 Deploying to Netlify..." -ForegroundColor Cyan
Write-Host ""

try {
    netlify deploy --prod --dir=dashboard --functions=netlify/functions
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Deployment successful!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Your site is now live!" -ForegroundColor Cyan
        Write-Host "Check the URL above or run: netlify open:site" -ForegroundColor Yellow
    } else {
        Write-Host ""
        Write-Host "❌ Deployment failed. Check the errors above." -ForegroundColor Red
        Write-Host ""
        Write-Host "Common fixes:" -ForegroundColor Yellow
        Write-Host "- Run: netlify login (if not logged in)" -ForegroundColor White
        Write-Host "- Check netlify.toml configuration" -ForegroundColor White
        Write-Host "- Verify all files are committed" -ForegroundColor White
    }
} catch {
    Write-Host ""
    Write-Host "❌ Error during deployment: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Try running manually:" -ForegroundColor Yellow
    Write-Host "  netlify deploy --prod" -ForegroundColor White
}

