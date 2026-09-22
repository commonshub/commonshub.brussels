import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { type FlowTotals, formatMoney } from "@/lib/finance-view"

export function FlowSummary({ flow, symbol, title, description }: { flow: FlowTotals; symbol: string; title: string; description: string }) {
  const net = flow.incoming - flow.outgoing
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <div className="text-sm text-muted-foreground mb-1">Total Incoming</div>
            <div className="text-2xl font-bold text-green-600">+{formatMoney(flow.incoming, symbol, false)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Total Outgoing</div>
            <div className="text-2xl font-bold text-red-600">-{formatMoney(flow.outgoing, symbol, false)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Net Change</div>
            <div className={`text-2xl font-bold ${net >= 0 ? "text-green-600" : "text-red-600"}`}>
              {net >= 0 ? "+" : ""}
              {formatMoney(net, symbol, false)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/** One linked row per period or account: label, count, +in / -out (and net). */
export function FlowRows({ title, description, rows }: { title: string; description: string; rows: Array<{ key: string; href: string; label: string; sub: string; flow: FlowTotals; symbol: string; showNet?: boolean }> }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {rows.map((row) => {
            const net = row.flow.incoming - row.flow.outgoing
            return (
              <a key={row.key} href={row.href} className="block p-4 bg-muted/20 rounded-lg hover:bg-muted/30 transition-colors">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold">{row.label}</div>
                    <div className="text-sm text-muted-foreground">{row.sub}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-green-600">+{formatMoney(row.flow.incoming, row.symbol, false)}</div>
                    <div className="text-sm text-red-600">-{formatMoney(row.flow.outgoing, row.symbol, false)}</div>
                    {row.showNet && (
                      <div className={`text-sm font-semibold ${net >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {net >= 0 ? "+" : ""}
                        {formatMoney(net, row.symbol, false)}
                      </div>
                    )}
                  </div>
                </div>
              </a>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
