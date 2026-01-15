# Webhook Deployment Setup

This project includes an automated deployment webhook that allows GitHub to trigger deployments when code is pushed to the main branch.

## How It Works

1. GitHub sends a webhook on push events
2. The webhook endpoint verifies the GitHub signature
3. If valid and pushed to main branch, it runs:
   - `git pull origin main`
   - `npm ci` (clean install dependencies)
   - `npm run build`
   - `npm run restart` (restarts the systemd service)

## Setup Instructions

### 1. Set Environment Variable

Add the webhook secret to your environment:

```bash
# In your .env file or server environment
WEBHOOK_SECRET=your_random_secret_here
```

Generate a secure random secret:
```bash
openssl rand -hex 32
```

### 2. Configure GitHub Webhook

1. Go to your GitHub repository settings
2. Navigate to **Settings > Webhooks > Add webhook**
3. Configure the webhook:
   - **Payload URL**: `https://commonshub.brussels/api/webhook/deploy`
   - **Content type**: `application/json`
   - **Secret**: Use the same secret as WEBHOOK_SECRET
   - **Which events**: Select "Just the push event"
   - **Active**: ✓ Checked

4. Click "Add webhook"

### 3. Configure systemd service name

The webhook uses `npm run restart` and `npm run logs` to manage the service. If your systemd service has a different name, simply edit `package.json`:

```json
{
  "scripts": {
    "restart": "sudo systemctl restart your-service-name",
    "logs": "sudo journalctl -u your-service-name -f -n 100"
  }
}
```

Replace `your-service-name` with your actual systemd service name (default is `commonshub.brussels`).

**Utility commands:**
- `npm run restart` - Restart the application service
- `npm run logs` - View the last 100 lines of logs and follow new entries

### 4. Grant sudo permissions for systemctl

The deployment script needs to restart the systemd service and view logs without a password prompt:

```bash
# Edit sudoers file
sudo visudo

# Add these lines (replace 'username' with the user running the Node.js app)
# Replace 'commonshub.brussels' with your actual service name
username ALL=(ALL) NOPASSWD: /bin/systemctl restart commonshub.brussels
username ALL=(ALL) NOPASSWD: /bin/journalctl -u commonshub.brussels *
```

### 5. Test the Webhook

You can test the webhook endpoint:

```bash
# Health check (GET request)
curl https://commonshub.brussels/api/webhook/deploy

# Test with valid signature (simulates GitHub webhook)
./scripts/test-webhook.sh http://localhost:3000/api/webhook/deploy your_webhook_secret

# Or with environment variable
export WEBHOOK_SECRET=your_webhook_secret
./scripts/test-webhook.sh

# Manual deployment test from GitHub
# Go to GitHub Settings > Webhooks > Your webhook > Recent Deliveries
# Click "Redeliver" on any delivery to test

# Verify deployment status
curl https://commonshub.brussels/status.json | jq .

# Or view in browser
open https://commonshub.brussels/status
```

## Security

- Uses HMAC SHA256 signature verification (GitHub standard)
- Timing-safe comparison to prevent timing attacks
- Only deploys on push events to `refs/heads/main`
- Requires WEBHOOK_SECRET environment variable to be set

## Webhook Payload

The endpoint responds with deployment status:

```json
{
  "status": "success",
  "duration": "45230ms",
  "steps": [
    { "step": "Git pull", "success": true },
    { "step": "Install dependencies", "success": true },
    { "step": "Build", "success": true },
    { "step": "Restart service", "success": true }
  ],
  "event": "push",
  "repository": "commonshub/commonshub.brussels",
  "ref": "refs/heads/main",
  "commit": "abc1234",
  "message": "Update homepage",
  "pusher": "username"
}
```

## Verify Deployment

After deployment, you can check the application status:

```bash
# JSON API
curl https://commonshub.brussels/status.json

# Or view HTML page in browser
open https://commonshub.brussels/status
```

This returns:
```json
{
  "status": "ok",
  "deployment": {
    "sha": "abc1234567890...",
    "shortSha": "abc1234",
    "message": "Update homepage",
    "commitDate": "2024-01-15 14:30:00 +0100",
    "commitDateFormatted": "01/15/2024, 14:30:00"
  },
  "uptime": {
    "started": "2024-01-15T13:00:00.000Z",
    "startedFormatted": "01/15/2024, 14:00:00",
    "uptime": "1h 30m 15s",
    "uptimeSeconds": 5415
  },
  "server": {
    "time": "2024-01-15T13:30:15.000Z",
    "timeFormatted": "01/15/2024, 14:30:15",
    "timezone": "Europe/Brussels"
  },
  "environment": "production"
}
```

The `deployment.shortSha` should match the commit you just deployed.

## Troubleshooting

### Check webhook logs
```bash
# View Next.js logs (if using PM2)
pm2 logs commonshub.brussels

# Or check systemd logs
journalctl -u commonshub.brussels -f
```

### Check GitHub webhook deliveries
In GitHub repository settings, go to **Webhooks** and click on your webhook to see recent deliveries and responses.

### Common issues

1. **401 Invalid signature**: WEBHOOK_SECRET mismatch between server and GitHub
2. **Permission denied on systemctl**: Add sudo permissions (see step 3)
3. **Git pull fails**: Ensure the server has SSH keys configured for GitHub
4. **Build fails**: Check that all dependencies are available on the server

## Manual Deployment

If you need to deploy manually without the webhook:

```bash
cd /path/to/commonshub.brussels
git pull origin main
npm ci
npm run build
npm run restart
```

**Useful commands:**
- `npm run logs` - View application logs
- `npm run restart` - Restart the service after making changes
