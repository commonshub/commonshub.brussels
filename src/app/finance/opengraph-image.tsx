import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import { join } from "path";
import { getFinancialsOverview } from "@/lib/financials";
import { loadFinanceOutlook } from "@/lib/finance-outlook";

export const runtime = "nodejs";
// The figures are read from the dataset at request time, like the page's.
export const dynamic = "force-dynamic";
export const alt = "Commons Hub Brussels - Transparent Finances";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  // The same figures as the top of /finance: the balance, and the last
  // complete month's income and spending.
  const { accounts } = getFinancialsOverview();
  const cash = Math.round(accounts.reduce((sum, acc) => sum + (acc.balance ?? 0), 0));
  const outlook = loadFinanceOutlook(cash);
  const last = outlook.months.filter((m) => !m.partial).at(-1);

  const eur = (n: number) => `€${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
  const balance = `${cash < 0 ? "−" : ""}${eur(cash)}`;
  const income = last ? `+${eur(last.income)}` : "–";
  const expenses = last ? `−${eur(last.spending)}` : "–";
  const monthLabel = last
    ? new Date(`${last.month}-01T12:00:00Z`).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : "";
  const stillToPay =
    outlook.stillToPay > 0 ? `${eur(outlook.stillToPay)} still to pay in bills and taxes · ` : "";
  const asOfDate = `${stillToPay}As of ${new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Europe/Brussels",
  })}`;

  // Read background image
  const backgroundPath = join(
    process.cwd(),
    "public",
    "images",
    "ogimage-background.jpg"
  );
  const backgroundBuffer = await readFile(backgroundPath);
  const backgroundBase64 = backgroundBuffer.toString("base64");

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {/* Background Image - full opacity */}
        <img
          src={`data:image/jpeg;base64,${backgroundBase64}`}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 1.0,
          }}
        />

        {/* Dark overlay, so the white figures read on any part of the photo */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.45)",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Logo and title on one line */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: "44px" }}>
            <svg width="72" height="72" viewBox="0 0 500 500" style={{ marginRight: "22px" }}>
              <g clipPath="url(#clip0_48_36)">
                <rect width="500" height="500" fill="#FF4C02" />
                <path
                  d="M213.528 91L126.722 141.505L201.691 225.154L92 201.48V302.49L201.691 280.394L126.722 359.308L213.528 409.813L250.223 303.632L286.918 409.813L373.723 359.308L298.755 280.394L408.446 302.49V201.48L298.755 225.154L373.723 141.505L286.918 91L250.223 190.155L213.528 91Z"
                  fill="#FBF4F2"
                />
              </g>
              <defs>
                <clipPath id="clip0_48_36">
                  <rect width="500" height="500" rx="250" fill="white" />
                </clipPath>
              </defs>
            </svg>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "50px", fontWeight: "bold", color: "#ffffff", lineHeight: 1.1 }}>
                Commons Hub Brussels
              </div>
              <div style={{ fontSize: "32px", color: "#ffd2bd", lineHeight: 1.2 }}>
                Transparent finances
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            {[
              { label: "Balance", value: balance },
              { label: `${monthLabel} income`, value: income },
              { label: `${monthLabel} spending`, value: expenses },
            ].map((stat, i) => (
              <div
                key={stat.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  width: "350px",
                  padding: "26px 0 30px",
                  marginLeft: i === 0 ? "0" : "20px",
                  borderRadius: "24px",
                  backgroundColor: "rgba(20, 8, 2, 0.6)",
                  borderTop: "8px solid #FF4C02",
                }}
              >
                <div style={{ fontSize: "30px", color: "#ffd2bd", marginBottom: "6px" }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: "72px", fontWeight: "bold", color: "#ffffff", lineHeight: 1.1 }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {/* Still to pay and date */}
          <div style={{ display: "flex", marginTop: "40px", fontSize: "30px", color: "#ffffff" }}>
            {asOfDate}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
