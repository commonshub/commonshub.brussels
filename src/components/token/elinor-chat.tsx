/**
 * An example of booking a room through Elinor on Discord, drawn in
 * Discord's look with the bot's real wording (token-bot proposals.ts and
 * /book): the member asks, Elinor proposes, the member confirms, sees the
 * summary, pays in tokens, and the room is booked.
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
    <div className={`overflow-hidden rounded-2xl bg-[#313338] font-sans shadow-lg ${className}`} role="img" aria-label="Example: a member asks Elinor on Discord to book the Mush Room; Elinor proposes it, the member confirms and pays 2 tokens, and the room is booked.">
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
          <p>💰 2 tokens or €80 (+ VAT): you choose and pay in the next step</p>
          <Small>Asked by Xavier · only @Xavier can confirm · expires in 24 hours</Small>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button kind="green">Confirm, then pay</Button>
            <Button kind="grey">Cancel</Button>
          </div>
        </Message>
        <Message who="Elinor" bot color="#FF4C02" letter="E" time="Today at 10:03">
          <Small>👁 Only you can see this</Small>
          <p>
            📋 <strong className="text-white">Booking Summary</strong>
          </p>
          <p>
            <strong className="text-white">Event:</strong> Reading circle
            <br />
            <strong className="text-white">Room:</strong> Mush Room
            <br />
            <strong className="text-white">Duration:</strong> 2 hours, Tue 27 Oct 14:00–16:00
            <br />
            <strong className="text-white">Price:</strong> 2 tokens
            <br />
            <strong className="text-white">Your balance:</strong> 12 tokens
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button kind="green">Confirm &amp; pay</Button>
            <Button kind="red">Cancel</Button>
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
