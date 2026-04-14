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

# 2. Build and start the website container
docker compose -f docker-compose.yml.example up -d --build

# 3. Open the website (you'll see an empty data state page)
open http://localhost:3000

# 4. Populate the shared data directory from the dedicated CHB container
docker compose -f docker-compose.chb.yml.example run --rm chb chb sync

# 5. Refresh the website - data is now loaded!
```

**Note:** The website and CHB worker now run as separate containers and share the same `./data` mount. This keeps fetch secrets scoped to the CHB service instead of the web app container.

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

The website reads pre-generated files from `./data`. Populate that directory with the standalone `chb` CLI, ideally from the separate worker container defined in `docker-compose.chb.yml.example`.

- **`chb sync`** - Fetches the latest data and regenerates derived files
- **`chb sync --history`** - Backfills historical data and regenerates derived files

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
# Fetch the latest data from the dedicated CHB service
docker compose -f docker-compose.chb.yml.example run --rm chb chb sync

# Or fetch full history
docker compose -f docker-compose.chb.yml.example run --rm chb chb sync --history
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

## Scripts and Commands

| Command | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build the production app |
| `chb sync` | Fetch latest data + auto-generate derived files |
| `chb sync --history` | Fetch full history + auto-generate derived files |
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
