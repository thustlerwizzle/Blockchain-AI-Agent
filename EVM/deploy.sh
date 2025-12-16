#!/bin/bash

# 🚀 Blockchain AI Agent - Deployment Script
# This script helps deploy the application to various platforms

set -e

echo "🚀 Blockchain AI Agent Deployment Helper"
echo "========================================"
echo ""

# Check if Bun is installed
if ! command -v bun &> /dev/null; then
    echo "❌ Bun is not installed. Please install Bun first:"
    echo "   curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

echo "✅ Bun is installed: $(bun --version)"
echo ""

# Function to deploy to Railway
deploy_railway() {
    echo "🚂 Deploying to Railway..."
    
    if ! command -v railway &> /dev/null; then
        echo "📦 Installing Railway CLI..."
        npm i -g @railway/cli
    fi
    
    echo "🔐 Please login to Railway:"
    railway login
    
    echo "🚀 Initializing Railway project..."
    railway init
    
    echo "⚙️  Setting up environment variables..."
    echo "   (You can skip API keys since we removed those dependencies)"
    
    echo "🚀 Deploying..."
    railway up
    
    echo "✅ Deployment complete! Check your Railway dashboard for the URL."
}

# Function to deploy to Render
deploy_render() {
    echo "🎨 Render Deployment Instructions:"
    echo ""
    echo "1. Go to https://render.com and create a new Web Service"
    echo "2. Connect your GitHub repository"
    echo "3. Configure:"
    echo "   - Build Command: bun install"
    echo "   - Start Command: bun run start:dashboard"
    echo "   - Environment: Node"
    echo "   - Root Directory: EVM"
    echo "4. Add environment variables (optional):"
    echo "   - PORT=3001"
    echo "5. Deploy!"
    echo ""
    echo "📝 Note: Render will auto-deploy on git push if connected to GitHub"
}

# Function to deploy to Fly.io
deploy_fly() {
    echo "✈️  Deploying to Fly.io..."
    
    if ! command -v fly &> /dev/null; then
        echo "📦 Installing Fly CLI..."
        curl -L https://fly.io/install.sh | sh
    fi
    
    echo "🔐 Please login to Fly.io:"
    fly auth login
    
    echo "🚀 Launching app..."
    fly launch
    
    echo "✅ Deployment complete!"
}

# Function to prepare for production
prepare_production() {
    echo "📦 Preparing for production deployment..."
    
    echo "📝 Installing dependencies..."
    bun install --production=false
    
    echo "✅ Production build ready!"
    echo ""
    echo "🚀 You can now:"
    echo "   1. Run locally: bun run start:dashboard"
    echo "   2. Deploy to cloud using one of the options above"
}

# Main menu
echo "Select deployment option:"
echo "1) Railway (Recommended - Easy)"
echo "2) Render (GitHub integration)"
echo "3) Fly.io (Global edge deployment)"
echo "4) Prepare for production (local)"
echo "5) Show all deployment options"
echo ""
read -p "Enter choice [1-5]: " choice

case $choice in
    1)
        deploy_railway
        ;;
    2)
        deploy_render
        ;;
    3)
        deploy_fly
        ;;
    4)
        prepare_production
        ;;
    5)
        echo ""
        echo "📚 All Deployment Options:"
        echo ""
        echo "🐳 Docker (if installed):"
        echo "   docker-compose up -d"
        echo ""
        echo "🚂 Railway:"
        echo "   npm i -g @railway/cli && railway login && railway up"
        echo ""
        echo "🎨 Render:"
        echo "   Connect GitHub repo at render.com"
        echo ""
        echo "✈️  Fly.io:"
        echo "   curl -L https://fly.io/install.sh | sh && fly launch"
        echo ""
        echo "☁️  Vercel:"
        echo "   npm i -g vercel && vercel --prod"
        echo ""
        echo "📦 Direct Bun (current):"
        echo "   bun run start:dashboard"
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

