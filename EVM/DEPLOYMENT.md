# 🚀 Deployment Guide

This guide covers deploying the Blockchain AI Agent Dashboard to various platforms.

## 📋 Prerequisites

- Docker and Docker Compose (for containerized deployment)
- OR Bun runtime (for direct deployment)
- Environment variables configured (see `.env.example`)

## 🐳 Docker Deployment

### Quick Start with Docker Compose

1. **Ensure your `.env` file is configured:**
   ```bash
   # Required environment variables
   GOOGLE_AI_API_KEY=your_google_ai_key
   OPENAI_API_KEY=your_openai_key  # Optional fallback
   ETHERSCAN_API_KEY=your_etherscan_key  # Optional
   ```

2. **Build and run:**
   ```bash
   docker-compose up -d
   ```

3. **View logs:**
   ```bash
   docker-compose logs -f
   ```

4. **Access the dashboard:**
   Open http://localhost:3001/regulator in your browser

### Docker Build Only

```bash
# Build the image
docker build -t blockchain-ai-dashboard .

# Run the container
docker run -d \
  --name blockchain-ai-dashboard \
  -p 3001:3001 \
  --env-file .env \
  blockchain-ai-dashboard
```

## ☁️ Cloud Platform Deployment

### Railway

1. **Install Railway CLI:**
   ```bash
   npm i -g @railway/cli
   ```

2. **Login and initialize:**
   ```bash
   railway login
   railway init
   ```

3. **Set environment variables:**
   ```bash
   railway variables set GOOGLE_AI_API_KEY=your_key
   railway variables set OPENAI_API_KEY=your_key
   railway variables set ETHERSCAN_API_KEY=your_key
   ```

4. **Deploy:**
   ```bash
   railway up
   ```

### Render

1. **Create a new Web Service** in Render dashboard
2. **Connect your GitHub repository**
3. **Configure:**
   - **Build Command:** `bun install`
   - **Start Command:** `bun run start:dashboard`
   - **Environment:** `Docker`
   - **Dockerfile Path:** `EVM/Dockerfile`
   - **Docker Context:** `EVM`

4. **Add environment variables:**
   - `GOOGLE_AI_API_KEY`
   - `OPENAI_API_KEY` (optional)
   - `ETHERSCAN_API_KEY` (optional)
   - `PORT=3001`

### Fly.io

1. **Install Fly CLI:**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Create `fly.toml` in EVM directory:**
   ```toml
   app = "blockchain-ai-dashboard"
   primary_region = "iad"

   [build]
     dockerfile = "Dockerfile"

   [[services]]
     internal_port = 3001
     protocol = "tcp"

     [[services.ports]]
       handlers = ["http"]
       port = 80

     [[services.ports]]
       handlers = ["tls", "http"]
       port = 443
   ```

3. **Deploy:**
   ```bash
   fly launch
   fly secrets set GOOGLE_AI_API_KEY=your_key
   fly deploy
   ```

### Vercel

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Create `vercel.json` in EVM directory:**
   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "dashboard/server.ts",
         "use": "@vercel/node"
       }
     ],
     "routes": [
       {
         "src": "/api/(.*)",
         "dest": "dashboard/server.ts"
       },
       {
         "src": "/(.*)",
         "dest": "dashboard/server.ts"
       }
     ],
     "env": {
       "NODE_ENV": "production"
     }
   }
   ```

3. **Deploy:**
   ```bash
   vercel --prod
   ```

### AWS (ECS/Fargate)

1. **Build and push to ECR:**
   ```bash
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
   docker build -t blockchain-ai-dashboard .
   docker tag blockchain-ai-dashboard:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/blockchain-ai-dashboard:latest
   docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/blockchain-ai-dashboard:latest
   ```

2. **Create ECS task definition** with the image
3. **Configure environment variables** in task definition
4. **Create service** and deploy

## 🔧 Environment Variables

Required:
- `GOOGLE_AI_API_KEY` - Google Gemini AI API key for financial analysis

Optional:
- `OPENAI_API_KEY` - OpenAI API key (fallback if Google AI not available)
- `ETHERSCAN_API_KEY` - Etherscan API key for blockchain data
- `PORT` - Server port (default: 3001)

## 📊 Health Check

The dashboard includes a health check endpoint:
```bash
curl http://localhost:3001/api/test
```

## 🔍 Troubleshooting

### Port Already in Use
```bash
# Change port in docker-compose.yml or set PORT environment variable
PORT=3002 docker-compose up
```

### Environment Variables Not Loading
- Ensure `.env` file exists in the `EVM` directory
- For Docker, use `env_file` in docker-compose.yml or pass via `-e` flags

### Build Failures
- Ensure `bun.lockb` is committed
- Clear Docker cache: `docker system prune -a`

## 🚀 Production Considerations

1. **Use HTTPS:** Configure reverse proxy (nginx, Caddy) or use platform SSL
2. **Rate Limiting:** Add rate limiting middleware for API endpoints
3. **Monitoring:** Set up logging and monitoring (e.g., Datadog, Sentry)
4. **Backup:** Ensure environment variables are backed up securely
5. **Scaling:** Use load balancer for multiple instances

## 📝 Notes

- The dashboard runs on port 3001 by default
- All API endpoints are prefixed with `/api`
- Static files are served from the `dashboard` directory
- The regulator dashboard is available at `/regulator`

