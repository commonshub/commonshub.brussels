import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/** A markdown document rendered on the server with the site's typography (no client JavaScript). */
const components: Components = {
  h1: ({ children }) => <h1 className="mt-2 mb-4 text-3xl font-bold text-foreground">{children}</h1>,
  h2: ({ children, id }) => (
    <h2 id={id} className="mt-12 mb-4 border-b border-border pb-2 text-2xl font-semibold text-foreground scroll-mt-24">
      {children}
    </h2>
  ),
  h3: ({ children }) => <h3 className="mt-8 mb-3 text-lg font-semibold text-foreground">{children}</h3>,
  p: ({ children }) => <p className="my-3 leading-relaxed text-foreground/90">{children}</p>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1.5 pl-6 text-foreground/90">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1.5 pl-6 text-foreground/90">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ children, href }) => (
    <a href={href} className="text-primary underline underline-offset-2 hover:no-underline break-words">
      {children}
    </a>
  ),
  blockquote: ({ children }) => <blockquote className="my-4 border-l-4 border-border pl-4 text-muted-foreground">{children}</blockquote>,
  code: ({ children, className }) =>
    className ? (
      <code className={className}>{children}</code>
    ) : (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] [overflow-wrap:anywhere]">{children}</code>
    ),
  pre: ({ children }) => (
    <pre className="my-4 overflow-x-auto rounded-lg border border-border bg-muted p-4 font-mono text-sm leading-relaxed">{children}</pre>
  ),
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-border bg-muted px-3 py-2 text-left font-semibold text-foreground">{children}</th>,
  td: ({ children }) => <td className="border-b border-border px-3 py-2 align-top text-foreground/90">{children}</td>,
  hr: () => <hr className="my-8 border-border" />,
};

export function MarkdownDocument({ markdown }: { markdown: string }) {
  return (
    <article className="min-w-0 [overflow-wrap:anywhere]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </article>
  );
}
