# Commons Hub Brussels

A community space website showcasing events, members, and collaborative activities at the Commons Hub Brussels.

🌐 **Live Site:** https://commonshub.brussels
🧪 **Test Version:** https://v0.commonshub.brussels

## Overview

This is a mostly statically generated Next.js website that fetches data from various sources (Discord, Stripe, blockchain, calendars) and displays community activity, financial transparency, and upcoming events.

## Quick Start

### Using Quick Start Script (Recommended)

```bash
# Make script executable (first time only)
chmod +x scripts/quick-start.sh

# Run the quick start script
./scripts/quick-start.sh
```

The script will guide you through:
1. Setting up environment variables
2. Building the Docker image
3. Fetching data
4. Starting the server

### Manual Setup

```bash
# 1. Copy environment variables
cp .env.example .env
# Edit .env and add your API keys

# 2. Build and start the container
docker-compose up -d --build

# 3. Open the website (you'll see an empty data state page)
open http://localhost:3000

# 4. Fetch data (follow instructions from the empty data page)
docker exec commonshub npm run fetch-recent

# 5. Refresh the website - data is now loaded!
```

**Note:** The website will display a helpful empty data state page when first accessed. This page provides instructions for fetching data.

## Development

### Local Development without Docker

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Fetch data (automatically generates aggregated data)
npm run fetch-recent

# Start development server
npm run dev
```

## Data Fetching

The website requires data to be fetched before it can display content. The build process is optimized to only fetch recent data by default:

- **`npm run fetch-recent`** - Fetches current and previous month only (fast, ~2-5 minutes)
- **`npm run fetch-history`** - Fetches all historical data (slow, ~15-60 minutes first run)

### Data Sources

Data is fetched from:
- **Discord** - Community messages and photos
- **Stripe** - Payment transactions
- **Blockchain** - Token transactions (via Etherscan)
- **Luma** - Event calendar
- **ICS Calendars** - Additional calendar integrations

All fetched data is cached in the `./data` directory to avoid redundant API calls.

## Build

Build the production application:

```bash
npm run build
```

**Note:** The build process only compiles the Next.js application. It does **not** fetch data. When using Docker with a mounted data volume, data must be fetched after the container starts.

### Fetching Data

After building and starting the application:

```bash
# Fetch recent data (fast)
npm run fetch-recent

# Or fetch all historical data (slow)
npm run fetch-history
```

If the data directory is empty, the website will display a helpful empty data state page with fetching instructions.

## Status

- **`/status`** - HTML page showing application status, git info, and uptime
- **`/status.json`** - JSON API for programmatic access

## Documentation

- **[Deployment Guide](docs/deployment.md)** - Complete Docker deployment instructions
- **[Webhook Setup](docs/WEBHOOK_SETUP.md)** - Automated deployment via GitHub webhooks
- **[Fetching Transactions](docs/fetch-transactions.md)** - Guide to fetching and managing transaction data
- **[CLAUDE.md](CLAUDE.md)** - Technical architecture and component documentation

## Project Structure

```
├── src/
│   ├── app/              # Next.js app router pages
│   ├── components/       # React components
│   ├── lib/              # Utility libraries
│   └── settings/         # Configuration files
├── scripts/              # Data fetching and processing scripts
├── data/                 # Cached data directory (gitignored)
├── docs/                 # Documentation
└── public/               # Static assets
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production (fetches recent data and generates files) |
| `npm run fetch-recent` | Fetch current and previous month data + auto-generate files |
| `npm run fetch-history` | Fetch all historical data + auto-generate files |
| `npm run fetch-transactions` | Fetch transaction data only (supports `--month`, `--force` flags) |
| `npm run generate-data` | Manually regenerate all aggregated data files |
| `npm run restart` | Restart the systemd service |
| `npm run logs` | View application logs (last 100 lines + follow) |
| `npm run status` | Check application status, git info, and uptime |

## Environment Variables

See `.env.example` for required environment variables. Key variables include:
- Discord bot token and OAuth credentials
- Stripe API key
- Etherscan API key
- Luma API key
- NextAuth secret

## Contributing

Contributions are welcome! Please ensure:
- Code follows existing patterns
- Tests pass
- No sensitive data is committed

## License

[Add license information]
