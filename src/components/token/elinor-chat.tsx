/**
 * An example of booking a room through Elinor on Discord, drawn in
 * Discord's look: the member asks, Elinor proposes the booking with its
 * price in tokens, the member pays with tokens, and the room is booked.
 */

function Avatar({ letter, bg }: { letter: string; bg: string }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-bold text-white" style={{ background: bg }} aria-hidden>
      {letter}
    </span>
  )
}

function Message({ who, bot, color, letter, time, children }: { who: string; bot?: boolean; color: string; letter: string; time: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 px-4 py-2">
      <Avatar letter={letter} bg={color} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 text-[15px]">
          <span className="font-semibold" style={{ color: bot ? "#fff" : color }}>
            {who}
          </span>
          {bot && <span className="rounded bg-[#5865f2] px-1 py-px text-[10px] font-semibold uppercase leading-4 text-white">App</span>}
          <span className="text-xs text-[#949ba4]">{time}</span>
        </p>
        <div className="mt-0.5 space-y-1 text-[15px] leading-snug text-[#dbdee1]">{children}</div>
      </div>
    </div>
  )
}

const Button = ({ children, kind }: { children: React.ReactNode; kind: "green" | "grey" | "red" }) => (
  <span className={`inline-flex rounded px-4 py-1.5 text-sm font-medium text-white ${kind === "green" ? "bg-[#248046]" : kind === "red" ? "bg-[#da373c]" : "bg-[#4e5058]"}`}>{children}</span>
)

const Mention = ({ children }: { children: React.ReactNode }) => <span className="rounded bg-[#5865f2]/30 px-0.5 text-[#c9cdfb]">{children}</span>
const Small = ({ children }: { children: React.ReactNode }) => <p className="text-xs text-[#949ba4]">{children}</p>

export function ElinorChat({ className = "" }: { className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl bg-[#313338] font-sans shadow-lg ${className}`} role="img" aria-label="Example: a member asks Elinor on Discord to book the Mush Room; Elinor proposes it for 2 tokens, the member pays with tokens, and the room is booked.">
      <div className="flex items-center gap-2 border-b border-black/30 px-4 py-3 text-[15px] font-semibold text-white">
        <span className="text-xl text-[#80848e]">#</span> elinor
      </div>
      <div className="py-2">
        <Message who="Xavier" color="#f0b232" letter="X" time="Today at 10:02">
          <p>
            <Mention>@Elinor</Mention> can you book the Mush Room tomorrow from 14:00 to 16:00 for our reading circle?
          </p>
        </Message>
        <Message who="Elinor" bot color="#FF4C02" letter="E" time="Today at 10:02">
          <p>
            🤖 <strong className="text-white">Elinor proposes a room booking</strong> for <Mention>@Xavier</Mention> to confirm
          </p>
          <p>
            Book <strong className="text-white">Mush Room</strong> on <strong className="text-white">Tue 27 Oct, 14:00–16:00</strong> for “Reading circle”
          </p>
          <p>💰 2 tokens</p>
          <Small>Asked by Xavier · only @Xavier can confirm · expires in 24 hours</Small>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button kind="green">Pay with tokens</Button>
            <Button kind="grey">Cancel</Button>
          </div>
        </Message>
        <Message who="Elinor" bot color="#FF4C02" letter="E" time="Today at 10:03">
          <p>
            ✅ <strong className="text-white">Booked 1 date!</strong>
          </p>
          <p>
            <strong className="text-white">Event:</strong> Reading circle
            <br />
            <strong className="text-white">Room:</strong> Mush Room
            <br />✅ Tue 27/10 14:00–16:00
            <br />
            <strong className="text-white">Paid:</strong> 2 tokens
          </p>
          <p className="text-[#00a8fc]">View transaction · Mush Room calendar</p>
        </Message>
      </div>
    </div>
  )
}

/** An example from the offers and needs market: a need in #needs, a member who helps, paid with /send. */
export function MarketChat({ className = "" }: { className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl bg-[#313338] font-sans shadow-lg ${className}`} role="img" aria-label="Example: a member asks in #needs for help fixing their bike, another member helps, and gets 2 tokens with /send.">
      <div className="flex items-center gap-2 border-b border-black/30 px-4 py-3 text-[15px] font-semibold text-white">
        <span className="text-xl text-[#80848e]">#</span> needs
      </div>
      <div className="py-2">
        <Message who="Ana" color="#57a5f2" letter="A" time="Today at 09:15">
          <p>Anyone around who could help me fix the brakes of my bike this week? 🚲 2 tokens for it!</p>
        </Message>
        <Message who="Tom" color="#3ba55c" letter="T" time="Today at 09:40">
          <p>I can do it on Thursday at lunch, bring it to the hub 🔧</p>
        </Message>
        <Message who="Ana" color="#57a5f2" letter="A" time="Thursday at 13:30">
          <p>Thanks Tom, they work like new! 🙏</p>
        </Message>
        <Message who="Commons Hub" bot color="#FF4C02" letter="C" time="Thursday at 13:31">
          <p className="text-xs text-[#949ba4]">Ana used /send</p>
          <p>
            ✅ Sent <strong className="text-white">2 tokens</strong> to <Mention>@Tom</Mention>
          </p>
          <p className="text-xs text-[#949ba4]">For: fixing my bike&apos;s brakes</p>
        </Message>
      </div>
    </div>
  )
}
