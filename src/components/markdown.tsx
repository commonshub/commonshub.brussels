"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        pre({ children, ...props }) {
          return (
            <pre className="overflow-x-auto" {...props}>
              {children}
            </pre>
          );
        },
        code({ children, className, ...props }) {
          const isInline = !className;
          if (isInline) {
            return <code {...props}>{children}</code>;
          }
          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
        table({ children, ...props }) {
          return (
            <div className="overflow-x-auto">
              <table {...props}>{children}</table>
            </div>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
