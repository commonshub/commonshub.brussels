"use client"

import { useState } from "react"
import { Loader2, MessageSquare } from "lucide-react"

import { useNostr } from "@/components/nostr-provider"
import { SignInPrompt } from "@/components/day/sign-in-prompt"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { type CommentView, buildComment } from "@/lib/nostr-conventions"
import { nip73Kind } from "@/lib/nip73"

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" })

/**
 * The conversation about one expense, on the community relays: NIP-22
 * comments whose root is the expense's identifier, signed with the
 * member's own key. Everyone reads them; members write them.
 */
export function ExpenseComments({
  uri,
  initial,
  canComment,
  sitePubkey,
  community,
  relays,
}: {
  uri: string
  initial: CommentView[]
  canComment: boolean
  sitePubkey: string
  community: { guildId: string; name: string }
  relays: string[]
}) {
  const nostr = useNostr()
  const [comments, setComments] = useState(initial)
  const [draft, setDraft] = useState("")
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const post = async () => {
    const content = draft.trim()
    if (!content) return
    setPosting(true)
    setError(null)
    try {
      const { event } = await nostr.signAndPublish(buildComment(uri, nip73Kind(uri), content, community, sitePubkey), relays)
      setComments((prev) => [...prev, { id: event.id, pubkey: event.pubkey, content: event.content, at: new Date(event.created_at * 1000).toISOString(), name: "You" }])
      setDraft("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post the comment")
    } finally {
      setPosting(false)
    }
  }

  return (
    <div>
      <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
        <MessageSquare className="h-6 w-6 text-primary" />
        Comments
      </h2>
      {comments.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-foreground">{c.name}</span>
                <span className="text-xs text-muted-foreground">{when(c.at)}</span>
              </div>
              <p className="mt-1.5 whitespace-pre-line break-words text-sm text-foreground">{c.content}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4">
        {canComment ? (
          <div className="flex flex-col gap-2">
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a comment…" rows={3} maxLength={2000} />
            <div className="flex items-center gap-3">
              <Button size="sm" onClick={post} disabled={posting || !draft.trim() || !nostr.ready}>
                {posting && <Loader2 className="h-4 w-4 animate-spin" />}
                Comment
              </Button>
              <span className="text-xs text-muted-foreground">Signed with your own key and recorded on the Commons Hub relay.</span>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        ) : (
          <SignInPrompt>Members can comment on this expense.</SignInPrompt>
        )}
      </div>
    </div>
  )
}
