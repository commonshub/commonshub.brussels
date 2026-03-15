import { getDoc, getDocTitle, CLI_COMMANDS } from "@/lib/docs";
import { Markdown } from "@/components/markdown";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return CLI_COMMANDS.map((cmd) => ({ slug: cmd.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const content = getDoc(`cli/${slug}.md`);
  if (!content) return { title: "Not Found" };

  const title = getDocTitle(content);
  return {
    title: `${title} — CHB CLI Documentation`,
    description: `Documentation for the chb ${slug} command.`,
  };
}

export default async function CommandPage({ params }: Props) {
  const { slug } = await params;
  const content = getDoc(`cli/${slug}.md`);
  if (!content) return notFound();

  return <Markdown content={content} />;
}
