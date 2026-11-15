/**
 * English and French for the VAT pages (/2023-2024 and the VAT box).
 * The language: ?lang=, else the "lang" cookie, else the browser's
 * Accept-Language; English by default.
 */

import type { Direction, RateClass } from "./vat-position"

export type Lang = "en" | "fr"

export function pickLang(param: string | undefined | null, cookie: string | undefined | null, acceptLanguage: string | undefined | null): Lang {
  for (const v of [param, cookie]) if (v === "fr" || v === "en") return v
  // The first language the browser prefers among ours.
  for (const part of (acceptLanguage ?? "").split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase()
    if (code === "fr" || code === "en") return code
  }
  return "en"
}

export const LOCALE: Record<Lang, string> = { en: "en-GB", fr: "fr-BE" }

export const RATE_LABELS: Record<Lang, Record<RateClass, string>> = {
  en: {
    "21": "21%",
    "12": "12%",
    "6": "6%",
    reverse_eu: "Reverse charge: a business in another EU country",
    export: "0%: customers outside the EU",
    reverse_noneu: "Reverse charge: suppliers outside the EU",
    receipt: "VAT paid, not deductible",
    exempt: "Exempt (0%)",
    outside: "Outside the scope of VAT",
    unknown: "Not estimated",
    before: "Before our VAT registration",
  },
  fr: {
    "21": "21 %",
    "12": "12 %",
    "6": "6 %",
    reverse_eu: "Autoliquidation : une entreprise d'un autre pays de l'UE",
    export: "0 % : clients hors de l'UE",
    reverse_noneu: "Autoliquidation : fournisseurs hors de l'UE",
    receipt: "TVA payée, non déductible",
    exempt: "Exonéré (0 %)",
    outside: "Hors du champ de la TVA",
    unknown: "Non estimé",
    before: "Avant notre assujettissement à la TVA",
  },
}

