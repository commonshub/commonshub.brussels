import { getDoc } from "@/lib/docs";
import { Markdown } from "@/components/markdown";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CLI Reference — Commons Hub Brussels",
  description: "Installation, configuration, and usage guide for the chb CLI tool.",
};

export default function CliPage() {
  const content = getDoc("cli.md");
  if (!content) return notFound();

  return <Markdown content={content} />;
}
