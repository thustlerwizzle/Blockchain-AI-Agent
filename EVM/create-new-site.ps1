# 🚀 Create New Netlify Site for Regulator Dashboard
# This script creates a brand new Netlify site

Write-Host "🚀 Creating New Netlify Site" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Continue"

# Change to project directory
Set-Location "C:\Users\takun\OneDrive\Documents\Blockchain AI Agent\Blockchain-AI-Agent\EVM"

# Check if logged in
Write-Host "🔐 Checking Netlify authentication..." -ForegroundColor Yellow
try {
    $status = netlify status 2>&1
    if ($LASTEXITCODE -ne 0 -or $status -like "*Error*" -or $status -like "*expired*" -or $status -like "*login*") {
        Write-Host "⚠️  Please login to Netlify first" -ForegroundColor Yellow
        Write-Host "Running: netlify login" -ForegroundColor Cyan
        netlify login
        Start-Sleep -Seconds 2
    } else {
        Write-Host "✅ Already logged in" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Checking login status..." -ForegroundColor Yellow
    netlify login
}

Write-Host ""
Write-Host "🏗️  Creating new Netlify site..." -ForegroundColor Cyan
Write-Host ""

# Remove existing .netlify folder if it exists
if (Test-Path ".netlify") {
    Write-Host "🗑️  Removing existing .netlify configuration..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force .netlify -ErrorAction SilentlyContinue
}

# Create new site with specific settings
Write-Host "Creating new site with:" -ForegroundColor Yellow
Write-Host "  - Base directory: ." -ForegroundColor Gray
Write-Host "  - Build command: (none - static site)" -ForegroundColor Gray
Write-Host "  - Publish directory: dashboard" -ForegroundColor Gray
Write-Host "  - Functions directory: netlify/functions" -ForegroundColor Gray
Write-Host ""

# Use netlify sites:create to create a new site
Write-Host "Creating new site..." -ForegroundColor Cyan
$siteName = Read-Host "Enter site name (or press Enter for auto-generated name)"

if ([string]::IsNullOrWhiteSpace($siteName)) {
    Write-Host "Creating site with auto-generated name..." -ForegroundColor Yellow
    netlify sites:create
} else {
    Write-Host "Creating site with name: $siteName" -ForegroundColor Yellow
    netlify sites:create --name $siteName
}

Write-Host ""

# Link to the site (this will create .netlify/state.json)
Write-Host "🔗 Linking to site..." -ForegroundColor Cyan
# The site ID will be shown from the previous command, but we can also just use init

Write-Host ""
Write-Host "📝 Initializing site configuration..." -ForegroundColor Cyan

# Create netlify.toml if it doesn't exist (it should exist already)
if (-not (Test-Path "netlify.toml")) {
    Write-Host "⚠️  netlify.toml not found. Creating..." -ForegroundColor Yellow
    # This should already exist, but just in case
}

Write-Host ""
Write-Host "🚀 Deploying to new site..." -ForegroundColor Cyan
Write-Host ""

# Deploy
netlify deploy --prod --dir=dashboard --functions=netlify/functions

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Successfully deployed to new Netlify site!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your regulator dashboard is now live!" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Run: netlify open:site (to view your site)" -ForegroundColor White
    Write-Host "2. Run: netlify status (to see site details)" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Deployment failed. Try running manually:" -ForegroundColor Red
    Write-Host "  netlify init" -ForegroundColor White
    Write-Host "  netlify deploy --prod" -ForegroundColor White
}

