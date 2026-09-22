import type { PositionedCounterpart } from "@/lib/finance-view"
import { formatMoney } from "@/lib/finance-view"

/** Customers left, vendors right, the hub in the middle. Pure SVG, renders on the server. */
export function CounterpartNetwork({ counterparts, symbol }: { counterparts: PositionedCounterpart[]; symbol: string }) {
  return (
    <div className="w-full h-[600px] relative bg-gradient-to-br from-background to-muted/20 rounded-lg">
      <svg width="100%" height="100%" viewBox="0 0 1200 600">
        <defs>
          <linearGradient id="customerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="vendorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>
        </defs>

        {counterparts.map((cp, idx) => {
          const isCustomer = cp.side === "customer"
          const value = isCustomer ? cp.totalIncoming : cp.totalOutgoing
          const color = isCustomer ? "#10b981" : "#ef4444"
          return (
            <g key={idx} style={{ cursor: "pointer" }}>
              <title>
                {cp.name}
                {"\n"}
                {cp.transactionCount} transaction{cp.transactionCount > 1 ? "s" : ""}
                {"\n"}
                {isCustomer ? "+" : "-"}
                {formatMoney(value, symbol)}
              </title>
              <line x1={cp.x} y1={cp.y} x2="600" y2="300" stroke={color} strokeWidth={cp.linkWeight} opacity="0.5" />
              <circle cx={cp.x} cy={cp.y} r={cp.radius} fill={isCustomer ? "url(#customerGrad)" : "url(#vendorGrad)"} stroke={color} strokeWidth="2" opacity="0.9" />
              <text x={cp.x} y={cp.y - 5} textAnchor="middle" fill="white" fontSize="12" fontWeight="600" pointerEvents="none">
                {cp.name.length > 15 ? cp.name.slice(0, 13) + "..." : cp.name}
              </text>
              <text x={cp.x} y={cp.y + 10} textAnchor="middle" fill="white" fontSize="14" fontWeight="700" pointerEvents="none">
                {isCustomer ? "+" : "-"}
                {formatMoney(value, symbol, false)}
              </text>
            </g>
          )
        })}

        <circle cx="600" cy="300" r="60" fill="#FF4C02" stroke="#fff" strokeWidth="3" />
        <svg x="560" y="260" width="80" height="80" viewBox="0 0 500 500">
          <path
            d="M213.528 91L126.722 141.505L201.691 225.154L92 201.48V302.49L201.691 280.394L126.722 359.308L213.528 409.813L250.223 303.632L286.918 409.813L373.723 359.308L298.755 280.394L408.446 302.49V201.48L298.755 225.154L373.723 141.505L286.918 91L250.223 190.155L213.528 91Z"
            fill="#FBF4F2"
          />
        </svg>

        <text x="50" y="30" fill="#10b981" fontSize="14" fontWeight="600">
          ← Customers (Incoming)
        </text>
        <text x="1150" y="30" textAnchor="end" fill="#ef4444" fontSize="14" fontWeight="600">
          Vendors (Outgoing) →
        </text>
      </svg>
    </div>
  )
}
