import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface MoneyFlowBreakdownRow {
  key: string;
  label: string;
  income: number;
  expenses: number;
  net: number;
}

interface MoneyFlowSankeyProps {
  income: number;
  expenses: number;
  net: number;
  incomeBreakdown?: MoneyFlowBreakdownRow[];
  expenseBreakdown?: MoneyFlowBreakdownRow[];
  openingBalance?: number | null;
  closingBalance?: number | null;
  title?: string;
  /** Rendered top-right of the card header, e.g. a link to all transactions. */
  action?: React.ReactNode;
}

// ── layout ─────────────────────────────────────────────────────────────────
//
// A real Sankey: every band is as tall as the money it carries, on one scale
// for the whole picture, so the sources stack, the treasury bar and the uses
// stack are all the same height. Labels sit outside the bands (left of the
// sources, right of the uses) so nothing is ever drawn over text.

export const SVG_WIDTH = 960;
const LABEL_COLUMN = 190; // room for a label on each side
const NODE_WIDTH = 18;
const LEFT_X = LABEL_COLUMN;
const RIGHT_X = SVG_WIDTH - LABEL_COLUMN - NODE_WIDTH;
const CENTER_X = SVG_WIDTH / 2 - NODE_WIDTH / 2;
const TOP = 64; // below the column headings
const BOTTOM = 24;
const GAP = 14; // between stacked nodes
/** A node never gets thinner than this, so its two-line label has a home. */
const MIN_NODE = 34;
const MAX_ROWS = 6;

export type NodeKind = "source" | "opening" | "use" | "closing" | "treasury";

export interface LayoutNode {
  id: string;
  label: string;
  value: number;
  kind: NodeKind;
  x: number;
  y: number;
  height: number;
}

export interface LayoutLink {
  id: string;
  from: LayoutNode;
  to: LayoutNode;
  value: number;
  /** Top of the band on each end, in SVG units. */
  fromY: number;
  toY: number;
  height: number;
  kind: NodeKind;
}

export interface MoneyFlowLayout {
  width: number;
  height: number;
  nodes: LayoutNode[];
  links: LayoutLink[];
  treasury: LayoutNode;
  opening: number;
  closing: number;
}

const COLORS: Record<NodeKind, string> = {
  source: "#16a34a",
  opening: "#d97706",
  use: "#dc2626",
  closing: "#2563eb",
  treasury: "#1e3a8a",
};

