# Publishing events to Mobilizon

Plan for a one-way sync that publishes our upcoming events to a Commons Hub
group on [mobilizon.be](https://mobilizon.be), so they reach the fediverse
without anyone re-posting them by hand. Registration stays on Luma.

Nothing of this is implemented yet. The API details below were checked against
mobilizon.be (Mobilizon 5.2.4) by introspecting its schema; verify again before
building if the instance has been upgraded since.

## Manual preparation

Before any code:

1. Create an account on mobilizon.be with a shared address
   (e.g. `hello@commonshub.brussels`), not a personal one. It becomes the bot
   account.
2. Create the group, e.g. `@commonshub`. The handle is permanent — moving later
   means losing followers.
3. Tell the mobilizon.be admins. It is a volunteer instance and an hourly bot
   posting events is worth a heads-up.
4. Collect the two IDs the API needs, from <https://mobilizon.be/graphiql> while
   logged in: the bot profile's actor ID (`organizerActorId`) and the group's ID
   (`attributedToId`).

## Source of truth

The sync reads `https://commonshub.brussels/api/events`, which already merges
the Luma feed with the events we host ourselves and carries stable IDs (the Luma
`api_id`, or `hosted-<slug>`). Reading the public API keeps the sync independent
of `DATA_DIR` and of website deploys.

Two gaps to close in this repo first:

- Events merged in from `src/settings/events/` carry no `location`, so Mobilizon
  would show no address. Either set it in `mergeHostedEvents`, or let the sync
  default an empty location to the hub address.
- Their URLs are relative (`/events/ocd-2026`); the sync has to make them
  absolute.

## Where the code lives

The `chb` pipeline (separate repo) already runs hourly on the host and owns
state, so a `chb publish mobilizon` command fits best. A `scripts/` entry in
this repo driven by a systemd timer works the same way — the sync needs network
access only, not the dataset.

## The sync

### Authentication

`login(email, password)` returns `accessToken` and `refreshToken`; send
`Authorization: Bearer <accessToken>`. Cache both in the state file and use the
`refreshToken` mutation instead of logging in every hour.

Configuration comes from the environment — `MOBILIZON_URL`, `MOBILIZON_EMAIL`,
`MOBILIZON_PASSWORD`, `MOBILIZON_ACTOR_ID`, `MOBILIZON_GROUP_ID` — via a systemd
`EnvironmentFile`. Never in git.

### State

One JSON file mapping our event ID to
`{ mobilizonId, uuid, hash, pictureMediaUuid }`. The hash covers the mapped
payload, so an unchanged event costs nothing.

Per run, for each event:

| Situation | Action |
| --- | --- |
| ID not in state | `createEvent` |
| ID in state, hash changed | `updateEvent` |
| ID gone from the feed, event still in the future | `updateEvent` with `status: CANCELLED` — kinder than deleting for people who already saw it |
| ID gone from the feed, event in the past | drop from state, leave the event alone |

### Field mapping

`createEvent` and `updateEvent` accept all of these:

| Mobilizon | From us |
| --- | --- |
| `title` | `name` |
| `description` | description as HTML, plus a closing line linking back to our page |
| `beginsOn` / `endsOn` | `start_at` / `end_at` |
| `physicalAddress` | the hub address: `street`, `locality`, `postalCode`, `country`, `timezone: "Europe/Brussels"`, `description` |
| `picture` | a `MediaInput`: `mediaUuid` from an earlier `uploadMedia(actorId, alt, file, name)`, or an inline multipart upload |
| `joinOptions: EXTERNAL` + `externalParticipationUrl` | the Luma URL, or our `/events/<slug>` page |
| `visibility: PUBLIC`, `tags` | fixed / from the event tags |
| `organizerActorId`, `attributedToId` | the bot profile and the group |

`joinOptions: EXTERNAL` matters: participation goes to Luma, so RSVPs do not
split across two systems.

Two things are easier to confirm by hand in graphiql than to guess:
`AddressInput.geom` is a plain string (Mobilizon uses `"lon;lat"`), and the
values of the `category` enum.

## Testing

- Unit tests against a fake API for the mapping, the hash and the
  create/update/cancel decisions. No network.
- A `--dry-run` flag that prints the payloads.
- `createEvent` takes a `draft` argument: the first live run posts drafts, which
  you check in the UI before dropping the flag.
- One live smoke test with a single event before the timer is enabled.

## Rollout

1. Close the location and absolute-URL gaps in this repo.
2. Write the sync with tests, dry-run only.
3. Live run in draft mode, check the result in the UI.
4. Enable the hourly timer and watch the first day.
5. Announce the group.

## Risks

- **Duplicates.** Do not also connect an external importer (kaihuri, Dindy) to
  the same group.
- **Loops.** If the events pipeline ever ingests Mobilizon feeds, exclude our
  own group.
- **ID drift.** A changed Luma event ID produces a duplicate. The state file
  makes that visible; a title-and-date fallback match would hide it, so prefer
  failing loudly at first.
- **Descriptions.** Ours are plain text from `htmlToPlainText`, while Mobilizon
  expects HTML and sanitizes it. Wrap paragraphs instead of passing raw text.

## Reference

- [Mobilizon GraphQL API](https://docs.mobilizon.org/5.%20Interoperability/3.graphql_api/)
- [API authentication](https://docs.mobilizon.org/5.%20Interoperability/2.api_auth/)
- [RSS/Atom and ICS feeds](https://docs.mobilizon.org/5.%20Interoperability/4.flux_rss_ics/) —
  the route for the other direction, pulling a Mobilizon group into our list
