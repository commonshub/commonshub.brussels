# Deploying with Coolify

This setup now uses two separate services:

- `commonshub-web`: the Next.js website that only reads from `/data`
- `commonshub-chb`: a worker container that holds the fetch secrets and runs `chb sync`

Both services must mount the same host directory to `/data`.

## Prerequisites

- A server with Coolify installed
- A domain pointing to the server
- The repository connected in Coolify
- API keys ready for the CHB worker

## Create the Project

1. Create a project and environment in Coolify.
2. Add the repository `https://github.com/commonshub/commonshub.brussels`.
3. Create two resources from that same repository.

## Service 1: Website

Configure the website resource like this:

- Name: `commonshub-web`
- Build Pack: `Dockerfile`
- Dockerfile Location: `Dockerfile`
- Port: `3000`

Set only the website runtime variables here:

```bash
NODE_ENV=production
DATA_DIR=/data
AUTH_DISCORD_ID=your-discord-oauth-client-id
AUTH_DISCORD_SECRET=your-discord-oauth-client-secret
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-secret-key-here
RESEND_API_KEY=your-resend-api-key
WEBHOOK_SECRET=your-webhook-secret
```

If you do not use email or the deploy webhook, you can leave `RESEND_API_KEY` and `WEBHOOK_SECRET` unset.

Add a persistent storage mount:

- Source Path: `/data/commonshub`
- Destination Path: `/data`

Add your public domain to this service and enable SSL.

## Service 2: CHB Worker

Configure a second resource for the CLI worker:

- Name: `commonshub-chb`
- Build Pack: `Dockerfile`
- Dockerfile Location: `Dockerfile.chb`
- No public domain

Set the data-fetching secrets on this service only:

```bash
DATA_DIR=/data
DISCORD_BOT_TOKEN=your-discord-bot-token
LUMA_API_KEY=your-luma-api-key
STRIPE_SECRET_KEY=your-stripe-secret-key
ETHERSCAN_API_KEY=your-etherscan-api-key
MONERIUM_CLIENT_ID=your-monerium-client-id
MONERIUM_CLIENT_SECRET=your-monerium-client-secret
```

Add the exact same persistent storage mount:

- Source Path: `/data/commonshub`
- Destination Path: `/data`

The worker image stays alive with `sleep infinity`, which lets Coolify scheduled tasks execute `chb` commands inside that container.

## First Deploy

1. Deploy `commonshub-web`.
2. Deploy `commonshub-chb`.
3. Open the site. If `/data` is empty you will see the empty-data state.

## Populate the Data Directory

Use the terminal of the `commonshub-chb` service and run:

```bash
chb sync
```

For a full backfill instead:

```bash
chb sync --history
```

After the sync finishes, refresh the website.

## Scheduled Task

Create the scheduled task on the `commonshub-chb` service, not on the website service.

- Name: `sync-data`
- Command: `chb sync`
- Frequency: `0 * * * *`

Common alternatives:

- Every 30 minutes: `*/30 * * * *`
- Every 6 hours: `0 */6 * * *`
- Daily at midnight: `0 0 * * *`

## Why Split the Services

- The website container no longer includes the `chb` binary.
- Fetcher secrets are scoped to the CHB worker instead of the public web app.
- Both services still work against the same shared `/data` volume.

## Verification

Check the website container:

```bash
docker logs -f <commonshub-web-container>
```

Check the worker container:

```bash
docker logs -f <commonshub-chb-container>
```

Check the shared data directory on the host:

```bash
ls -la /data/commonshub
```

## Backup

```bash
tar -czvf commonshub-backup-$(date +%Y%m%d).tar.gz /data/commonshub
```
