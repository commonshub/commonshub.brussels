import type React from "react";
import type { Metadata, Viewport } from "next";
import { DM_Sans, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SessionProvider } from "@/components/session-provider";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { auth } from "@/auth";
import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Commons Hub Brussels",
  description:
    "A common space for your community to meet, dream and work. A space to rediscover the commons. Come visit us in front of Central Station.",
  generator: "xavier@commonshub.brussels",
  icons: {
    icon: [
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
      {
        url: "/favicon.png",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover", // Enable safe area insets on iOS
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        <SessionProvider session={session}>
          <Header />
          <main className="min-h-screen pt-16">{children}</main>
          <Footer />
        </SessionProvider>
        <Analytics />
      </body>
    </html>
  );
}