/** French for each category's label and the reason for its rate (English is in vat-position.ts). */
const RULES_FR: Record<string, { label: string; why: string }> = {
  "income:rental": { label: "Locations de salles", why: "Une salle louée avec son mobilier, son équipement et des services est une prestation taxable, pas la location exonérée d'un immeuble (art. 44 §3 2°)." },
  "income:room_rental": { label: "Locations de salles", why: "Une salle louée avec son mobilier, son équipement et des services est une prestation taxable, pas la location exonérée d'un immeuble." },
  "income:coworking": { label: "Coworking", why: "Un bureau avec internet, café et l'usage de l'espace : un service au taux normal." },
  "income:ticket": { label: "Billets d'événements", why: "L'entrée à nos conférences et ateliers : taux normal (le taux de 6 % vaut pour les événements culturels, sportifs et de divertissement, ce que la plupart des nôtres ne sont pas)." },
  "income:drinks": { label: "Boissons", why: "Les boissons servies sur place sont un service de restauration ; les boissons y sont toujours à 21 %." },
  "income:sponsoring": { label: "Sponsoring", why: "De la visibilité contre de l'argent est un service, taxé là où se trouve le client : 21 % pour un sponsor belge, pas de TVA belge pour une entreprise à l'étranger (grilles 44 et 47). La plupart de nos sponsors (Regen Village) étaient des entreprises étrangères, d'où l'absence d'estimation." },
  "income:catering": { label: "Restauration", why: "Repas servis : 12 % sur la nourriture (21 % sur les boissons)." },
  "income:consulting": { label: "Conseil", why: "Un service au taux normal." },
  "income:equipment": { label: "Matériel vendu", why: "Une vente de biens au taux normal." },
  "income:webservice": { label: "Services web", why: "Un service au taux normal." },
  "income:other_income": { label: "Autres ventes", why: "Considéré comme un service au taux normal." },
  "income:membership": { label: "Cotisations", why: "Les cotisations qu'une association perçoit de ses membres pour son objet statutaire, sans service individuel en échange, sont exonérées (art. 44 §2 11°)." },
  "income:donation": { label: "Dons", why: "Rien n'est donné en échange : ce n'est pas une livraison ni un service, donc pas de TVA." },
  "income:grant": { label: "Subventions privées (grants)", why: "Un financement de nos activités dans leur ensemble, sans contrepartie pour le bailleur : pas de TVA." },
  "income:subsidy": { label: "Subsides publics", why: "Un financement public non lié au prix d'un service : pas de TVA." },
  "income:loan": { label: "Prêts sans intérêt", why: "Des membres et soutiens ont prêté de l'argent au Hub pour démarrer, sans intérêt ; le Hub les rembourse en nature, en usage de l'espace (voir /debt). Un prêt est un financement, pas une vente : hors du champ de la TVA." },
  "expense:loan": { label: "Prêts remboursés", why: "Rembourser un prêt n'est pas un achat : hors du champ de la TVA." },
  "income:debt": { label: "Rechargements de jetons", why: "Les jetons prépayés (Brussels Pay, EURb, Zinne…) sont des bons, une dette jusqu'à ce qu'ils soient dépensés : la TVA est due sur ce qu'ils achètent alors, pas lors du rechargement." },
  "expense:consulting": { label: "Consultants et indépendants", why: "Des services de consultants et d'indépendants belges, facturés avec 21 % de TVA. Ceux établis à l'étranger, facturés sans TVA, sont en autoliquidation plus bas." },
  "expense:events": { label: "Événements", why: "Intervenants, lieux et services pour les événements : taux normal." },
  "expense:services": { label: "Services", why: "Taux normal." },
  "expense:other_expense": { label: "Autres dépenses", why: "Considérées au taux normal." },
  "expense:equipment": { label: "Matériel", why: "Des biens au taux normal." },
  "expense:supplies": { label: "Fournitures", why: "Des biens au taux normal." },
  "expense:catering": { label: "Restauration", why: "Repas et traiteur : 12 % sur la nourriture servie (6 % pour la nourriture achetée en magasin, 21 % pour les boissons)." },
  "expense:webservice": { label: "Logiciels et services web", why: "Taux normal. La plupart sont facturés depuis l'étranger : nous déclarons alors la TVA belge nous-mêmes (autoliquidation) et la déduisons dans la même déclaration." },
  "expense:fridge": { label: "Stock du frigo", why: "Nourriture et boissons non alcoolisées achetées pour le frigo : 6 % (21 % pour la bière et l'alcool)." },
  "expense:donation": { label: "Dons que nous avons faits", why: "Rien reçu en échange : ce n'est pas un achat." },
  "expense:donations_given": { label: "Dons que nous avons faits", why: "Rien reçu en échange : ce n'est pas un achat." },
  "expense:drinks": { label: "Boissons achetées", why: "Considérées au taux normal (les boissons non alcoolisées et l'eau achetées en magasin peuvent être à 6 %)." },
  "expense:travel": { label: "Déplacements", why: "Les billets de train internationaux sont sans TVA, et la TVA payée à l'étranger (un hôtel, un Airbnb) ne se déduit pas dans une déclaration belge." },
  "expense:marketing": { label: "Impression et merchandising", why: "Impression, autocollants, étiquettes et merchandising : taux normal." },
  "expense:accounting": { label: "Comptabilité et juridique", why: "Des services au taux normal." },
  "expense:furniture": { label: "Mobilier", why: "Des biens au taux normal." },
  "expense:maintenance": { label: "Entretien", why: "Matériaux de bricolage et réparations : taux normal." },
  "expense:utilities": { label: "Énergie et eau", why: "Factures d'énergie et d'eau : taux normal (6 % pour l'eau)." },
  "expense:internet": { label: "Télécommunications", why: "Taux normal." },
  "expense:coffee": { label: "Café", why: "Café en grains et nourriture achetés en magasin : 6 %." },
  "expense:bank_fees": { label: "Frais bancaires", why: "Les services bancaires sont exonérés (art. 44 §3 5°)." },
  "expense:expense": { label: "Dépenses remboursées", why: "Ce que des bénévoles et l'équipe ont acheté pour le Hub (courses, consommables…) et que nous avons remboursé. Ils ont payé la TVA, mais sur un ticket, pas une facture à notre nom : nous ne pouvons pas la déduire." },
  "expense:reimbursement": { label: "Dépenses remboursées", why: "Ce que des bénévoles et l'équipe ont acheté pour le Hub (courses, consommables…) et que nous avons remboursé. Ils ont payé la TVA, mais sur un ticket, pas une facture à notre nom : nous ne pouvons pas la déduire." },
  "expense:expense_reimbursement": { label: "Dépenses remboursées", why: "Ce que des bénévoles et l'équipe ont acheté pour le Hub et que nous avons remboursé : TVA payée sur un ticket, non déductible." },
  "expense:rent": { label: "Loyer", why: "La location d'un immeuble est exonérée (art. 44 §3 2°), sauf si le propriétaire a opté pour la TVA." },
  "expense:insurance": { label: "Assurances", why: "Les assurances sont exonérées (art. 44 §3 4°) ; une taxe sur les assurances s'applique à la place." },
  "expense:stripe_fee": { label: "Frais de paiement", why: "Le traitement des paiements est un service financier, exonéré (art. 44 §3 5°)." },
  "expense:HR": { label: "Cotisations sociales", why: "Les cotisations de sécurité sociale payées via le secrétariat social ne sont pas une livraison ni un service." },
  "expense:salaries": { label: "Salaires", why: "Les salaires ne sont pas une livraison ni un service." },
  "expense:taxes": { label: "Taxes", why: "Les taxes ne sont pas une livraison ni un service." },
  "expense:refund": { label: "Remboursements", why: "De l'argent que nous avons rendu, moins les remboursements reçus : ce n'est pas un achat." },
  "expense:debt": { label: "Jetons remboursés", why: "Le paiement de soldes de jetons, pas un achat." },
}

const UNKNOWN_FR = { label: "Pas encore catégorisé", why: "Pas encore de catégorie, donc aucun taux ne peut être appliqué." }

/** A category line's label and reason in the page's language. */
export function ruleText(lang: Lang, dir: Direction, category: string, fallback: { label: string; why: string }) {
  if (lang === "en") return fallback
  if (category === "") return UNKNOWN_FR
  return RULES_FR[`${dir}:${category}`] ?? (category.startsWith("small:") ? { label: "Montants plus petits", why: "" } : { label: fallback.label, why: "Une catégorie sans règle de TVA pour l'instant." })
}

type Fmt = (n: number) => string

