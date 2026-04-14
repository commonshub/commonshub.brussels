# Deploying with Coolify

This guide walks you through installing Coolify and deploying Commons Hub Brussels as a Docker container with persistent storage.

## Prerequisites

- A server (VPS) with Ubuntu 22.04+ or Debian 11+
- Minimum 2GB RAM, 2 CPU cores recommended
- Root or sudo access
- A domain name pointing to your server

## Step 1: Install Coolify

SSH into your server and run:

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

This will:
- Install Docker if not present
- Set up Coolify and its dependencies
- Start the Coolify service

Once complete, access Coolify at `http://your-server-ip:8000`.

## Step 2: Initial Coolify Setup

1. Open `http://your-server-ip:8000` in your browser
2. Create your admin account
3. Add your server as a resource (localhost is added by default)

## Step 3: Create a New Project

1. Click **"Projects"** in the sidebar
2. Click **"+ Add"** to create a new project
3. Name it `commonshub-brussels` or similar
4. Click into the project and create a new **Environment** (e.g., `production`)

## Step 4: Add the Application

1. Inside your environment, click **"+ Add New Resource"**
2. Select **"Public Repository"** (or Private if using authentication)
3. Enter the repository URL: `https://github.com/commonshub/commonshub.brussels`
4. Select the branch: `main`
5. Choose **"Dockerfile"** as the build pack

## Step 5: Configure Build Settings

In the application settings:

### General Tab
- **Name**: `commonshub-brussels`
- **Build Pack**: Dockerfile
- **Dockerfile Location**: `Dockerfile` (or `docker/Dockerfile` if located there)

### Environment Variables
Add the following environment variables:

```
NODE_ENV=production
DATA_DIR=/data
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-secret-key-here
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
WEBHOOK_SECRET=your-webhook-secret
```

Leave `ENABLE_DNS_SANDBOX` unset on Coolify. The container startup now skips the custom `/etc/hosts` DNS sandbox unless you explicitly set `ENABLE_DNS_SANDBOX=1`.

Generate a secure NEXTAUTH_SECRET:
```bash
openssl rand -base64 32
```

## Step 6: Configure Persistent Storage

This is critical for preserving data across deployments.

1. Go to the **"Storages"** tab in your application settings
2. Click **"+ Add"** to add a new volume
3. Configure:
   - **Source Path**: `/data/commonshub` (on the host - Coolify creates this automatically)
   - **Destination Path**: `/data` (in the container)
4. Save the storage configuration

This mounts the host directory `/data/commonshub` to `/data` inside the container, ensuring your data persists across deployments and rebuilds.

## Step 7: Configure Domain & SSL

1. Go to the **"Settings"** tab
2. Under **"Domains"**, add your domain: `commonshub.brussels`
3. Enable **"Generate SSL"** for automatic Let's Encrypt certificates
4. Set the port to `3000` (Next.js default)

## Step 8: Deploy

1. Click **"Deploy"** to start the initial deployment
2. Monitor the build logs for any errors
3. Once complete, your app should be accessible at your domain

## Step 9: Set Up Auto-Deploy Webhook

To enable automatic deployments when you push to main:

1. In Coolify, go to your application's **"Webhooks"** tab
2. Copy the **Deploy Webhook URL** (looks like `https://coolify.your-server.com/api/v1/deploy?...`)
3. In your GitHub repository:
   - Go to **Settings** → **Webhooks** → **Add webhook**
   - **Payload URL**: Paste the Coolify webhook URL
   - **Content type**: `application/json`
   - **Secret**: Leave empty (Coolify uses token in URL)
   - **Events**: Select "Just the push event"
   - Click **Add webhook**

Now pushes to main will automatically trigger deployments.

## Step 10: Populate the Data Directory

The app needs data to display events, photos, transactions, etc.

### Using Coolify's Terminal

1. In Coolify, go to your application
2. Click on the **"Terminal"** tab
3. Run the fetch command:

```bash
npm run fetch-recent
```

This will fetch:
- Discord messages and images
- Calendar events (Luma, iCal)
- Financial transactions (blockchain, Stripe)
- CHT token data
- User profiles

It takes a few minutes on first run. Subsequent runs are faster as they skip already-cached data.

### (Optional) Fetch historical data:
```bash
npm run fetch-history
```

This fetches all historical data. Only needed if you want complete archives.

## Step 11: Set Up the Cron Job

Data needs to be refreshed periodically. Use Coolify's built-in scheduled tasks.

1. In Coolify, go to your application
2. Click on the **"Scheduled Tasks"** tab (or **"Cron"** in some versions)
3. Click **"+ Add"** to create a new scheduled task
4. Configure:
   - **Name**: `fetch-recent-data`
   - **Command**: `npm run fetch-recent`
   - **Frequency**: `0 * * * *` (every hour)
5. Save the scheduled task

### Common cron frequencies:
- Every hour: `0 * * * *`
- Every 30 minutes: `*/30 * * * *`
- Every 6 hours: `0 */6 * * *`
- Daily at midnight: `0 0 * * *`

### Verify it's working

After an hour (or trigger it manually if Coolify allows), check the logs in the Coolify interface to confirm data is being fetched.

## Verifying the Setup

### Check container is running:
```bash
docker ps | grep commonshub
```

### Check data persistence:
```bash
ls -la /data/commonshub
```

### View logs:
```bash
docker logs -f <container-id>
```

### Test the webhook:
Push a small change to main and verify Coolify starts a new deployment.

## Troubleshooting

### Container won't start
- Check logs in Coolify UI or via `docker logs`
- Verify all required environment variables are set
- Ensure port 3000 is not blocked

### Data not persisting
- Verify the storage mount is configured correctly
- Check that `/data/commonshub` exists on the host
- The entrypoint script automatically fixes permissions on startup

### SSL certificate issues
- Ensure your domain DNS is pointing to the server
- Wait a few minutes for DNS propagation
- Check Coolify logs for Let's Encrypt errors

### Build failures
- Check if Dockerfile exists in the repository
- Verify Node.js version compatibility
- Review build logs for specific errors

## Backup

To backup your data:
```bash
tar -czvf commonshub-backup-$(date +%Y%m%d).tar.gz /data/commonshub
```

## Updating Coolify

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

This will update Coolify to the latest version while preserving your configuration.

## Summary

Once everything is set up, you should have:

- Application running at `https://commonshub.brussels` and `https://www.commonshub.brussels`
- Persistent data stored at `/data/commonshub` on the host, mounted to `/data` in the container
- Automatic SSL certificates via Let's Encrypt
- Scheduled task running `npm run fetch-recent` every hour to keep data fresh
- Auto-deploy webhook triggered on pushes to the main branch
