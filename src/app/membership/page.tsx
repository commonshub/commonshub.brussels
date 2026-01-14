import { MembershipJoinSection } from "@/components/membership-join-section"

export const metadata = {
  title: "Join the Community | Commons Hub Brussels",
  description: "Become a member of the Commons Hub Brussels community.",
}

export default function MembershipPage() {
  return (
    <main className="min-h-screen bg-background">
      <MembershipJoinSection />
    </main>
  )
}
