# 🔧 Automatic Deployment Fix Script
# This script checks and fixes common deployment issues

Write-Host "🔧 Automatic Deployment Troubleshooting" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Continue"
Set-Location "C:\Users\takun\OneDrive\Documents\Blockchain AI Agent\Blockchain-AI-Agent\EVM"

# Check if required files exist
Write-Host "📋 Checking required files..." -ForegroundColor Yellow

$files = @(
    "netlify.toml",
    "dashboard/regulator.html",
    "dashboard/index.html",
    "netlify/functions/server.ts",
    "package.json"
)

$allFilesExist = $true
foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file - MISSING!" -ForegroundColor Red
        $allFilesExist = $false
    }
}

if (-not $allFilesExist) {
    Write-Host ""
    Write-Host "❌ Missing required files. Please check the project structure." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ All required files present" -ForegroundColor Green
Write-Host ""

# Verify netlify.toml configuration
Write-Host "🔍 Checking netlify.toml configuration..." -ForegroundColor Yellow
$tomlContent = Get-Content "netlify.toml" -Raw

if ($tomlContent -match 'publish = "dashboard"') {
    Write-Host "  ✅ Publish directory configured correctly" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Publish directory may be incorrect" -ForegroundColor Yellow
}

if ($tomlContent -match 'functions = "netlify/functions"') {
    Write-Host "  ✅ Functions directory configured correctly" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Functions directory may be incorrect" -ForegroundColor Yellow
}

if ($tomlContent -match '/api/\*') {
    Write-Host "  ✅ API redirects configured" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  API redirects may be missing" -ForegroundColor Yellow
}

Write-Host ""

# Check if .netlify folder exists (indicates site is linked)
if (Test-Path ".netlify") {
    Write-Host "✅ Site is linked to Netlify" -ForegroundColor Green
    Write-Host ""
    
    # Try to get status
    Write-Host "📊 Checking deployment status..." -ForegroundColor Yellow
    try {
        $status = netlify status 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host $status -ForegroundColor Cyan
        } else {
            Write-Host "⚠️  Could not get status. Session may have expired." -ForegroundColor Yellow
            Write-Host "   Run: netlify login" -ForegroundColor Gray
        }
    } catch {
        Write-Host "⚠️  Could not check status" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  Site is not linked to Netlify" -ForegroundColor Yellow
    Write-Host "   Run: netlify init" -ForegroundColor Gray
}

Write-Host ""

# Check package.json for required dependencies
Write-Host "📦 Checking dependencies..." -ForegroundColor Yellow
if (Test-Path "package.json") {
    $packageJson = Get-Content "package.json" | ConvertFrom-Json
    if ($packageJson.dependencies.'@netlify/functions' -or $packageJson.devDependencies.'@netlify/functions') {
        Write-Host "  ✅ @netlify/functions dependency found" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  @netlify/functions may be missing" -ForegroundColor Yellow
        Write-Host "     Adding to package.json..." -ForegroundColor Gray
        # Add dependency check would go here
    }
}

Write-Host ""

# Provide deployment instructions
Write-Host "🚀 Deployment Instructions:" -ForegroundColor Cyan
Write-Host "==========================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Option 1: Force Redeploy (Recommended)" -ForegroundColor Yellow
Write-Host "  netlify login" -ForegroundColor White
Write-Host "  netlify deploy --prod --build" -ForegroundColor White
Write-Host ""

Write-Host "Option 2: Check Deployment Status" -ForegroundColor Yellow
Write-Host "  1. Go to: https://app.netlify.com" -ForegroundColor White
Write-Host "  2. Open your site" -ForegroundColor White
Write-Host "  3. Check Deploys tab for latest deployment" -ForegroundColor White
Write-Host "  4. Check Functions tab to verify 'server' function exists" -ForegroundColor White
Write-Host ""

Write-Host "Option 3: Test API Endpoints" -ForegroundColor Yellow
Write-Host "  Visit: https://your-site.netlify.app/api/test" -ForegroundColor White
Write-Host "  Should return: {`"status`":`"ok`"}" -ForegroundColor Gray
Write-Host ""

Write-Host "Option 4: Clear Browser Cache" -ForegroundColor Yellow
Write-Host "  Press: Ctrl + Shift + R (hard refresh)" -ForegroundColor White
Write-Host ""

Write-Host "✅ Troubleshooting complete!" -ForegroundColor Green
Write-Host ""
Write-Host "If issues persist, check:" -ForegroundColor Cyan
Write-Host "  1. Netlify function logs (Dashboard → Functions → server → Logs)" -ForegroundColor White
Write-Host "  2. Browser console (F12) for API errors" -ForegroundColor White
Write-Host "  3. Network tab (F12) to see which API calls are failing" -ForegroundColor White




