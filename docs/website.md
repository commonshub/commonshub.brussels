# How commonshub.brussels works with the data, and how other apps can too

Two things this website does not own but merely reads and writes:

1. **The dataset** produced by [`chb`](https://github.com/commonshub/chb),
   mounted read-only at `DATA_DIR` (`/data` in the container). Reports,
   finance, events, photos, contributors all come from it.
2. **The community relays** (Nostr), where shifts, identities and
   annotations are recorded. Discord, this site and any bot are just ways to
   read and write them.

The site never writes to the dataset (`tests/no-server-writes.test.ts`) and
never keeps state of its own beyond caches: everything it knows is either
in the dataset or on the relays, so any other app can know it too.

## 1. The dataset: audience tiers

`chb` writes every processed file once per audience, same file name,
strictly less in each lower tier
([chb `docs/website.md`](https://github.com/commonshub/chb/blob/main/docs/website.md),
[`docs/audiences.md`](https://github.com/commonshub/chb/blob/main/docs/audiences.md)):

```
YYYY/MM/public/    YYYY/public/    latest/public/     anyone                     0755
YYYY/MM/members/   YYYY/members/   latest/members/    Discord `member` role      0750, group chb-members
YYYY/MM/stewards/  …                                  chb / stewards only        0700 — the site cannot open it
YYYY/MM/providers/                                    raw archives               0700 — never served
```

**The one rule** (`src/lib/data-paths.ts`): a page picks the tier its
viewer is entitled to — `tierFor(isMember)` — and reads the same relative
path in it through `tierDir(tier, year?, month?)`. Public routes read
`public/` unconditionally. Pages behind the member role read `members/`,
which already contains everything the public file does plus the names, so
tiers are never merged. Nothing on the site reads `stewards/`, `providers/`
or the legacy `generated/`; `tests/data-tiers.test.ts` fails the build if
any source spells such a path.

The readers live in `src/lib/dataset.ts` (`readTierJson`, `listMonths`,
`readEventsForMonth`, …). What each file contains per tier is the table in
chb's `docs/website.md`. Local images are served only through
`/api/image-proxy`, which accepts image files under a `public/` tier
directory and chb's Discord attachment copies, nothing else
(`src/lib/served-paths.ts`).

### Integrity

The raw archives are never published, but their hashes are. For every
completed month `chb` writes `YYYY/MM/hashes.json` at the month root, outside the tiers (one entry per
provider: counts, size, sha256 over canonical JSON, plus the month hash) and
`latest/hashes.json` indexes them. The site publishes them as is:

- [`/integrity`](https://commonshub.brussels/integrity) — every month, expandable to its providers, with how to verify.
- [`/api/integrity`](https://commonshub.brussels/api/integrity) and `/api/integrity/YYYY/MM` — the manifests raw.
- [`/status`](https://commonshub.brussels/status) and `status.json` — the newest month's hash.

Anyone holding the same sources runs `chb integrity YYYY/MM --json` and
compares provider by provider (`src/lib/integrity.ts`).

## 2. Nostr: the record of what happens at the hub

The full event-level reference, kept next to the code so it never drifts,
is [`public/docs/nostr.md`](../public/docs/nostr.md), published at
[commonshub.brussels/docs/nostr.md](https://commonshub.brussels/docs/nostr.md).
The pure builders and parsers are `src/lib/nostr-conventions.ts` (unit
tests in `tests/nostr-conventions.test.ts`); relay access is
`src/lib/nostr-server.ts`; the browser side is `src/components/nostr-provider.tsx`.
It follows [commonshub.dev/docs](https://commonshub.dev/docs) (Elinor, for
Telegram groups): swap `telegram` for `discord`.

### Relays and tags

- `wss://relay.commonshub.brussels` (primary; writes only from allow-listed
  keys and keys they attest) and `wss://relay.commonshub.dev` (backup, open).
  Publish to both, read from both, merge by id.
- Every event carries the community `["i","discord:1280532848604086365"]`
  + `["k","discord"]` and the app that produced it
  `["t","app:<your app>"]` + NIP-89 `["client",…]`. Filter a community with
  `{"#i":[…]}`, an app with `{"#t":["app:…"]}`. Use your own app name.

### Identity

- A member is an npub; a member may have several keys.
- **kind 0** (by the member): name, picture, NIP-39 claim `["i","discord:<user id>"]`.
- **kind 31926 attestation** (by an identity provider, today this site):
  `d = discord:<user id>`, `p` = every key verified for that member,
  `["role","steward"]` when they hold a steward role on Discord. Republish
  replaces the list. The site's pubkey: [`/api/nostr/identity`](https://commonshub.brussels/api/nostr/identity).
- Another app may publish its own attestations under its own key; readers
  choose which providers they trust (`parseAttestations(events, providers)`).

### Shifts: read, sign up, cancel — from any app

The coordinator (today the site; `settings.nostr.coordinatorNpub` hands it
to a bot) publishes one **kind 31923** occurrence per slot per day,
`d = shift-<guild>-<YYYY-MM-DD>-<HHMM>`, slots and capacity as the Discord
bot's `/shifts`: 08:30–11:30, 11:30–14:30, 14:30–17:30, 17:30–20:30,
20:30–22:30, three people each.

**To read who is on a shift** for a day:

1. `{"kinds":[31925],"#a":["31923:<coordinator>:shift-<guild>-<date>-0830", …]}`
2. `{"kinds":[31926],"authors":[<providers you trust>],"#p":[<authors>]}` and
   `{"kinds":[0],"authors":[<authors>]}` to name them.
3. Per (attendee, slot) keep the newest RSVP whoever signed it; keep
   `status = accepted`. The attendee is the `["discord",…]` tag when present
   (an on-behalf RSVP, valid only from a steward or the coordinator),
   otherwise the author's attested Discord id.

**To sign up**, publish a **kind 31925** signed by the member's key:

```json
{"kind":31925,"tags":[
  ["a","31923:<coordinator>:shift-<guild>-<date>-<HHMM>"],
  ["d","rsvp-<guild>-<date>-<HHMM>"],
  ["status","accepted"],
  ["p","<coordinator>"],["t","shift"],
  ["i","discord:<guild>"],["k","discord"],["t","app:<your app>"]
],"content":"Signed up for the 08:30–11:30 shift on 2026-09-22"}
```

**To cancel**, republish the same `d` with `["status","declined"]`.

**On behalf of someone** (stewards): sign with the steward's key, add
`["discord","<attendee user id>"]`, `["name","<attendee>"]`,
`["t","on-behalf"]`, and use `d = rsvp-<guild>-<date>-<HHMM>-discord:<attendee user id>`.
Cancel by republishing that `d` with `declined`. Because the newest RSVP
per (attendee, slot) wins regardless of signer, a member can undo a
steward's booking with their own `declined`, and a steward can undo a
member's.

For a key to be accepted by `relay.commonshub.brussels` it must be
allow-listed or attested (`p` tag in a kind 31926) by an allow-listed key.
A member who has used the site once is attested; a bot needs its key
allow-listed once (ask a steward).

**What the site adds on top** — not part of the protocol, other apps may do
the same: after a sign-up it makes sure the occurrence and the NIP-72
community definition (`kind 34550`, `d = dc<guild>`) exist, and posts one
line in `#shifts` on Discord worded like the bot's `/shifts`
(`shiftDiscordLine` in `src/lib/day-data.ts`), naming the steward when it
was on behalf. The day page (`/YYYY/MM/DD`, `/today`) is a view of the
relays: stewards see a member picker next to each slot; everyone sees who
signed whom up.

### Annotations

Members also annotate transactions and counterparties (category, name,
description) with signed events that `chb` picks up from the relays and
folds into the dataset — the site's only durable "write" path. See
`src/components/nostr-provider.tsx` (`useAnnotation`) for the shapes.
