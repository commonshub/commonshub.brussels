"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import settings from "@/settings/settings.json";

interface TransactionMetadata {
  collective: string;
  project: string | null;
  event: string | null;
  category: string;
  tags: string[];
  description: string;
}

interface TransactionMetadataEditorProps {
  transactionId: string;
  metadata: TransactionMetadata;
  type: "CREDIT" | "DEBIT";
  onUpdate?: (metadata: TransactionMetadata) => void;
}

export function TransactionMetadataEditor({
  transactionId,
  metadata,
  type,
  onUpdate,
}: TransactionMetadataEditorProps) {
  const [collective, setCollective] = useState(metadata.collective);
  const [category, setCategory] = useState(metadata.category);
  const [isUpdating, setIsUpdating] = useState(false);

  // Get collectives from settings
  const collectivesObj = (settings.finance as any).collectives || {};
  const collectives = Object.keys(collectivesObj);

  // Get categories based on transaction type
  const categoriesObj = (settings.finance as any).categories || {};
  const categories = type === "CREDIT"
    ? (categoriesObj.credit || ["other"])
    : (categoriesObj.debit || ["other"]);

  const updateMetadata = async (updates: Partial<TransactionMetadata>) => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/transactions/${encodeURIComponent(transactionId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error("Failed to update transaction");
      }

      const data = await response.json();
      if (onUpdate && data.transaction) {
        onUpdate(data.transaction.metadata);
      }
    } catch (error) {
      console.error("Error updating transaction:", error);
      alert("Failed to update transaction metadata");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCollectiveChange = async (value: string) => {
    setCollective(value);
    await updateMetadata({ collective: value });
  };

  const handleCategoryChange = async (value: string) => {
    setCategory(value);
    await updateMetadata({ category: value });
  };

  return (
    <div className="flex gap-2 items-center">
      <Select
        value={collective}
        onValueChange={handleCollectiveChange}
        disabled={isUpdating}
      >
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <SelectValue placeholder="Collective" />
        </SelectTrigger>
        <SelectContent>
          {collectives.map((slug) => (
            <SelectItem key={slug} value={slug} className="text-xs">
              {collectivesObj[slug]?.name || slug}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={category}
        onValueChange={handleCategoryChange}
        disabled={isUpdating}
      >
        <SelectTrigger className="w-[120px] h-8 text-xs">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          {categories.map((cat: string) => (
            <SelectItem key={cat} value={cat} className="text-xs">
              {cat}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isUpdating && (
        <span className="text-xs text-muted-foreground">Saving...</span>
      )}
    </div>
  );
}