export interface PageText {
  title: string
  description: string
  kicker: string
  heading: string
  intro: (large: string, since: string) => string
  kbo: string
  introEnd: string
  tldrTitle: string
  tldr: (p: { x1: string; x2: string; gap: string; z: string; z2: string; zgap: string; z3: string; stateOwes: boolean; refunded: string; selfAssessed: string }) => string[]
  tldrLinks: { income: string; expenses: string; balance: string }
  incomplete: string
  bankMissing: (from: string | null) => string
  noTxYears: (years: string) => string
  noReturn: (quarters: string) => string
  income: string
  received: string
  vatIncluded: string
  vatInIt: string
  shouldHaveCharged: string
  declaredInReturns: string
  salesGrids: string
  expenses: string
  paidLbl: string
  suppliersCharged: string
  deductedInReturns: string
  purchasesGrid: (selfAssessed: string) => string
  deductibleShare: string
  balance: string
  fromOurs: string
  vatInIncome: string
  vatInExpenses: string
  balOwedToUs: string
  balOwedToState: string
  estimateNote: string
  fromReturns: string
  owedToState: (n: number) => string
  owedToUs: (n: number) => string
  balanceLbl: string
  paidByUs: string
  refundedToUs: string
  stillOwedToUs: string
  stillOwedToState: string
  stillOpen: string
  refundedOn: string
  paidOn: string
  forQuarters: string
  openNegative: string
  openPositive: string
  settled: string
  byQuarter: string
  quarter: string
  vatOnSales: string
  oursDeclared: string
  vatOnPurchases: string
  oursDeducted: string
  returnLbl: string
  paidRefunded: string
  noReturnOnFile: string
  notRegistered: string
  owedToUsShort: string
  owedToStateShort: string
  notRefunded: string
  noPayment: string
  refundedAmount: (amount: string, date: string) => string
  paidAmount: (amount: string, date: string) => string
  howToRead: string
  howOurs: string
  wiseCard: string
  grids4447: string
  sources: [string, string, string, string]
  undeclared: {
    title: string
    intro: (stripe: string) => string
    invoiced: (ours: string, declared: string, gap: string) => string
    cols: [string, string, string, string, string]
    total: string
    fromTitle: string
    fromNote: string
    planTitle: string
    plan: (amount: string) => string[]
  }
  grids: { title: string; intro: string; cols: [string, string, string, string, string]; labels: Record<string, string>; notInMoney: string; note: string }
  faq: { title: string; items: { q: string; a: string[] }[]; differ: { q: string; a: string } }
  books: { title: string; accountants: string; intro: string; crypto: (a: string) => string; timing: (a: string) => string; noVatCode: string; debts: string; cta: [string, string] }
  vatNotEstimated: string
  vat: string
  payments: (n: number) => string
  transfers: (n: number) => string
  smaller: (n: number) => string
  items: (amounts: number[], fmt0: Fmt, groups: boolean, total?: number) => string
  openTx: string
  openFirst: string
  beforeWhy: (since: string) => string
}

