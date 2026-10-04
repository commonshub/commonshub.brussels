import Link from "next/link"

import { MembershipJoinSection } from "@/components/membership-join-section"

export const metadata = {
  title: "Join the Community | Commons Hub Brussels",
  description: "Become a member of the Commons Hub Brussels community.",
}

export default function MembershipPage() {
  return (
    <main className="min-h-screen bg-background">
      <MembershipJoinSection />
      <p className="pb-10 text-center text-xs text-muted-foreground">
        <Link href="/membership/poster" className="underline underline-offset-2">
          Print the membership poster (A4)
        </Link>
      </p>
    </main>
  )
}
