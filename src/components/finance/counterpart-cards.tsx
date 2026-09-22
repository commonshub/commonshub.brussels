import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CounterpartNetwork } from "./counterpart-network"
import { type CounterpartSummary, formatMoney, positionCounterparts } from "@/lib/finance-view"

function Column({ title, tone, items, pick, symbol }: { title: string; tone: "green" | "red"; items: CounterpartSummary[]; pick: (c: CounterpartSummary) => number; symbol: string }) {
  const text = tone === "green" ? "text-green-600" : "text-red-600"
  const sign = tone === "green" ? "+" : "-"
  return (
    <div>
      <h3 className={`text-lg font-semibold mb-3 ${text}`}>{title}</h3>
      <div className="space-y-2">
        {items.slice(0, 10).map((cp) => (
          <div key={cp.name} className="flex justify-between items-center p-3 bg-muted/20 rounded-lg">
            <div>
              <div className="font-medium">{cp.name}</div>
              <div className="text-xs text-muted-foreground">
                {cp.transactionCount} transaction{cp.transactionCount > 1 ? "s" : ""}
              </div>
            </div>
            <div className="text-right">
              <div className={`font-semibold ${text}`}>
                {sign}
                {formatMoney(pick(cp), symbol, false)}
              </div>
              <div className="text-xs text-muted-foreground">{symbol}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Who the money came from and went to. Shown only when the tier names
 * counterparties (members); with enough of each side it becomes the network.
 */
export function CounterpartCards({ customers, vendors, symbol, period }: { customers: CounterpartSummary[]; vendors: CounterpartSummary[]; symbol: string; period: string }) {
  if (customers.length === 0 && vendors.length === 0) return null
  const network = customers.length >= 3 && vendors.length >= 3
  return (
    <Card className="mb-6 overflow-hidden">
      <CardHeader>
        <CardTitle>{network ? "Transaction Network" : "Top Counterparts"}</CardTitle>
        <CardDescription>Customers and vendors for {period}</CardDescription>
      </CardHeader>
      <CardContent className={network ? "p-6" : undefined}>
        {network ? (
          <CounterpartNetwork counterparts={positionCounterparts(customers, vendors)} symbol={symbol} />
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {customers.length > 0 && <Column title="Customers (Incoming)" tone="green" items={customers} pick={(c) => c.totalIncoming} symbol={symbol} />}
            {vendors.length > 0 && <Column title="Vendors (Outgoing)" tone="red" items={vendors} pick={(c) => c.totalOutgoing} symbol={symbol} />}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
