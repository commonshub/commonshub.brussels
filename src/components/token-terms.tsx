import { TOKEN_TERMS, type TokenTermsKind } from "@/lib/token-terms"

/** The fine print next to a price in tokens (lib/token-terms.ts). */
export function TokenTerms({ kinds, className = "" }: { kinds: TokenTermsKind[]; className?: string }) {
  return (
    <div className={`text-xs text-muted-foreground ${className}`}>
      {kinds.map((k) => (
        <p key={k}>* {TOKEN_TERMS[k]}</p>
      ))}
    </div>
  )
}
