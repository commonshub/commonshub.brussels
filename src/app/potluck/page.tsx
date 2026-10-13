import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Utensils, ArrowRight, CalendarDays, MapPin, Soup, Users } from "lucide-react";
import { CommunityActivityGallery } from "@/components/community-activity-gallery";
import settings from "@/settings/settings.json";

export const metadata = {
  title: "Potluck | Commons Hub Brussels",
  description:
    "Every Friday lunchtime, the Commons Hub community shares a meal. Bring something to share and join us.",
};

export default function PotluckPage() {
  return (
    <div className="min-h-screen bg-background">
      <main>
        <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 bg-linear-to-b from-primary/10 to-background">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex justify-center mb-6">
              <div className="p-3 rounded-full bg-primary/10">
                <Utensils className="w-8 h-8 text-primary" />
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 text-balance">
              Friday Potluck
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
              Every Friday lunch time, we share food. Bring something to share
              and join us.
            </p>
          </div>
        </section>

        <section className="px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2">
            {[
              { icon: CalendarDays, title: "When", text: "Every Friday, 12:30 to 13:30. Early birds join the park cleaning at 12:00, just before." },
              { icon: MapPin, title: "Where", text: "At the Commons Hub, Rue de la Madeleine 51, 1000 Brussels, a few minutes from Brussels Central station." },
              { icon: Soup, title: "What to bring", text: "Something to share: a dish, a salad, bread, fruit, a drink. Home-made or bought, it all ends up on the same table. Forgot? Come anyway." },
              { icon: Users, title: "Who comes", text: "Members, neighbours, people curious about the hub. No sign-up and nothing to pay: it's the easiest way to meet the community, and for anyone who applied to become a member, to get to know us." },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-border bg-card p-6">
                <div className="mb-3 flex items-center gap-3">
                  <item.icon className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground">{item.title}</h2>
                </div>
                <p className="text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                Meet the Community
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Scenes from past potlucks — shared by the community on Discord.
              </p>
            </div>
            <CommunityActivityGallery
              channelId={settings.discord.channels.activities.potluck}
              maxImages={12}
            />
          </div>
        </section>

        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-card/50">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              Join us this Friday
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Bring a dish, your appetite, and good vibes. Everyone is welcome.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg">
                <Link href="/#events">
                  See upcoming events
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a
                  href="https://discord.commonshub.brussels"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Join our Discord
                </a>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
