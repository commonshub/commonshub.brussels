# Deployment Guide

This guide covers deploying the Commons Hub Brussels website using Docker, including data fetching, server setup, and maintenance tasks.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Building the Docker Image](#building-the-docker-image)
3. [Running with Docker](#running-with-docker)
4. [Fetching Data](#fetching-data)
5. [Accessing the Website](#accessing-the-website)
6. [Production Deployment](#production-deployment)
7. [Maintenance Tasks](#maintenance-tasks)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

- Docker installed (version 20.10 or higher)
- Docker Compose (optional, but recommended)
- Environment variables configured (see `.env.example`)
- At least 2GB of free disk space for data directory

### Required Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# Discord
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret

# Luma Calendar
LUMA_API_KEY=your_luma_api_key

# Payment Providers
STRIPE_SECRET_KEY=your_stripe_secret_key

# Blockchain
ETHERSCAN_API_KEY=your_etherscan_api_key

# Banking (optional)
MONERIUM_CLIENT_ID=your_monerium_client_id
MONERIUM_CLIENT_SECRET=your_monerium_client_secret

# Email
RESEND_API_KEY=your_resend_api_key

# Next Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_random_secret_here

# Data directory
DATA_DIR=/app/data
```

## Building the Docker Image

### Basic Build

Build the Docker image:

```bash
docker build \
  --build-arg DISCORD_BOT_TOKEN=$DISCORD_BOT_TOKEN \
  --build-arg LUMA_API_KEY=$LUMA_API_KEY \
  --build-arg STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY \
  --build-arg ETHERSCAN_API_KEY=$ETHERSCAN_API_KEY \
  --build-arg MONERIUM_CLIENT_ID=$MONERIUM_CLIENT_ID \
  --build-arg MONERIUM_CLIENT_SECRET=$MONERIUM_CLIENT_SECRET \
  --build-arg RESEND_API_KEY=$RESEND_API_KEY \
  -t commonshub-brussels:latest \
  .
```

**Note:** The build process only compiles the Next.js application. It does **not** fetch data. Data must be fetched after the container starts with the mounted data volume.

### Build from .env File

For convenience, load environment variables from `.env`:

```bash
# Load environment variables
source .env

# Build image
docker build \
  --build-arg DISCORD_BOT_TOKEN \
  --build-arg LUMA_API_KEY \
  --build-arg STRIPE_SECRET_KEY \
  --build-arg ETHERSCAN_API_KEY \
  --build-arg MONERIUM_CLIENT_ID \
  --build-arg MONERIUM_CLIENT_SECRET \
  --build-arg RESEND_API_KEY \
  -t commonshub-brussels:latest \
  .
```

### Build with Docker Compose

Create a `docker-compose.yml` file (see [Production Deployment](#production-deployment) section) and run:

```bash
docker-compose build
```

## Running with Docker

### Run the Container

Run the container with a mounted data directory:

```bash
docker run -d \
  --name commonshub \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  --env-file .env \
  commonshub-brussels:latest
```

**Important:** The `-v $(pwd)/data:/app/data` flag mounts your local `data` directory to the container, persisting fetched data across container restarts.

### Run with Docker Compose

```bash
docker-compose up -d
```

### Verify the Container is Running

```bash
docker ps | grep commonshub
```

### View Container Logs

```bash
docker logs -f commonshub
```

## Fetching Data

**Important:** The website requires data to be fetched before it can display content. When you first access the website with an empty data directory, you'll see a helpful error page with instructions on how to fetch data.

### First Time Setup

After starting the container for the first time, you **must** fetch data:

1. The website will show an empty data state page with instructions
2. Run the fetch command (see below)
3. Refresh the website - it will now display with data

You can fetch recent data (fast) or all historical data.

### Fetch Recent Data (Recommended for Quick Start)

Fetches current and previous month data, then automatically generates all aggregated files:

```bash
# One command - fetches data and generates all views
docker exec -it commonshub npm run fetch-recent
```

**Duration:** 2-5 minutes depending on data volume

**What it does:**
1. Fetches transactions (Stripe, blockchain)
2. Fetches Discord messages and images
3. Fetches token balances
4. Fetches calendar events
5. Fetches user data
6. Automatically generates all aggregated data files (images, contributors, transactions, events)

**Smart Caching:** The scripts automatically skip months that already have cached data and generated files, making subsequent runs much faster.

### Fetch All Historical Data

Fetches all available historical data and generates aggregated files:

```bash
# One command - fetches all history and generates views
docker exec -it commonshub npm run fetch-history
```

**Duration:** 15-60 minutes on first run (subsequent runs are much faster as data is cached)

### Fetch Specific Date Range

```bash
# Fetch a specific month
docker exec -it commonshub npm run fetch-history -- --month=2025-01

# Fetch a date range
docker exec -it commonshub npm run fetch-history -- --start-month=2024-01 --end-month=2024-12
```

### Manually Generate Data (Usually Not Needed)

Data generation happens automatically after fetching, but you can manually regenerate if needed:

```bash
# Regenerate all aggregated data files
docker exec -it commonshub npm run generate-data
```

This will generate:
- Discord images and contributors
- Financial transaction reports
- Calendar event listings

## Accessing the Website

### Local Development

After running the container:

1. Open your browser to http://localhost:3000
2. **First time:** You'll see an empty data state page with instructions
3. **After fetching data:** The website will display with all content

The empty data state page provides:
- Clear explanation of why data is needed
- Step-by-step commands to fetch data
- Information about what will be fetched
- Links to full documentation

### Check if Server is Running

```bash
curl http://localhost:3000
```

### Check Data Directory

Verify data has been fetched:

```bash
# Check if data directory has content
ls -la data/

# Check specific month
ls -la data/2025/01/
```

## Production Deployment

### Docker Compose Setup

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  web:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        DISCORD_BOT_TOKEN: ${DISCORD_BOT_TOKEN}
        LUMA_API_KEY: ${LUMA_API_KEY}
        STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY}
        ETHERSCAN_API_KEY: ${ETHERSCAN_API_KEY}
        MONERIUM_CLIENT_ID: ${MONERIUM_CLIENT_ID}
        MONERIUM_CLIENT_SECRET: ${MONERIUM_CLIENT_SECRET}
        RESEND_API_KEY: ${RESEND_API_KEY}
    image: commonshub-brussels:latest
    container_name: commonshub
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - DATA_DIR=/app/data
      - DISCORD_BOT_TOKEN=${DISCORD_BOT_TOKEN}
      - DISCORD_CLIENT_ID=${DISCORD_CLIENT_ID}
      - DISCORD_CLIENT_SECRET=${DISCORD_CLIENT_SECRET}
      - LUMA_API_KEY=${LUMA_API_KEY}
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
      - ETHERSCAN_API_KEY=${ETHERSCAN_API_KEY}
      - MONERIUM_CLIENT_ID=${MONERIUM_CLIENT_ID}
      - MONERIUM_CLIENT_SECRET=${MONERIUM_CLIENT_SECRET}
      - RESEND_API_KEY=${RESEND_API_KEY}
      - NEXTAUTH_URL=${NEXTAUTH_URL}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### Deployment Commands

```bash
# Build and start
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### Reverse Proxy Setup (Nginx)

Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name commonshub.brussels;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### SSL with Let's Encrypt

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d commonshub.brussels

# Auto-renewal is set up automatically
```

## Maintenance Tasks

### Daily/Hourly Data Updates

Set up a cron job to fetch recent data regularly:

```bash
# Edit crontab
crontab -e

# Add this line to fetch data every hour (automatically generates aggregated data)
0 * * * * docker exec commonshub npm run fetch-recent >> /var/log/commonshub-fetch.log 2>&1
```

### Backup Data Directory

```bash
# Create backup
tar -czf commonshub-data-backup-$(date +%Y%m%d).tar.gz data/

# Restore from backup
tar -xzf commonshub-data-backup-20250113.tar.gz
```

### Update Container

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose up -d --build

# Or with plain Docker
docker build -t commonshub-brussels:latest .
docker stop commonshub
docker rm commonshub
docker run -d --name commonshub -p 3000:3000 -v $(pwd)/data:/app/data --env-file .env commonshub-brussels:latest
```

### Clean Up Old Data

```bash
# Remove data older than 1 year (example)
find data/ -type d -name "2023*" -exec rm -rf {} +

# Clean up temporary image cache
rm -rf data/tmp/*
```

### Monitor Container Resources

```bash
# Check resource usage
docker stats commonshub

# Check disk usage
du -sh data/

# Check logs size
du -sh /var/lib/docker/containers/$(docker inspect -f '{{.Id}}' commonshub)/*.log
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs commonshub

# Check if port is already in use
lsof -i :3000

# Verify environment variables
docker exec commonshub env | grep DISCORD
```

### Data Not Showing

```bash
# Check if data was fetched
docker exec commonshub ls -la /app/data/2025/01/

# Re-fetch data
docker exec commonshub npm run fetch-recent

# Regenerate aggregated data
docker exec commonshub npm run generate-data
```

### API Rate Limiting

If you encounter rate limiting errors:

```bash
# For Discord: Wait 1-2 hours between large fetches
# For Stripe: Built-in rate limiting handled automatically
# For Etherscan: Free tier has limits, consider paid API key
```

### Permission Issues with Data Directory

```bash
# Fix ownership (host machine)
sudo chown -R 1001:1001 data/

# Or make it writable by all (less secure)
chmod -R 777 data/
```

### Out of Memory

```bash
# Increase Docker memory limit in Docker Desktop settings
# Or add memory limits to docker-compose.yml:

services:
  web:
    deploy:
      resources:
        limits:
          memory: 2G
```

### Build Fails

```bash
# Clear Docker cache
docker builder prune

# Rebuild without cache
docker build --no-cache -t commonshub-brussels:latest .
```

## Quick Reference

### Common Commands

| Task | Command |
|------|---------|
| Build image | `docker build -t commonshub-brussels:latest .` |
| Start container | `docker-compose up -d` |
| Stop container | `docker-compose down` |
| View logs | `docker logs -f commonshub` |
| Enter container | `docker exec -it commonshub sh` |
| Fetch recent data | `docker exec commonshub npm run fetch-recent` |
| Fetch all history | `docker exec commonshub npm run fetch-history` |
| Regenerate data | `docker exec commonshub npm run generate-data` |
| Restart container | `docker restart commonshub` |

### Data Directory Structure

```
data/
├── 2025/
│   ├── 01/
│   │   ├── discord/          # Discord messages and images
│   │   ├── finance/          # Financial transactions
│   │   ├── calendars/        # Calendar events
│   │   ├── events.json       # Generated events data
│   │   └── transactions.json # Generated transactions data
│   └── 02/
│       └── ...
├── latest/                   # Most recent data for fast loading
├── generated/                # Generated user profiles
└── tmp/                      # Temporary image cache
```

### URLs

- **Local development**: http://localhost:3000
- **Production**: https://commonshub.brussels
- **Health check**: http://localhost:3000/api/health (if implemented)

## Additional Resources

- [Project README](../README.md)
- [CLAUDE.md](../CLAUDE.md) - Technical documentation
- [Contributing Guide](../CONTRIBUTING.md) (if exists)
- [Docker Documentation](https://docs.docker.com/)
- [Next.js Deployment Docs](https://nextjs.org/docs/deployment)
