"use client";

import { AlertCircle, Database, Terminal } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

interface EmptyDataStateProps {
  title?: string;
  message?: string;
  showInstructions?: boolean;
}

/**
 * Component to display when data directory is empty
 * Shows helpful instructions for fetching data
 */
export function EmptyDataState({
  title = "No Data Available",
  message = "The data directory is empty. Data needs to be fetched before the website can display content.",
  showInstructions = true,
}: EmptyDataStateProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-full bg-yellow-500/10">
              <AlertCircle className="w-6 h-6 text-yellow-500" />
            </div>
            <div>
              <CardTitle className="text-2xl">{title}</CardTitle>
              <CardDescription className="mt-1">{message}</CardDescription>
            </div>
          </div>
        </CardHeader>

        {showInstructions && (
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="mt-1">
                  <Database className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Quick Start (Recommended)</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Fetch recent data (current and previous month) to get started quickly:
                  </p>
                  <div className="bg-muted p-3 rounded-md">
                    <code className="text-sm">
                      docker exec commonshub npm run fetch-recent
                    </code>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Duration: ~3-7 minutes
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="mt-1">
                  <Terminal className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Full Historical Data</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Fetch all available historical data:
                  </p>
                  <div className="bg-muted p-3 rounded-md">
                    <code className="text-sm">
                      docker exec commonshub npm run fetch-history
                    </code>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Duration: ~15-60 minutes on first run
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h3 className="font-semibold mb-3">What happens when you fetch data?</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Fetches transactions from Stripe and blockchain</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Downloads Discord messages and images</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Retrieves calendar events from Luma and ICS feeds</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Generates aggregated data files automatically</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Caches everything for fast subsequent builds</span>
                </li>
              </ul>
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Need help?{" "}
                <a
                  href="https://github.com/commonshub/commonshub.brussels/blob/main/docs/deployment.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Read the deployment guide
                </a>
              </p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

/**
 * Compact version for inline use
 */
export function EmptyDataInline({
  message = "No data available. Run fetch-recent to populate data.",
}: {
  message?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
      <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
