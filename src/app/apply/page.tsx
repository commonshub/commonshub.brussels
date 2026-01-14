import { MembershipSection } from "@/components/membership-section"

export const metadata = {
  title: "Apply to become a commoner | Commons Hub Brussels",
  description: "Join the Commons Hub Brussels community as a commoner.",
}

export default function ApplyPage() {
  return (
    <main className="min-h-screen bg-background">
      <MembershipSection />
    </main>
  )
}
