"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface WalletAddressProps {
  address: string;
  chain?: string;
  className?: string;
  showCopy?: boolean;
  showLink?: boolean;
}

/**
 * Get block explorer URL for a chain
 */
function getExplorerUrl(chain: string, address: string): string {
  const explorers: Record<string, string> = {
    gnosis: "https://gnosisscan.io/address/",
    ethereum: "https://etherscan.io/address/",
    polygon: "https://polygonscan.com/address/",
    arbitrum: "https://arbiscan.io/address/",
    optimism: "https://optimistic.etherscan.io/address/",
    base: "https://basescan.org/address/",
    celo: "https://celoscan.io/address/",
  };
  const baseUrl = explorers[chain.toLowerCase()] || "https://etherscan.io/address/";
  return `${baseUrl}${address}`;
}

/**
 * Shorten an address for display
 */
function shortenAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletAddress({
  address,
  chain = "ethereum",
  className,
  showCopy = true,
  showLink = true,
}: WalletAddressProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy address:", err);
    }
  };

  const explorerUrl = getExplorerUrl(chain, address);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-mono text-xs text-muted-foreground",
        className
      )}
    >
      {showLink ? (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground transition-colors hover:underline"
          onClick={(e) => e.stopPropagation()}
          title={`View on ${chain} explorer`}
        >
          {shortenAddress(address)}
        </a>
      ) : (
        <span title={address}>{shortenAddress(address)}</span>
      )}
      {showCopy && (
        <button
          onClick={handleCopy}
          className="p-0.5 hover:bg-muted rounded transition-colors"
          title={copied ? "Copied!" : "Copy address"}
        >
          {copied ? (
            <Check className="w-3 h-3 text-green-500" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
        </button>
      )}
      {showLink && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-0.5 hover:bg-muted rounded transition-colors"
          onClick={(e) => e.stopPropagation()}
          title={`View on ${chain} explorer`}
        >
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </span>
  );
}