function rowsFor(rows: MoneyFlowBreakdownRow[] | undefined, side: "income" | "expenses", total: number, fallback: string) {
  const sorted = (rows ?? [])
    .map((row) => ({ id: row.key, label: row.label, value: side === "income" ? row.income : row.expenses }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);
  if (!sorted.length) return total > 0 ? [{ id: fallback.toLowerCase(), label: fallback, value: total }] : [];
  // A row too small to show as a band of its own (under 2.5% of the side)
  // is folded into "Other" rather than padded up to a labelled node.
  const floor = total * 0.025;
  const top = sorted.filter((row) => row.value >= floor).slice(0, MAX_ROWS);
  const rest = Math.max(0, total - top.reduce((sum, row) => sum + row.value, 0));
  if (rest > 0.5) top.push({ id: `${fallback.toLowerCase()}-other`, label: "Other", value: rest });
  return top;
}

/** Stack rows into a column; heights on `scale`, never under MIN_NODE. */
function stack(rows: Array<{ id: string; label: string; value: number; kind: NodeKind }>, x: number, scale: number): LayoutNode[] {
  let y = TOP;
  return rows.map((row) => {
    const height = Math.max(MIN_NODE, row.value * scale);
    const node: LayoutNode = { id: row.id, label: row.label, value: row.value, kind: row.kind, x, y, height };
    y += height + GAP;
    return node;
  });
}

function stackHeight(nodes: LayoutNode[]): number {
  if (!nodes.length) return 0;
  const last = nodes[nodes.length - 1];
  return last.y + last.height - TOP;
}

/**
 * Pure layout, so the geometry can be tested: every band's height equals
 * its value on the shared scale, and the picture is as tall as it needs.
 */
export function layoutMoneyFlow(props: Omit<MoneyFlowSankeyProps, "title" | "action">, targetHeight = 420): MoneyFlowLayout {
  const { income, expenses, net, incomeBreakdown, expenseBreakdown, openingBalance, closingBalance } = props;
  const opening = openingBalance ?? Math.max(0, (closingBalance ?? 0) - net);
  const closing = closingBalance ?? Math.max(0, opening + net);
  // The picture shows the month's money, not the whole bank balance: what
  // income did not cover came out of the reserves, what was left over went
  // into them. Either way both sides add up to the same total.
  const openingUsed = Math.max(0, expenses - income);
  const closingFlow = Math.max(0, income - expenses);
  const total = Math.max(income + openingUsed, expenses + closingFlow, 1);

  const inflows = [
    ...(openingUsed > 0.5 ? [{ id: "opening-balance", label: "From reserves", value: openingUsed, kind: "opening" as const }] : []),
    ...rowsFor(incomeBreakdown, "income", income, "Income").map((row) => ({ ...row, kind: "source" as const })),
  ];
  const outflows = [
    ...rowsFor(expenseBreakdown, "expenses", expenses, "Expenses").map((row) => ({ ...row, kind: "use" as const })),
    ...(closingFlow > 0.5 ? [{ id: "closing-balance", label: "Added to reserves", value: closingFlow, kind: "closing" as const }] : []),
  ];

  // One scale for everything: the taller stack must fit the target height
  // once gaps and minimum node heights are accounted for.
  const fits = (rows: Array<{ value: number }>, scale: number) =>
    rows.reduce((sum, row) => sum + Math.max(MIN_NODE, row.value * scale), 0) + GAP * Math.max(0, rows.length - 1);
  let scale = targetHeight / total;
  for (let i = 0; i < 8; i++) {
    const tallest = Math.max(fits(inflows, scale), fits(outflows, scale), 1);
    if (tallest <= targetHeight + 0.5) break;
    scale *= targetHeight / tallest;
  }

  const sources = stack(inflows, LEFT_X, scale);
  const uses = stack(outflows, RIGHT_X, scale);
  // Bands keep their true share of the treasury; a node padded to MIN_NODE
  // simply gets a band thinner than itself, joined at the node's middle.
  const bandHeight = (value: number) => value * scale;
  const treasuryHeight = Math.max(MIN_NODE, total * scale);
  const columnHeight = Math.max(stackHeight(sources), stackHeight(uses), treasuryHeight);
  const treasury: LayoutNode = {
    id: "treasury",
    label: "Treasury",
    value: total,
    kind: "treasury",
    x: CENTER_X,
    y: TOP + (columnHeight - treasuryHeight) / 2,
    height: treasuryHeight,
  };

  const links: LayoutLink[] = [];
  let inY = treasury.y;
  for (const node of sources) {
    const height = bandHeight(node.value);
    links.push({ id: `in-${node.id}`, from: node, to: treasury, value: node.value, fromY: node.y + (node.height - height) / 2, toY: inY, height, kind: node.kind });
    inY += height;
  }
  let outY = treasury.y;
  for (const node of uses) {
    const height = bandHeight(node.value);
    links.push({ id: `out-${node.id}`, from: treasury, to: node, value: node.value, fromY: outY, toY: node.y + (node.height - height) / 2, height, kind: node.kind });
    outY += height;
  }

  return {
    width: SVG_WIDTH,
    height: TOP + columnHeight + BOTTOM,
    nodes: [...sources, treasury, ...uses],
    links,
    treasury,
    opening,
    closing,
  };
}

/** A filled band between two vertical segments. */
function bandPath(link: LayoutLink): string {
  const x0 = link.from.x + NODE_WIDTH;
  const x1 = link.to.x;
  const c0 = x0 + (x1 - x0) * 0.5;
  const c1 = x1 - (x1 - x0) * 0.5;
  const top0 = link.fromY;
  const top1 = link.toY;
  const bot0 = link.fromY + link.height;
  const bot1 = link.toY + link.height;
  return `M ${x0} ${top0} C ${c0} ${top0}, ${c1} ${top1}, ${x1} ${top1} L ${x1} ${bot1} C ${c1} ${bot1}, ${c0} ${bot0}, ${x0} ${bot0} Z`;
}

// ── formatting ─────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

/** €575, €3,224, €25.7K: exact while it fits a label, compact beyond. */
function shortCurrency(value: number): string {
  if (Math.abs(value) < 10000) return formatCurrency(value);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function truncate(label: string, max = 24): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

// ── component ──────────────────────────────────────────────────────────────

export function MoneyFlowSankey(props: MoneyFlowSankeyProps) {
  const { income, expenses, net, title = "Money flow", action } = props;
  const layout = layoutMoneyFlow(props);
  const { nodes, links, treasury } = layout;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle>{title}</CardTitle>
          <CardDescription>Where the money came from, and where it went.</CardDescription>
        </div>
        {action}
      </CardHeader>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
          <Stat label="Started with" value={formatCurrency(layout.opening)} tone="amber" />
          <Stat label="Income" value={formatCurrency(income)} tone="green" />
          <Stat label="Net change" value={`${net >= 0 ? "+" : ""}${formatCurrency(net)}`} tone={net >= 0 ? "green" : "red"} plain />
          <Stat label="Expenses" value={formatCurrency(expenses)} tone="red" />
          <Stat label="Ended with" value={formatCurrency(layout.closing)} tone="blue" />
        </div>

        <div
          className="overflow-x-auto rounded-xl border bg-background"
          role="img"
          aria-label={`Money flow: ${formatCurrency(income)} income and ${formatCurrency(expenses)} expenses through the treasury`}
        >
          <svg viewBox={`0 0 ${layout.width} ${layout.height}`} className="w-full min-w-[720px]" style={{ height: "auto" }} aria-hidden="true">
            <text x={LEFT_X + NODE_WIDTH} y={30} textAnchor="end" className="fill-muted-foreground text-[11px] font-semibold uppercase tracking-[0.18em]">Sources</text>
            <text x={SVG_WIDTH / 2} y={30} textAnchor="middle" className="fill-muted-foreground text-[11px] font-semibold uppercase tracking-[0.18em]">Treasury</text>
            <text x={RIGHT_X} y={30} textAnchor="start" className="fill-muted-foreground text-[11px] font-semibold uppercase tracking-[0.18em]">Uses</text>
            <text x={SVG_WIDTH / 2} y={48} textAnchor="middle" className="fill-foreground text-[13px] font-semibold">{formatCurrency(treasury.value)}</text>

            {links.map((link) => (
              <path key={link.id} d={bandPath(link)} fill={COLORS[link.kind]} fillOpacity={0.28}>
                <title>{`${link.from.label} → ${link.to.label}: ${formatCurrency(link.value)}`}</title>
              </path>
            ))}

            {nodes.map((node) => {
              const onLeft = node.x === LEFT_X;
              const onRight = node.x === RIGHT_X;
              const labelX = onLeft ? node.x - 12 : node.x + NODE_WIDTH + 12;
              const midY = node.y + node.height / 2;
              return (
                <g key={node.id}>
                  <rect x={node.x} y={node.y} width={NODE_WIDTH} height={node.height} rx="5" fill={COLORS[node.kind]}>
                    <title>{`${node.label}: ${formatCurrency(node.value)}`}</title>
                  </rect>
                  {(onLeft || onRight) && (
                    <>
                      <text x={labelX} y={midY - 3} textAnchor={onLeft ? "end" : "start"} className="fill-foreground text-[13px] font-semibold">
                        {truncate(node.label)}
                      </text>
                      <text x={labelX} y={midY + 14} textAnchor={onLeft ? "end" : "start"} className="fill-muted-foreground text-[12px]">
                        {shortCurrency(node.value)}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, tone, plain }: { label: string; value: string; tone: "amber" | "green" | "red" | "blue"; plain?: boolean }) {
  const tones = {
    amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300",
    green: "border-green-200 bg-green-50 text-green-700 dark:border-green-900/60 dark:bg-green-950/20 dark:text-green-300",
    red: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300",
    blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-300",
  };
  const textOnly = { amber: "text-amber-700", green: "text-green-600", red: "text-red-600", blue: "text-blue-700" };
  return (
    <div className={`rounded-xl border p-3 ${plain ? "bg-background shadow-xs" : tones[tone]}`}>
      <div className="text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${plain ? textOnly[tone] : ""}`}>{value}</div>
    </div>
  );
}
