const eurFormat = new Intl.NumberFormat("en-BE", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const eur = (n: number) => eurFormat.format(Math.abs(n) < 0.005 ? 0 : n);

/** "+€1,234.00" / "−€56.70" / "€0.00". */
export const signedEur = (n: number) => {
  if (Math.abs(n) < 0.005) return eur(0);
  return `${n > 0 ? "+" : "−"}${eurFormat.format(Math.abs(n))}`;
};

export const tokens = (n: number) => new Intl.NumberFormat("en-BE", { maximumFractionDigits: 2 }).format(n);

/** "4 Oct 2026" from a timestamp in seconds. */
export const shortDate = (seconds: number) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Brussels" }).format(
    new Date(seconds * 1000)
  );
