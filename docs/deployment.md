# Deployment Guide

This project deploys as two containers that share one data directory:

- `web` serves the Next.js site
- `chbcli` fetches data and writes into `DATA_DIR`

The split is intentional: only `chbcli` needs the external API secrets, while `web` only needs read access to the generated data.

## Files

- `Dockerfile.web` builds the website image
- `Dockerfile.chb` builds the CLI worker image
- `docker-compose.yml.example` is the local Docker setup for both services
- `docker-compose.coolify.yml` is the Coolify setup for both services

## Local Docker

### 1. Prepare Environment Variables

```bash
cp .env.example .env
```

Set the values you need in `.env`.

For local Docker, both services read values from the same `.env` file, but only `chbcli` consumes the fetch secrets.

### 2. Start Both Services

```bash
docker compose -f docker-compose.yml.example up -d --build
```

This starts:

- `web` on `http://localhost:3000`
- `chbcli` as a private worker container

### 3. Populate the Data Directory

```bash
docker compose -f docker-compose.yml.example run --rm chbcli chb sync
```

For a full backfill instead:

```bash
docker compose -f docker-compose.yml.example run --rm chbcli chb sync --history
```

### 4. Open the Website

```bash
open http://localhost:3000
```

If `/data` is empty, the site will show the empty-data state until the sync finishes.

### Local Persistence

The local compose file bind-mounts `./data` into both containers:

- `web` mounts it read-only
- `chbcli` mounts it read-write

That means the generated files stay on your machine between restarts and rebuilds.

### Local Verification

```bash
docker compose -f docker-compose.yml.example logs -f web
docker compose -f docker-compose.yml.example logs -f chbcli
docker compose -f docker-compose.yml.example exec web sh
docker compose -f docker-compose.yml.example run --rm chbcli chb version
ls -la data/
```

### Local Troubleshooting

If `chbcli` cannot write into `./data`, fix the host directory permissions:

```bash
mkdir -p data
sudo chown -R 1001:1001 data
```

If you do not want to change ownership, a more permissive local-only fallback is:

```bash
chmod -R ugo+rwX data
```

## Coolify

Coolify should use one Docker Compose resource, not two separate projects.

### Why

- `web` and `chbcli` need shared storage
- only `web` needs a public domain
- only `chbcli` needs the fetch secrets
- service-level environment variables are enough to keep those secrets off the website container

### 1. Create the Resource

In Coolify:

1. Create one application with the `Docker Compose` build pack
2. Point it at this repository
3. Use `docker-compose.coolify.yml` as the compose file
4. Expose only the `web` service on your domain

### 2. Configure Environment Variables

Set these on the `web` service:

```bash
NODE_ENV=production
DATA_DIR=/data
AUTH_DISCORD_ID=...
AUTH_DISCORD_SECRET=...
NEXTAUTH_URL=https://your-domain.example
NEXTAUTH_SECRET=...
RESEND_API_KEY=...
WEBHOOK_SECRET=...
```

Set these on the `chbcli` service only:

```bash
DATA_DIR=/data
DISCORD_BOT_TOKEN=...
LUMA_API_KEY=...
STRIPE_SECRET_KEY=...
ETHERSCAN_API_KEY=...
MONERIUM_CLIENT_ID=...
MONERIUM_CLIENT_SECRET=...
```

### 3. Deploy

Deploy the Compose application from Coolify.

After the first deploy, run this in the `chbcli` service terminal:

```bash
chb sync
```

For a full historical backfill:

```bash
chb sync --history
```

### 4. Scheduled Sync

Create the scheduled task on `chbcli`, not on `web`.

- Command: `chb sync`
- Example hourly schedule: `0 * * * *`

### Coolify Persistence

`docker-compose.coolify.yml` uses the named volume `commonshub-data`.

That volume persists across normal redeployments and rebuilds. It is only removed if you explicitly delete the volume or delete the resource with its storage.

### Coolify Verification

```bash
docker compose -f docker-compose.coolify.yml logs -f web
docker compose -f docker-compose.coolify.yml logs -f chbcli
docker volume inspect commonshub-data
```

For a more detailed Coolify walkthrough, see [coolify.md](./coolify.md).

## Manual Docker Builds

Build the web image:

```bash
docker build -t commonshub-brussels-web:latest -f Dockerfile.web .
```

Build the CLI image:

```bash
docker build -t commonshub-brussels-chb:latest -f Dockerfile.chb .
```

`Dockerfile.chb` prints the resolved `chb` release and installed binary version during build, so the downloaded CLI version is visible in the logs.

## Quick Reference

| Task | Command |
|------|---------|
| Start local stack | `docker compose -f docker-compose.yml.example up -d --build` |
| Stop local stack | `docker compose -f docker-compose.yml.example down` |
| Sync latest data locally | `docker compose -f docker-compose.yml.example run --rm chbcli chb sync` |
| Sync full history locally | `docker compose -f docker-compose.yml.example run --rm chbcli chb sync --history` |
| View local web logs | `docker compose -f docker-compose.yml.example logs -f web` |
| View local worker logs | `docker compose -f docker-compose.yml.example logs -f chbcli` |
| Build web image manually | `docker build -t commonshub-brussels-web:latest -f Dockerfile.web .` |
| Build CLI image manually | `docker build -t commonshub-brussels-chb:latest -f Dockerfile.chb .` |
