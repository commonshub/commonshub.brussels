"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { WalletAddress } from "@/components/wallet-address";
import type { AccountData } from "@/lib/financials";

function AccountCard({ account }: { account: AccountData }) {
  return (
    <Link href={`/finance/${account.slug}`} className="block h-full">
      <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span>{account.name}</span>
            {account.address && (
              <WalletAddress
                address={account.address}
                chain={account.chain || "ethereum"}
                showLink={false}
                showCopy={false}
              />
            )}
          </CardTitle>
          <CardDescription>
            {account.provider === "stripe"
              ? "Stripe"
              : `${account.chain} blockchain`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-3xl font-bold">
            {Math.round(account.balance ?? 0).toLocaleString()}{" "}
            <span className="text-lg text-muted-foreground">
              {account.tokenSymbol}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span className="whitespace-nowrap">
              <span className="text-muted-foreground">In </span>
              <span className="text-green-600 tabular-nums">{Math.round(account.totalInflow ?? 0).toLocaleString()}</span>
            </span>
            <span className="whitespace-nowrap">
              <span className="text-muted-foreground">Out </span>
              <span className="text-red-600 tabular-nums">{Math.round(account.totalOutflow ?? 0).toLocaleString()}</span>
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

/** A line under the total that opens the per-account cards; closed by default. */
export function AccountsBreakdown({ active, archived }: { active: AccountData[]; archived: AccountData[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        {open ? "Hide" : "Show"} the breakdown per account ({active.length})
      </button>
      {open && <AccountCards active={active} archived={archived} />}
    </div>
  );
}

export function AccountCards({
  active,
  archived,
}: {
  active: AccountData[];
  archived: AccountData[];
}) {
  const [showArchived, setShowArchived] = useState(false);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {active.map((account) => (
          <AccountCard key={account.slug} account={account} />
        ))}
        {showArchived &&
          archived.map((account) => (
            <AccountCard key={account.slug} account={account} />
          ))}
      </div>
      {archived.length > 0 && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? "Hide" : "Show"} archived accounts ({archived.length})
          </Button>
        </div>
      )}
    </div>
  );
}