export const TEXT: Record<Lang, PageText> = {
  en: {
    title: "VAT 2023–2024 | Commons Hub Brussels",
    description: "Our VAT position for 2023 and 2024: the VAT in what came in and went out, by rate and why, and the balance with the State.",
    kicker: "Taxes",
    heading: "VAT 2023–2024",
    intro: (large, since) =>
      `Everything that came in and went out in 2023 and 2024, by VAT regime and why, and where that leaves us with the State. Open a rate to see its categories; open a category to see every payment of ${large} or more, with a link to annotate it. We have been subject to VAT since ${since} (KBO/BCE record of `,
    kbo: "0804.505.132",
    introEnd: "): what came in or went out before that carried no VAT.",
    tldrTitle: "In short",
    tldr: ({ x1, x2, gap, z, z2, zgap, z3, stateOwes, refunded, selfAssessed }) => [
      `In 2023–2024 we should have charged ${x1} of VAT on what we sold, and declared only ${x2}: we owe the State ${gap}.`,
      `Our suppliers charged us ${z} of VAT, and we deducted only ${z2} of it: ${zgap} more to claim back, if all of it is deductible.`,
      stateOwes
        ? `Net, the State would still owe us ${z3} (${zgap} − ${gap}), on top of the ${refunded} it has already refunded.`
        : `Net, we would still owe the State ${z3} (${gap} − ${zgap}), after the ${refunded} it has refunded.`,
      `Purchases under reverse charge are left out of both sides: the ${selfAssessed} of VAT we declared on them ourselves was deducted in the same returns, so it comes to nothing.`,
    ],
    tldrLinks: { income: "Money received", expenses: "Money paid out", balance: "VAT balance" },
    incomplete: "Incomplete: these figures will move",
    bankMissing: (from) => `Our KBC bank account's transactions start ${from ? `in ${from}` : "later"}: what came in or went out there in these years, VAT refunds included, is not counted yet.`,
    noTxYears: (years) => `No transactions at all for ${years} yet.`,
    noReturn: (q) => `No VAT return on file for ${q}: either not filed, or not imported yet.`,
    income: "1. Money received",
    received: "Received",
    vatIncluded: "VAT included",
    vatInIt: "VAT in it",
    shouldHaveCharged: "what we should have charged",
    declaredInReturns: "Declared in the returns",
    salesGrids: "VAT on sales (grids 54 − 64)",
    expenses: "2. Money paid out",
    paidLbl: "Paid",
    suppliersCharged: "what our suppliers charged us",
    deductedInReturns: "Deducted in the returns",
    purchasesGrid: (a) => `grid 59, without the ${a} of reverse-charge VAT we declared ourselves`,
    deductibleShare: "VAT on purchases can only be deducted for what serves our taxable activities. Part of what we do (donations, membership) is outside VAT, so in principle only a share of it is deductible.",
    balance: "3. VAT balance",
    fromOurs: "From our income and expenses",
    vatInIncome: "VAT in our income",
    vatInExpenses: "VAT in our expenses",
    balOwedToUs: "Balance: owed to us",
    balOwedToState: "Balance: owed to the State",
    estimateNote: "An estimate, before limiting deductions to our taxable share.",
    fromReturns: "From the returns we filed",
    owedToState: (n) => `Owed to the State (${n} ${n === 1 ? "quarter" : "quarters"})`,
    owedToUs: (n) => `Owed to us (${n} ${n === 1 ? "quarter" : "quarters"})`,
    balanceLbl: "Balance",
    paidByUs: "Paid by us",
    refundedToUs: "Refunded to us",
    stillOwedToUs: "Still owed to us",
    stillOwedToState: "Still owed to the State",
    stillOpen: "Still open",
    refundedOn: "Refunded on",
    paidOn: "Paid on",
    forQuarters: "for",
    openNegative: "Not refunded in the accounts we have: carried forward on our VAT account, or refunded to an account not imported yet.",
    openPositive: "Not paid from the accounts we have.",
    settled: "Settled.",
    byQuarter: "Quarter by quarter",
    quarter: "Quarter",
    vatOnSales: "VAT on sales",
    oursDeclared: "ours / declared",
    vatOnPurchases: "VAT on purchases",
    oursDeducted: "ours / deducted",
    returnLbl: "Return",
    paidRefunded: "Paid / refunded",
    noReturnOnFile: "no return on file",
    notRegistered: "not registered for VAT yet",
    owedToUsShort: "owed to us",
    owedToStateShort: "owed to the State",
    notRefunded: "Not refunded: carried forward",
    noPayment: "No payment found",
    refundedAmount: (a, d) => `Refunded ${a} on ${d}`,
    paidAmount: (a, d) => `Paid ${a} on ${d}`,
    howToRead: "How to read this",
    howOurs:
      "“Ours” applies each category's rate to the money that actually moved, so it is an estimate. A return counts an invoice when it is issued, so an amount can fall in the quarter before or after the one that declared it: compare totals rather than single quarters.",
    wiseCard: "Our Wise card balance ended 2024 with €4,191.77. Where it went in 2025 is not traced yet: it was not part of Wise's final refund in April 2025.",
    grids4447: "The returns also declare sales without Belgian VAT: services to customers in other EU countries (grid 44) and operations outside its scope (grid 47).",
    sources: ["Every amount comes from the ", "public dataset", ", the returns from Intervat; see also ", "all our taxes"],
    undeclared: {
      title: "4. VAT on sales we did not declare",
      intro: (stripe) => `Our Stripe sales of 2024 (event tickets, coworking passes and services) carried ${stripe} of VAT: 21% included in each price, counted charge by charge from the Stripe data. They were never invoiced and our books recorded them without a VAT code, so none of it reached a return. That is the VAT to declare.`,
      invoiced: (ours, declared, gap) => `Our invoiced sales (mostly room hire) carried ${ours} of VAT and the returns declared ${declared}. The ${gap} between them still needs tracing: an invoice of 2024 paid in another year (or the other way round) explains part of it; a payment received without an invoice would add to what is to declare. The grid comparison below shows it quarter by quarter.`,
      cols: ["Quarter", "Stripe sales", "VAT in them, to declare", "Invoiced sales: VAT, from the money", "Declared (grids 54 − 64)"],
      total: "Total",
      fromTitle: "To declare, by kind of sale",
      fromNote: "Each line adds up the Stripe charges of that kind, VAT included; the VAT is 21/121 of it.",
      planTitle: "How we will put it right (to agree with our accountant)",
      plan: (amount) => [
        `Declare the ${amount}: as a correction in favour of the State (grid 61) in our next return, with a note listing the three 2024 quarters and their amounts, or as corrected 2024 returns if the VAT office prefers. Late-payment interest is due on it; correcting it ourselves, before any audit, normally avoids a fine.`,
        "Settle it: it is set against the VAT the State owes us in that return, or paid with it.",
        "Keep a VAT code on every product sold through Stripe and on every Stripe sale in our books. The 2025 returns already declare roughly what our invoiced and Stripe sales carried, so the gap is a 2024 one.",
      ],
    },
    grids: {
      title: "Grid by grid: what we filed and what the money says",
      intro: "Each 2024 return next to the grids as they would read from the money that moved. The returns count invoices when they are issued and this page counts payments, so a difference can be timing; the ones that stay are the ones to correct.",
      cols: ["Grid", "", "Filed", "From the money", "Difference"],
      labels: {
        "01": "Sales at 6% (without VAT)",
        "02": "Sales at 12% (without VAT)",
        "03": "Sales at 21% (without VAT)",
        "00": "Sales at 0% or under a special scheme",
        "44": "Services to businesses in another EU country",
        "47": "Other sales without Belgian VAT (outside the EU)",
        "49": "Credit notes we issued",
        "81-83": "Purchases: goods (81), services (82), investment goods (83), without VAT",
        "84-85": "Credit notes we received",
        "86+88": "Purchases from the EU under reverse charge: goods (86), services (88)",
        "87": "Other purchases under reverse charge (outside the EU)",
        "54": "VAT due on our sales",
        "55": "VAT due on purchases from the EU (reverse charge)",
        "56": "VAT due on other purchases under reverse charge",
        "64": "VAT on credit notes we issued, in our favour",
        "59": "Deductible VAT",
        "71-72": "Balance: owed to the State (+) or to us (−)",
      },
      notInMoney: "not visible in payments",
      note: "“From the money” assumes everything bought is fully deductible (see the questions below) and cannot split purchases into goods, services and investment goods.",
    },
    faq: {
      title: "Questions a VAT controller would ask",
      items: [
        {
          q: "Can we deduct the VAT on all our costs, when most of the money we receive is donations, grants and subsidies?",
          a: [
            "VAT on a cost is deductible as far as the cost serves our taxable activity: room hire, coworking, event tickets, sponsoring (art. 45 of the VAT Code). Donations, grants and subsidies are outside the scope of VAT; they do not prevent a deduction by themselves. What counts is what the costs are used for.",
            "Most of what we bought is the development of Citizen Wallet and Brussels Pay. Both are open-source software the community uses to operate: they are how we coordinate the work that needs to be done, and how we sell our goods and services and receive donations. They were an integral part of Regen Village, which brought in most of our sponsoring and ticket sales in 2024 and gave the Hub a lot of visibility in this space, so they also have a marketing value. We therefore treat them as serving our taxable activity.",
          ],
        },
        {
          q: "Why is there no VAT on token top-ups (EURb, Zinne, Brussels Pay)?",
          a: [
            "They are multi-purpose vouchers: the tokens can be spent with several merchants, not only at the Hub, so what they will buy, and at which rate, is not known when they are bought. VAT is due when they are spent, by whoever sells the goods or services. Until then a top-up is money we owe to its holder.",
          ],
        },
        {
          q: "Why are All for Climate's transfers donations?",
          a: [
            "We are the fiscal host of collectives that are projects of our association. All for Climate passed on donations made to them: for VAT and in our books they are donations to the association, with nothing given in exchange.",
          ],
        },
        {
          q: "Why is there no Belgian VAT on sponsoring from abroad?",
          a: [
            "Sponsoring is a service to a business, taxed where the customer is established (art. 21 §2). A sponsor in another EU country gets an invoice with its VAT number and no VAT, and accounts for the VAT itself (grid 44; these sales also go in the intra-community listing). A sponsor outside the EU pays no Belgian VAT (grid 47).",
          ],
        },
      ],
      differ: {
        q: "Why do the figures on this page differ from the returns?",
        a: "The returns count invoices when they are issued; this page counts money when it moves. An invoice of December paid in January falls in another quarter, and sales without an invoice (through Stripe) are only here. The grid-by-grid comparison shows each difference.",
      },
    },
    books: {
      title: "Our books (WinBooks) next to these figures",
      accountants: "We have to own this: our accountants at the time worked with outdated software, did not know how to use Google Drive or what Stripe is, and our books for those years show it. We have since moved our books to Odoo, and we are moving to accountants who have experience with cooperatives and the commons.",
      intro: "Our accounts for July 2023 – December 2024, kept in WinBooks, do not match the money that moved. The main gaps:",
      crypto: (a) => `crypto grant money counted twice, or at its dollar value, in WinBooks: ${a} of income too much;`,
      timing: (a) => `invoices of 2024 paid in 2025, booked in 2024 in WinBooks: ${a};`,
      noVatCode: "ticket sales, Stripe memberships, coworking and the Citizen Wallet sponsor contributions booked without a VAT code, so in no VAT return;",
      debts: "token top-ups and campaign loans booked as debts, not as income.",
      cta: ["Every difference, line by line, with its reason: ", "WinBooks and the money"],
    },
    vatNotEstimated: "VAT not estimated",
    vat: "VAT",
    payments: (n) => `${n} ${n === 1 ? "payment" : "payments"}`,
    transfers: (n) => `${n} ${n === 1 ? "transfer" : "transfers"}`,
    smaller: (n) => `and ${n} smaller ${n === 1 ? "payment" : "payments"}`,
    items: (amounts, fmt0, groups, total) => {
      const noun = groups ? ["item", "items"] : ["payment", "payments"]
      if (amounts.length === 1) return `1 ${noun[0]} of ${fmt0(amounts[0])}`
      if (total !== undefined && amounts.length >= total) return `${amounts.length} ${noun[1]}`
      const k = Math.floor(Math.min(...amounts) / 1000)
      return k < 1 ? `The ${amounts.length} largest ${noun[1]}` : `${amounts.length} ${noun[1]} of €${k}k or more`
    },
    openTx: "Open the transaction: check it and annotate it",
    openFirst: "Open the first payment",
    beforeWhy: (since) => `Before ${since}, when we became subject to VAT: no VAT charged, none deducted.`,
  },
  fr: {
    title: "TVA 2023–2024 | Commons Hub Brussels",
    description: "Notre position TVA pour 2023 et 2024 : la TVA dans ce qui est entré et sorti, par taux et pourquoi, et le solde avec l'État.",
    kicker: "Taxes",
    heading: "TVA 2023–2024",
    intro: (large, since) =>
      `Tout ce qui est entré et sorti en 2023 et 2024, par régime de TVA et pourquoi, et où cela nous laisse vis-à-vis de l'État. Ouvrez un taux pour voir ses catégories ; ouvrez une catégorie pour voir chaque paiement de ${large} ou plus, avec un lien pour l'annoter. Nous sommes assujettis à la TVA depuis le ${since} (fiche BCE `,
    kbo: "0804.505.132",
    introEnd: ") : ce qui est entré ou sorti avant cette date ne portait pas de TVA.",
    tldrTitle: "En bref",
    tldr: ({ x1, x2, gap, z, z2, zgap, z3, stateOwes, refunded, selfAssessed }) => [
      `En 2023–2024, nous aurions dû facturer ${x1} de TVA sur ce que nous avons vendu, et n'en avons déclaré que ${x2} : nous devons ${gap} à l'État.`,
      `Nos fournisseurs nous ont facturé ${z} de TVA, et nous n'en avons déduit que ${z2} : ${zgap} de plus à récupérer, si tout est déductible.`,
      stateOwes
        ? `Au net, l'État nous devrait encore ${z3} (${zgap} − ${gap}), en plus des ${refunded} déjà remboursés.`
        : `Au net, nous devrions encore ${z3} à l'État (${gap} − ${zgap}), après les ${refunded} remboursés.`,
      `Les achats en autoliquidation sont laissés de côté des deux côtés : les ${selfAssessed} de TVA que nous avons déclarés nous-mêmes ont été déduits dans les mêmes déclarations, cela s'annule.`,
    ],
    tldrLinks: { income: "Argent reçu", expenses: "Argent dépensé", balance: "Solde TVA" },
    incomplete: "Incomplet : ces chiffres vont bouger",
    bankMissing: (from) => `Les transactions de notre compte KBC commencent ${from ? `en ${from}` : "plus tard"} : ce qui y est entré ou sorti ces années-là, remboursements de TVA compris, n'est pas encore compté.`,
    noTxYears: (years) => `Aucune transaction pour ${years} pour l'instant.`,
    noReturn: (q) => `Aucune déclaration TVA disponible pour ${q} : soit non déposée, soit pas encore importée.`,
    income: "1. Argent reçu",
    received: "Reçu",
    vatIncluded: "TVA comprise",
    vatInIt: "Dont TVA",
    shouldHaveCharged: "ce que nous aurions dû facturer",
    declaredInReturns: "Déclaré dans les déclarations",
    salesGrids: "TVA sur les ventes (grilles 54 − 64)",
    expenses: "2. Argent dépensé",
    paidLbl: "Payé",
    suppliersCharged: "ce que nos fournisseurs nous ont facturé",
    deductedInReturns: "Déduit dans les déclarations",
    purchasesGrid: (a) => `grille 59, sans les ${a} de TVA autoliquidée`,
    deductibleShare: "La TVA sur les achats n'est déductible que pour ce qui sert nos activités taxables. Une partie de ce que nous faisons (dons, cotisations) est hors TVA : en principe, seule une part en est déductible.",
    balance: "3. Solde TVA",
    fromOurs: "D'après nos revenus et dépenses",
    vatInIncome: "TVA dans nos revenus",
    vatInExpenses: "TVA dans nos dépenses",
    balOwedToUs: "Solde : dû à nous",
    balOwedToState: "Solde : dû à l'État",
    estimateNote: "Une estimation, avant de limiter les déductions à notre part taxable.",
    fromReturns: "D'après les déclarations déposées",
    owedToState: (n) => `Dû à l'État (${n} trimestre${n === 1 ? "" : "s"})`,
    owedToUs: (n) => `Dû à nous (${n} trimestre${n === 1 ? "" : "s"})`,
    balanceLbl: "Solde",
    paidByUs: "Payé par nous",
    refundedToUs: "Remboursé à nous",
    stillOwedToUs: "Encore dû à nous",
    stillOwedToState: "Encore dû à l'État",
    stillOpen: "Encore ouvert",
    refundedOn: "Remboursé le",
    paidOn: "Payé le",
    forQuarters: "pour",
    openNegative: "Pas remboursé sur les comptes que nous avons : reporté sur notre compte TVA, ou remboursé sur un compte pas encore importé.",
    openPositive: "Pas payé depuis les comptes que nous avons.",
    settled: "Réglé.",
    byQuarter: "Trimestre par trimestre",
    quarter: "Trimestre",
    vatOnSales: "TVA sur les ventes",
    oursDeclared: "nous / déclaré",
    vatOnPurchases: "TVA sur les achats",
    oursDeducted: "nous / déduit",
    returnLbl: "Déclaration",
    paidRefunded: "Payé / remboursé",
    noReturnOnFile: "pas de déclaration",
    notRegistered: "pas encore assujettis",
    owedToUsShort: "dû à nous",
    owedToStateShort: "dû à l'État",
    notRefunded: "Pas remboursé : reporté",
    noPayment: "Aucun paiement trouvé",
    refundedAmount: (a, d) => `Remboursé ${a} le ${d}`,
    paidAmount: (a, d) => `Payé ${a} le ${d}`,
    howToRead: "Comment lire cette page",
    howOurs:
      "« Nous » applique le taux de chaque catégorie à l'argent qui a réellement bougé : c'est une estimation. Une déclaration compte une facture quand elle est émise ; un montant peut donc tomber le trimestre avant ou après celui qui l'a déclaré : comparez les totaux plutôt que les trimestres un à un.",
    wiseCard: "Le solde de notre carte Wise finissait 2024 à 4 191,77 €. Où il est parti en 2025 n'est pas encore retracé : il ne faisait pas partie du remboursement final de Wise en avril 2025.",
    grids4447: "Les déclarations reprennent aussi des ventes sans TVA belge : services à des clients d'autres pays de l'UE (grille 44) et opérations hors de son champ (grille 47).",
    sources: ["Chaque montant vient des ", "données publiques", ", les déclarations d'Intervat ; voir aussi ", "toutes nos taxes"],
    undeclared: {
      title: "4. La TVA sur nos ventes que nous n'avons pas déclarée",
      intro: (stripe) => `Nos ventes Stripe de 2024 (tickets d'événements, pass de coworking et services) contenaient ${stripe} de TVA : 21 % compris dans chaque prix, compté paiement par paiement à partir des données Stripe. Elles n'ont jamais été facturées et notre comptabilité les a enregistrées sans code TVA, elles ne sont donc dans aucune déclaration. C'est la TVA à déclarer.`,
      invoiced: (ours, declared, gap) => `Nos ventes facturées (surtout la location de salles) contenaient ${ours} de TVA et les déclarations en reprennent ${declared}. L'écart de ${gap} reste à retracer : une facture de 2024 payée une autre année (ou l'inverse) en explique une partie ; un paiement reçu sans facture s'ajouterait à ce qui est à déclarer. La comparaison grille par grille ci-dessous le montre trimestre par trimestre.`,
      cols: ["Trimestre", "Ventes Stripe", "TVA comprise, à déclarer", "Ventes facturées : TVA, d'après l'argent", "Déclarée (grilles 54 − 64)"],
      total: "Total",
      fromTitle: "À déclarer, par type de vente",
      fromNote: "Chaque ligne additionne les paiements Stripe de ce type, TVA comprise ; la TVA en est les 21/121.",
      planTitle: "Comment nous allons régulariser (à valider avec notre comptable)",
      plan: (amount) => [
        `Déclarer les ${amount} : comme régularisation en faveur de l'État (grille 61) dans notre prochaine déclaration, avec une note détaillant les trois trimestres de 2024 et leurs montants, ou par des déclarations 2024 rectifiées si l'administration le préfère. Des intérêts de retard sont dus ; régulariser nous-mêmes, avant tout contrôle, évite normalement l'amende.`,
        "La régler : elle s'impute sur la TVA que l'État nous doit dans cette déclaration, ou se paie avec elle.",
        "Garder un code TVA sur chaque produit vendu via Stripe et sur chaque vente Stripe dans notre comptabilité. Les déclarations 2025 reprennent déjà à peu près la TVA de nos ventes facturées et Stripe : l'écart ne concerne que 2024.",
      ],
    },
    grids: {
      title: "Grille par grille : ce que nous avons déclaré et ce que dit l'argent",
      intro: "Chaque déclaration de 2024 à côté des grilles telles qu'elles se liraient d'après l'argent qui a circulé. Les déclarations comptent les factures à leur émission et cette page les paiements : un écart peut être une question de date ; ceux qui restent sont à corriger.",
      cols: ["Grille", "", "Déclaré", "D'après l'argent", "Écart"],
      labels: {
        "01": "Ventes à 6 % (hors TVA)",
        "02": "Ventes à 12 % (hors TVA)",
        "03": "Ventes à 21 % (hors TVA)",
        "00": "Ventes à 0 % ou sous régime particulier",
        "44": "Services à des entreprises d'un autre pays de l'UE",
        "47": "Autres ventes sans TVA belge (hors UE)",
        "49": "Notes de crédit émises",
        "81-83": "Achats : marchandises (81), services (82), biens d'investissement (83), hors TVA",
        "84-85": "Notes de crédit reçues",
        "86+88": "Achats dans l'UE en autoliquidation : biens (86), services (88)",
        "87": "Autres achats en autoliquidation (hors UE)",
        "54": "TVA due sur nos ventes",
        "55": "TVA due sur les achats dans l'UE (autoliquidation)",
        "56": "TVA due sur les autres achats en autoliquidation",
        "64": "TVA sur les notes de crédit émises, en notre faveur",
        "59": "TVA déductible",
        "71-72": "Solde : dû à l'État (+) ou à nous (−)",
      },
      notInMoney: "invisible dans les paiements",
      note: "« D'après l'argent » suppose que tout ce qui a été acheté est entièrement déductible (voir les questions ci-dessous) et ne peut pas répartir les achats entre marchandises, services et biens d'investissement.",
    },
    faq: {
      title: "Les questions d'un contrôleur TVA",
      items: [
        {
          q: "Pouvons-nous déduire la TVA sur tous nos coûts, alors que l'essentiel de l'argent reçu est fait de dons, de subventions et de bourses ?",
          a: [
            "La TVA sur un coût est déductible dans la mesure où ce coût sert notre activité taxable : location de salles, coworking, tickets d'événements, sponsoring (art. 45 du Code TVA). Les dons, subventions et bourses sont hors du champ de la TVA ; ils n'empêchent pas la déduction en soi. Ce qui compte, c'est l'usage des coûts.",
            "L'essentiel de nos achats est le développement de Citizen Wallet et de Brussels Pay. Ce sont deux logiciels open source que la communauté utilise pour fonctionner : c'est avec eux que nous coordonnons le travail à faire, que nous vendons nos biens et services et que nous recevons des dons. Ils faisaient partie intégrante du Regen Village, qui a apporté l'essentiel de notre sponsoring et de nos tickets en 2024 et beaucoup de visibilité au Hub dans ce milieu : ils ont donc aussi une valeur marketing. Nous les considérons donc comme servant notre activité taxable.",
          ],
        },
        {
          q: "Pourquoi pas de TVA sur les recharges de jetons (EURb, Zinne, Brussels Pay) ?",
          a: [
            "Ce sont des bons à usages multiples : les jetons se dépensent chez plusieurs commerçants, pas seulement au Hub, donc ce qu'ils achèteront, et à quel taux, n'est pas connu à l'achat. La TVA est due quand ils sont dépensés, par celui qui vend le bien ou le service. Jusque-là, une recharge est de l'argent que nous devons à son détenteur.",
          ],
        },
        {
          q: "Pourquoi les virements d'All for Climate sont-ils des dons ?",
          a: [
            "Nous sommes l'hôte fiscal de collectifs qui sont des projets de notre association. All for Climate nous a reversé des dons qui leur étaient faits : pour la TVA et dans notre comptabilité, ce sont des dons à l'association, sans contrepartie.",
          ],
        },
        {
          q: "Pourquoi pas de TVA belge sur le sponsoring venant de l'étranger ?",
          a: [
            "Le sponsoring est un service à une entreprise, taxé là où le client est établi (art. 21 §2). Un sponsor d'un autre pays de l'UE reçoit une facture avec son numéro de TVA et sans TVA, et autoliquide la TVA (grille 44 ; ces ventes figurent aussi dans le relevé intracommunautaire). Un sponsor hors UE ne paie pas de TVA belge (grille 47).",
          ],
        },
      ],
      differ: {
        q: "Pourquoi les chiffres de cette page diffèrent-ils des déclarations ?",
        a: "Les déclarations comptent les factures à leur émission ; cette page compte l'argent quand il circule. Une facture de décembre payée en janvier tombe dans un autre trimestre, et les ventes sans facture (via Stripe) ne sont qu'ici. La comparaison grille par grille montre chaque écart.",
      },
    },
    books: {
      title: "Notre comptabilité (WinBooks) face à ces chiffres",
      accountants: "Nous devons le reconnaître : nos comptables de l'époque travaillaient avec un logiciel dépassé, ne savaient pas utiliser Google Drive ni ce qu'est Stripe, et notre comptabilité de ces années s'en ressent. Nous sommes depuis passés à Odoo, et nous changeons de comptables pour des professionnels qui connaissent les coopératives et les communs.",
      intro: "Nos comptes de juillet 2023 à décembre 2024, tenus dans WinBooks, ne correspondent pas à l'argent qui a circulé. Les principaux écarts :",
      crypto: (a) => `des subventions reçues en crypto comptées deux fois, ou à leur valeur en dollars, dans WinBooks : ${a} de recettes en trop ;`,
      timing: (a) => `des factures de 2024 payées en 2025, comptabilisées en 2024 dans WinBooks : ${a} ;`,
      noVatCode: "les tickets, les cotisations Stripe, le coworking et les contributions de sponsors de Citizen Wallet comptabilisés sans code TVA, donc dans aucune déclaration ;",
      debts: "les recharges de jetons et les prêts de la campagne comptabilisés comme des dettes, pas comme des recettes.",
      cta: ["Chaque écart, ligne par ligne, avec sa raison : ", "WinBooks et l'argent (en anglais)"],
    },
    vatNotEstimated: "TVA non estimée",
    vat: "TVA",
    payments: (n) => `${n} paiement${n === 1 ? "" : "s"}`,
    transfers: (n) => `${n} virement${n === 1 ? "" : "s"}`,
    smaller: (n) => `et ${n} paiement${n === 1 ? "" : "s"} plus petit${n === 1 ? "" : "s"}`,
    items: (amounts, fmt0, groups, total) => {
      const noun = groups ? ["élément", "éléments"] : ["paiement", "paiements"]
      if (amounts.length === 1) return `1 ${noun[0]} de ${fmt0(amounts[0])}`
      if (total !== undefined && amounts.length >= total) return `${amounts.length} ${noun[1]}`
      const k = Math.floor(Math.min(...amounts) / 1000)
      return k < 1 ? `Les ${amounts.length} ${noun[1]} les plus importants` : `${amounts.length} ${noun[1]} de ${k} k€ ou plus`
    },
    openTx: "Ouvrir la transaction : la vérifier et l'annoter",
    openFirst: "Ouvrir le premier paiement",
    beforeWhy: (since) => `Avant le ${since}, date de notre assujettissement à la TVA : aucune TVA facturée ni déduite.`,
  },
}

