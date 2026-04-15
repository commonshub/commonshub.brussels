# Deploying with Coolify

This setup uses a single Docker Compose resource in Coolify with two services:

- `web`: the Next.js website, exposed on your public domain
- `chbcli`: the private worker that holds fetch secrets and runs `chb sync`

Both services mount the same named Docker volume at `/data`.
The website gets that volume read-only. Only `chbcli` can write to it.

## Prerequisites

- A server with Coolify installed
- A domain pointing to the server
- The repository connected in Coolify
- API keys ready for the CHB worker

## Why This Layout

- The website and CLI share the same persistent `/data` volume.
- The website mounts `/data` read-only.
- Only the `chbcli` service receives external API secrets.
- The `web` service can read `/data` without having access to fetch credentials.
- A named Docker volume survives normal redeployments because the containers are recreated but the volume is kept.

## Create the Resource

1. Create a project and environment in Coolify.
2. Create one application using the `Docker Compose` build pack.
3. Point it at this repository.
4. Use [`docker-compose.coolify.yml`](/home/xdamman/Github/commonshub/commonshub.brussels/docker-compose.coolify.yml) as the compose file.

That compose file builds the website from `Dockerfile.web` and the worker from `Dockerfile.chb`.

Coolify should expose only the `web` service on your domain. Do not expose `chbcli`.

## Environment Variables

Set the website runtime variables for the `web` service:

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

Set the data-fetching secrets for the `chbcli` service only:

```bash
DATA_DIR=/data
DISCORD_BOT_TOKEN=your-discord-bot-token
LUMA_API_KEY=your-luma-api-key
STRIPE_SECRET_KEY=your-stripe-secret-key
ETHERSCAN_API_KEY=your-etherscan-api-key
MONERIUM_CLIENT_ID=your-monerium-client-id
MONERIUM_CLIENT_SECRET=your-monerium-client-secret
```

Do not define those fetch secrets on the `web` service.

## Persistent Data

The compose file declares a named volume:

```yaml
volumes:
  commonshub-data:
    name: commonshub-data
```

That volume is mounted into both services at `/data`, so data stays available across normal redeployments.
In the compose file, `web` mounts it read-only and `chbcli` mounts it read-write.

Important:

- Redeploying or rebuilding does not remove the volume.
- Deleting the resource and its volumes does remove it.
- The volume name is fixed to `commonshub-data`, so the mount target stays stable.

The worker image stays alive with `sleep infinity`, which lets Coolify scheduled tasks execute `chb` commands inside that container.

## First Deploy

1. Deploy the compose application.
2. Open the site. If `/data` is empty you will see the empty-data state.

## Populate the Data Directory

Use the terminal of the `chbcli` service and run:

```bash
chb sync
```

For a full backfill instead:

```bash
chb sync --history
```

After the sync finishes, refresh the website.

## Scheduled Task

Create the scheduled task on the `chbcli` service, not on the website service.

- Name: `sync-data`
- Command: `chb sync`
- Frequency: `0 * * * *`

Common alternatives:

- Every 30 minutes: `*/30 * * * *`
- Every 6 hours: `0 */6 * * *`
- Daily at midnight: `0 0 * * *`

## Why Not Two Coolify Projects

- Service-level environment variables are enough to keep fetch secrets on `chbcli` only.
- A single compose resource makes shared storage straightforward.
- Only `web` needs a domain; `chbcli` can stay internal.

## Verification

Check the website container:

```bash
docker compose -f docker-compose.coolify.yml logs -f web
```

Check the worker container:

```bash
docker compose -f docker-compose.coolify.yml logs -f chbcli
```

Inspect the shared named volume:

```bash
docker volume inspect commonshub-data
```

## Backup

```bash
docker run --rm -v commonshub-data:/volume -v "$PWD:/backup" alpine \
  tar -czvf /backup/commonshub-backup-$(date +%Y%m%d).tar.gz -C /volume .
```
