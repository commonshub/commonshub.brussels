"use client";

import Link from "next/link";
import { Gamepad2, Home, Coins, Calendar } from "lucide-react";

const membershipBenefits = [
  {
    icon: Gamepad2,
    content: (
      <>
        Play{" "}
        <Link href="/workshops/commons-game" className="text-primary hover:underline">
          the Commons Games
        </Link>{" "}
        and learn{" "}
        <Link href="/workshops/commons-game#principles" className="text-primary hover:underline">
          Elinor Ostrom's 8 principles to govern the commons
        </Link>
      </>
    ),
  },
  {
    icon: Home,
    content: "Make use of the common space and the common resources of the community",
  },
  {
    icon: Coins,
    content: "Contribute and earn tokens",
  },
  {
    icon: Calendar,
    content: "Make proposals to organise events, workshops or other activities for the community",
  },
];

export function MembershipPreviewSection() {
  return (
    <section id="membership" className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Become a Member */}
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              Become a Member
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Rediscover with us the commons, an alternative model of society
              where our common resources are managed by the people that depend
              on them.
            </p>
          </div>

          {/* Benefits */}
          <div className="mb-8">
            <ul className="space-y-4">
              {membershipBenefits.map((benefit, i) => (
                <li key={i} className="flex items-start gap-3">
                  <benefit.icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">
                    {benefit.content}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="text-center">
            <Link
              href="/membership"
              className="text-primary hover:underline font-medium"
            >
              More info →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
