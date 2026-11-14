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
  "income:loan": { label: "Prêts sans intérêt (jetons de dette)", why: "Des membres et soutiens ont prêté de l'argent au Hub pour démarrer, sans intérêt, et détiennent des jetons de dette remboursables en usage de l'espace (voir /debt). Un prêt est un financement, pas une vente : hors du champ de la TVA." },
  "expense:loan": { label: "Prêts remboursés", why: "Rembourser un prêt n'est pas un achat : hors du champ de la TVA." },
  "income:debt": { label: "Rechargements de jetons", why: "Les jetons prépayés sont des bons utilisables chez plusieurs commerçants : la TVA est due sur ce qu'ils achètent quand ils sont dépensés, pas lors du rechargement." },
  "income:debt:eurb": { label: "Rechargements EURb", why: "Des jetons EURb achetés par carte. La TVA est due sur ce qu'ils achètent quand ils sont dépensés ; on ne sait pas encore ce qu'ils ont acheté ces années-là, d'où l'absence d'estimation." },
  "expense:consulting": { label: "Consultants et indépendants", why: "Des services au taux normal. Les indépendants établis dans un autre pays de l'UE nous facturent sans TVA : nous devons alors la TVA belge nous-mêmes (autoliquidation) et la déduisons dans la même déclaration, ce qui revient à zéro." },
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
  tldr: (p: { x1: string; x2: string; gap: string; z: string; z2: string; z3: string; stateOwes: boolean; refunded: string }) => string[]
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
  purchasesGrid: string
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
  winbooks: [string, string]
  vatNotEstimated: string
  vat: string
  payments: (n: number) => string
  transfers: (n: number) => string
  smaller: (n: number) => string
  items: (amounts: number[], fmt0: Fmt, groups: boolean) => string
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
    tldr: ({ x1, x2, gap, z, z2, z3, stateOwes, refunded }) => [
      `In 2023–2024 we should have charged ${x1} of VAT on what we sold, but we declared only ${x2}: ${gap} less.`,
      `We paid ${z} of VAT on what we bought, and claimed back only ${z2}.`,
      stateOwes
        ? `So, if all of that VAT were deductible, the State would still owe us ${z3}, on top of the ${refunded} it has already refunded.`
        : `So, even if all of that VAT were deductible, we would still owe the State ${z3}, after the ${refunded} it has refunded.`,
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
    purchasesGrid: "VAT on purchases (grid 59)",
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
    winbooks: ["How these figures compare with our books, line by line: ", "WinBooks and the money"],
    vatNotEstimated: "VAT not estimated",
    vat: "VAT",
    payments: (n) => `${n} ${n === 1 ? "payment" : "payments"}`,
    transfers: (n) => `${n} ${n === 1 ? "transfer" : "transfers"}`,
    smaller: (n) => `and ${n} smaller ${n === 1 ? "payment" : "payments"}`,
    items: (amounts, fmt0, groups) => {
      const noun = groups ? ["item", "items"] : ["payment", "payments"]
      if (amounts.length === 1) return `1 ${noun[0]} of ${fmt0(amounts[0])}`
      return `${amounts.length} ${noun[1]} of €${Math.floor(Math.min(...amounts) / 1000)}k or more`
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
    tldr: ({ x1, x2, gap, z, z2, z3, stateOwes, refunded }) => [
      `En 2023–2024, nous aurions dû facturer ${x1} de TVA sur ce que nous avons vendu, mais nous n'en avons déclaré que ${x2} : ${gap} de moins.`,
      `Nous avons payé ${z} de TVA sur ce que nous avons acheté, et n'en avons récupéré que ${z2}.`,
      stateOwes
        ? `Donc, si toute cette TVA était déductible, l'État nous devrait encore ${z3}, en plus des ${refunded} déjà remboursés.`
        : `Donc, même si toute cette TVA était déductible, nous devrions encore ${z3} à l'État, après les ${refunded} remboursés.`,
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
    purchasesGrid: "TVA sur les achats (grille 59)",
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
    winbooks: ["Comment ces chiffres se comparent à notre comptabilité, ligne par ligne : ", "WinBooks et l'argent (en anglais)"],
    vatNotEstimated: "TVA non estimée",
    vat: "TVA",
    payments: (n) => `${n} paiement${n === 1 ? "" : "s"}`,
    transfers: (n) => `${n} virement${n === 1 ? "" : "s"}`,
    smaller: (n) => `et ${n} paiement${n === 1 ? "" : "s"} plus petit${n === 1 ? "" : "s"}`,
    items: (amounts, fmt0, groups) => {
      const noun = groups ? ["élément", "éléments"] : ["paiement", "paiements"]
      if (amounts.length === 1) return `1 ${noun[0]} de ${fmt0(amounts[0])}`
      return `${amounts.length} ${noun[1]} de ${Math.floor(Math.min(...amounts) / 1000)} k€ ou plus`
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
    reverse_eu: "Services d'un fournisseur d'un autre pays de l'UE, facturés sans TVA : nous déclarons la TVA belge nous-mêmes (grilles 88 et 55) et la déduisons dans la même déclaration (grille 59), ce qui revient à zéro.",
    reverse_noneu: "Services d'un fournisseur hors de l'UE, facturés sans TVA : nous déclarons la TVA belge nous-mêmes (grilles 87 et 56) et la déduisons dans la même déclaration (grille 59), ce qui revient à zéro.",
  },
}

/** "€X declared and deducted by us (net €0)" for reverse-charge purchases. */
export const SELF_ASSESSED: Record<Lang, (vat: string) => string> = {
  en: (vat) => `${vat} VAT declared and deducted by us (net 0)`,
  fr: (vat) => `${vat} de TVA autoliquidée et déduite (net 0)`,
}
