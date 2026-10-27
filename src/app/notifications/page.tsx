import type { Metadata } from "next"

import { auth } from "@/auth"
import { SignInPrompt } from "@/components/day/sign-in-prompt"
import { NotificationForm } from "@/components/recap/notification-form"
import { getSettings, verifySettingsLink } from "@/lib/notification-settings"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Notification settings", robots: { index: false } }

/** /notifications(?t=…): which recap emails a member gets. The link in the email works without logging in. */
export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams
  const claim = t ? verifySettingsLink(t) : null
  const id = claim?.d ?? (await auth())?.user?.discordId ?? null
  return (
    <main className="mx-auto max-w-xl px-4 pb-14 pt-10 sm:px-6">
      <h1 className="text-2xl font-extrabold text-foreground sm:text-3xl">Notification settings</h1>
      <p className="mt-2 text-muted-foreground">A recap of your time at the Commons Hub: the days you came, the tokens you received and spent, the thank-yous you got and what the community shared.</p>
      <div className="mt-6">
        {id ? (
          <NotificationForm token={claim ? t : undefined} initial={await getSettings(id)} />
        ) : (
          <SignInPrompt>{t ? "This link has expired. Log in to change your settings." : "Log in to change your settings."}</SignInPrompt>
        )}
      </div>
    </main>
  )
}
