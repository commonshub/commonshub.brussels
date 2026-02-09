"use client";

/**
 * Status Page - HTML view of application status
 *
 * Shows:
 * - Current git deployment (SHA, commit message, date)
 * - Application uptime
 * - Server information
 *
 * JSON API available at /status.json
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Clock, GitBranch, Server, Timer, Loader2 } from "lucide-react";

interface StatusData {
  status: string;
  deployment: {
    sha: string;
    shortSha: string;
    message: string;
    commitDate: string;
    commitDateFormatted: string;
  };
  build: {
    time: string;
    timeFormatted: string;
  };
  uptime: {
    started: string;
    startedFormatted: string;
    uptime: string;
    uptimeSeconds: number;
  };
  server: {
    time: string;
    timeFormatted: string;
    timezone: string;
  };
  environment: string;
}

export default function StatusPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/status.json")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch status");
        return res.json();
      })
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto py-12 px-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto py-12 px-4">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Status</CardTitle>
            <CardDescription>{error || "Unable to load application status"}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const isHealthy = data.status === "ok";

  return (
    <div className="container mx-auto py-12 px-4 max-w-4xl">
      {/* Header */}
      <div className="space-y-2 mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-4xl font-bold">System Status</h1>
          <Badge variant={isHealthy ? "default" : "destructive"} className="text-sm">
            {isHealthy ? "Operational" : "Error"}
          </Badge>
        </div>
        <p className="text-muted-foreground">
          Real-time application status and deployment information
        </p>
      </div>

      <div className="space-y-6">
        {/* Deployment Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Current Deployment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Commit SHA</p>
                <code className="text-sm bg-muted px-2 py-1 rounded">
                  {data.deployment.shortSha}
                </code>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Environment</p>
                <Badge variant="outline">{data.environment}</Badge>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-sm text-muted-foreground mb-1">Commit Message</p>
              <p className="text-sm font-mono">{data.deployment.message}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Commit Date</p>
                <p className="text-sm">{data.deployment.commitDateFormatted || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Build Time</p>
                <p className="text-sm">{data.build?.timeFormatted || "N/A"}</p>
              </div>
            </div>

            <div className="pt-2">
              <a
                href={`https://github.com/commonshub/commonshub.brussels/commit/${data.deployment.sha}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                View commit on GitHub →
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Uptime Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5" />
              Application Uptime
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Started At</p>
                <p className="text-sm">{data.uptime.startedFormatted}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Running For</p>
                <p className="text-lg font-semibold">{data.uptime.uptime}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Server Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Server Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Current Time</p>
                <p className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {data.server.timeFormatted}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Timezone</p>
                <p className="text-sm">{data.server.timezone}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* JSON API Link */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium mb-1">JSON API</p>
                <p className="text-xs text-muted-foreground">
                  Programmatic access to status information
                </p>
              </div>
              <a
                href="/status.json"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                View JSON →
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
