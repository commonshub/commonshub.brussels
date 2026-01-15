import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import crypto from "crypto";

const execAsync = promisify(exec);

/**
 * Webhook endpoint for automated deployment
 *
 * GitHub sends webhooks with X-Hub-Signature-256 header containing
 * HMAC SHA256 signature of the payload using the webhook secret.
 *
 * Usage:
 * 1. Set WEBHOOK_SECRET environment variable to match your GitHub webhook secret
 * 2. Configure GitHub webhook to POST to https://your-domain.com/api/webhook/deploy
 * 3. GitHub will send X-Hub-Signature-256 header for verification
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Get the secret from environment
    const secret = process.env.WEBHOOK_SECRET;
    if (!secret) {
      console.error("[Webhook] WEBHOOK_SECRET environment variable not set");
      return NextResponse.json(
        { error: "Webhook not configured" },
        { status: 500 }
      );
    }

    // Get the signature from GitHub webhook header
    const signature = request.headers.get("x-hub-signature-256");
    if (!signature) {
      console.error("[Webhook] Missing X-Hub-Signature-256 header");
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 401 }
      );
    }

    // Read the raw body
    const body = await request.text();

    // Compute HMAC SHA256 signature
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(body);
    const computedSignature = `sha256=${hmac.digest("hex")}`;

    // Compare signatures using timing-safe comparison
    const signatureBuffer = Buffer.from(signature);
    const computedBuffer = Buffer.from(computedSignature);

    if (signatureBuffer.length !== computedBuffer.length) {
      console.error("[Webhook] Invalid signature length");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    if (!crypto.timingSafeEqual(signatureBuffer, computedBuffer)) {
      console.error("[Webhook] Signature verification failed");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Parse the payload to get event info
    let payload: any = {};
    try {
      payload = JSON.parse(body);
    } catch (error) {
      console.error("[Webhook] Failed to parse JSON payload:", error);
    }

    const event = request.headers.get("x-github-event") || "unknown";
    const repo = payload?.repository?.full_name || "unknown";
    const ref = payload?.ref || "unknown";

    console.log(`[Webhook] Received ${event} event from ${repo} (${ref})`);

    // Only deploy on push events to main branch
    if (event !== "push" || ref !== "refs/heads/main") {
      console.log(`[Webhook] Ignoring event: ${event} on ${ref}`);
      return NextResponse.json({
        status: "ignored",
        message: `Event ${event} on ${ref} does not trigger deployment`,
      });
    }

    console.log("[Webhook] Starting deployment...");

    // Execute deployment commands
    const deploymentSteps = [
      {
        name: "Git pull",
        command: "git pull origin main",
      },
      {
        name: "Install dependencies",
        command: "npm ci",
      },
      {
        name: "Build",
        command: "npm run build",
      },
      {
        name: "Restart service",
        command: "npm run restart",
      },
    ];

    const results: Array<{ step: string; success: boolean; output?: string; error?: string }> = [];

    for (const step of deploymentSteps) {
      try {
        console.log(`[Webhook] ${step.name}...`);
        const { stdout, stderr } = await execAsync(step.command, {
          cwd: process.cwd(),
          timeout: 300000, // 5 minutes timeout
        });

        console.log(`[Webhook] ${step.name} completed`);
        if (stdout) console.log(`[Webhook] stdout: ${stdout.substring(0, 500)}`);
        if (stderr) console.log(`[Webhook] stderr: ${stderr.substring(0, 500)}`);

        results.push({
          step: step.name,
          success: true,
          output: stdout || stderr || "No output",
        });
      } catch (error: any) {
        console.error(`[Webhook] ${step.name} failed:`, error);
        results.push({
          step: step.name,
          success: false,
          error: error.message,
        });

        // Stop on first error
        break;
      }
    }

    const allSuccessful = results.every((r) => r.success);
    const duration = Date.now() - startTime;

    console.log(`[Webhook] Deployment ${allSuccessful ? "succeeded" : "failed"} in ${duration}ms`);

    return NextResponse.json({
      status: allSuccessful ? "success" : "partial_failure",
      duration: `${duration}ms`,
      steps: results,
      event,
      repository: repo,
      ref,
      commit: payload?.head_commit?.id?.substring(0, 7) || "unknown",
      message: payload?.head_commit?.message || "",
      pusher: payload?.pusher?.name || "unknown",
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error("[Webhook] Deployment error:", error);

    return NextResponse.json(
      {
        status: "error",
        duration: `${duration}ms`,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for health check
 */
export async function GET() {
  const hasSecret = !!process.env.WEBHOOK_SECRET;

  return NextResponse.json({
    status: "ok",
    message: "Webhook endpoint is active",
    configured: hasSecret,
    note: "POST with GitHub webhook signature to trigger deployment",
  });
}
