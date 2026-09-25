# commonshub.brussels on Nostr

The community relays are the record of what happens at the Commons Hub.
Discord, this website and any bot are just ways to read and write it. This
page says exactly what the website publishes, so any other app — the
Discord bot, a calendar, an agent — can read the same events and add its own.
It follows the conventions of [commonshub.dev/docs](https://commonshub.dev/docs),
which does the same for Telegram groups: swap `telegram` for `discord`.

Live view of what this site knows about itself: [/api/nostr/identity](/api/nostr/identity).

## Relays

| Relay | Role |
|---|---|
| `wss://relay.commonshub.brussels` | primary; open reads, writes for community members (see *Who can write*) |
| `wss://relay.commonshub.dev` | backup; open |

Everything is published to both and read back from both, merged.

## Two tags on every event

| Tag | Meaning | Filter |
|---|---|---|
| `["i","discord:<guild id>"]` + `["k","discord"]` | the community (the Discord server) | `{"#i":["discord:1280532848604086365"]}` |
| `["t","app:commonshub.brussels"]` + `["client","commonshub.brussels","31990:<site pubkey>:web"]` | the app that produced it (NIP-89 `client` for display, `t` for filtering) | `{"#t":["app:commonshub.brussels"]}` |

## Identity

A member is an npub. Their browser holds a key (generated on first visit,
kept in `localStorage`); a member may have several, one per device.

- **Profile — kind 0** (signed by the member): `name`, `display_name`,
  `picture` taken from their Discord profile, with a NIP-39 claim
  `["i","discord:<user id>"]`, `["k","discord"]`.
- **Attestation — kind 31926** (signed by the site, acting as identity
  provider): `d = discord:<user id>`, one `p` tag per key the site has
  verified for that member (they signed in with Discord and used the key),
  one `["role","steward"]` tag when the member holds a steward role on
  Discord, `content = {"name": "…", "roles": ["steward"]}`. Addressable:
  each republish carries the complete current list; a key missing from it
  is unlinked, a role missing from it is revoked.

To keep a `discord user id → [npubs]` map, subscribe to
`{"kinds":[31926],"authors":["<site pubkey>"]}`; the site's pubkey is in
[/api/nostr/identity](/api/nostr/identity). Other apps can publish their own
attestations under their own key; consumers merge them.

### Who can write on relay.commonshub.brussels

The relay accepts an event when its author is on the allow-list, **or** when
the author's key appears as a `p` tag in a kind 31926 attestation published
by an allow-listed key. So: allow-list your app's key once, and the members
it attests can write with their own keys. Drop a `p` tag to revoke.

## Shifts (NIP-52)

- **Occurrence — kind 31923** (signed by the coordinator: the Discord bot,
  `npub1828zsgu6xv0j0y0axr4agq5uf0yh8djxtd89guqgg8vuymqgc8es3ge93h`, see
  *Two apps, one record* below): `d = shift-<guild id>-<YYYY-MM-DD>-<HHMM>`, `title`,
  `start`/`end` (unix seconds, Brussels time), `capacity`, `["t","shift"]`,
  `["t","group-<guild id>"]`, `["a","34550:<coordinator>:dc<guild id>"]`.
  Slots and capacity are the Discord bot's: 08:30–11:30, 11:30–14:30,
  14:30–17:30, 17:30–20:30, 20:30–22:30, three people each.
- **RSVP — kind 31925** (signed by the member): `["a","31923:<coordinator>:shift-…"]`,
  `d = rsvp-<guild id>-<date>-<HHMM>`, `status` = `accepted` or `declined`,
  `["p","<coordinator>"]`, `["t","shift"]`. Cancelling is republishing with
  `declined`.
- **RSVP on behalf of someone** (signed by a steward): the same, plus
  `["discord","<attendee user id>"]`, `["name","<attendee>"]`, `["t","on-behalf"]`
  and `d = rsvp-<guild id>-<date>-<HHMM>-discord:<attendee user id>` (one
  `d` per attendee, so a steward can book several people). Readers honour
  it only when the signer's attestation carries `["role","steward"]`, or the
  signer is the coordinator itself (the site's own older sign-ups).

  **Who is on a shift** = per (attendee, slot) the newest accepted RSVP,
  whoever signed it. The attendee is the `discord` tag when present, else
  the author's attested Discord id. So a member can cancel what a steward
  booked for them (their own `declined` RSVP for that slot, newer), and a
  steward can cancel what a member booked (a `declined` on-behalf RSVP).
- **Community — kind 34550** (NIP-72, signed by the site): `d = dc<guild id>`.

Read a day's sign-ups: `{"kinds":[31925],"#a":["31923:<coordinator>:shift-<guild>-<date>-0830", …]}`,
then name the authors through the attestations (`{"kinds":[31926],"#p":[…]}`)
and their profiles (`{"kinds":[0],"authors":[…]}`). The reference
implementation is `parseSignups` in
[`src/lib/nostr-conventions.ts`](https://github.com/commonshub/commonshub.brussels/blob/main/src/lib/nostr-conventions.ts),
pure and unit-tested; the whole protocol from another app's point of view
is in [`docs/website.md`](https://github.com/commonshub/commonshub.brussels/blob/main/docs/website.md).

## Two apps, one record

The Discord bot's `/shifts` command ([opencollective/token-bot](https://github.com/opencollective/token-bot),
`src/lib/shifts-nostr.ts`) writes and reads the same events:

- it is the **coordinator**: it publishes a slot's occurrence (kind 31923)
  once that slot has its first sign-up, from either app, and the community
  definition (kind 34550), under `settings.nostr.coordinatorNpub`;
- Discord members have no key of their own, so the bot **derives one key per
  member** from its secret and attests it (kind 31926, `d = discord:<id>`),
  with a kind 0 profile taken from Discord. RSVPs made in Discord are signed
  by that derived key;
- it **tags its events** `["client","token-bot",…]` and `["t","app:token-bot"]`,
  so the monitor can tell the two apps apart;
- it keeps its Google Calendar (invites, rewards) in sync with the relays:
  a sign-up made here shows in `/shifts` within seconds, a cancellation made
  in Discord shows here on the next page load.

Both apps trust each other's attestations (the site trusts itself and the
coordinator; the bot trusts itself and the site), and both resolve the newest
RSVP per (member, slot) whoever signed it, so a member can sign up in one app
and cancel in the other.

## What the site does on a sign-up

1. The browser asks the site to link its key: the site publishes/refreshes the
   member's attestation, and hands back a profile to sign if the key has none.
2. The browser signs the RSVP with the member's key and sends it to both relays.
3. The site checks the RSVP is on a relay (the occurrence itself is the
   bot's: it publishes it within seconds of this first sign-up; the RSVP
   already points at its coordinate) and posts one line in `#shifts` on Discord, worded like the
   bot's `/shifts` command.

Nothing is stored on the web server.

## Expenses: tags and comments

Every expense on the site has a page, `/expenses/<slug>`, and an identifier
on Nostr (NIP-73 style):

| Expense | Page | Identifier |
|---|---|---|
| A recurring cost (rent, furniture, electricity, …) | `/expenses/rent` | `chb:expense:rent` |
| A bill from our books | `/expenses/chb-s-2026-09-0011` (its accounting reference) | `chb:bill:<chb public id>`, e.g. `chb:bill:b-b7e6ee1b53` |

The bill identifier is chb's stable public id, the same on every copy of
the same Odoo database; it does not reveal the Odoo record.

- **Tags** — a kind 1111 annotation snapshot, exactly as for transactions:
  `["i","<identifier>"]`, `["k","chb:expense"|"chb:bill"]`, then
  `["category", …]`, `["collective", …]`; the content is a description.
  The newest snapshot per identifier wins.
- **Comments** — NIP-22, kind 1111, top-level comment on external content:
  `["I","<identifier>"]`, `["K", kind]`, `["i","<identifier>"]`, `["k", kind]`,
  `["a","34550:<site pubkey>:dc<guild id>"]` (the community), `["t","app:commonshub.brussels"]`,
  `["client", …]`. The **uppercase `I`** is what tells a comment from an
  annotation snapshot; readers of annotations must skip events that have one.
  Read an expense's thread with `{"kinds":[1111],"#I":["<identifier>"]}`.

Everything goes to relay.commonshub.brussels (and the backup relay). A
member's browser key is linked to their Discord account (a kind 31926
attestation) as soon as they sign in, which is what lets the relay accept
their tags and comments.