/** Why a payment falls under a cross-border regime, in French (English in vat-position.ts). */
export const REGIME_WHY_FR: Record<Direction, Partial<Record<RateClass, string>>> = {
  income: {
    reverse_eu: "Services à une entreprise d'un autre pays de l'UE : pas de TVA belge sur la facture, le client l'autoliquide (grille 44).",
    export: "Services à des clients hors de l'UE : pas de TVA belge (grille 47).",
  },
  expense: {
    reverse_eu: "Services ou biens d'un fournisseur d'un autre pays de l'UE, facturés sans TVA : nous déclarons la TVA belge nous-mêmes (grille 88 pour les services, 86 pour les biens, et 55) et la déduisons dans la même déclaration (grille 59), ce qui revient à zéro.",
    reverse_noneu: "Services d'un fournisseur hors de l'UE, facturés sans TVA : nous déclarons la TVA belge nous-mêmes (grilles 87 et 56) et la déduisons dans la même déclaration (grille 59), ce qui revient à zéro.",
  },
}

/** "€X declared and deducted by us (net €0)" for reverse-charge purchases. */
export const SELF_ASSESSED: Record<Lang, (vat: string) => string> = {
  en: (vat) => `${vat} VAT declared and deducted by us (net 0)`,
  fr: (vat) => `${vat} de TVA autoliquidée et déduite (net 0)`,
}
