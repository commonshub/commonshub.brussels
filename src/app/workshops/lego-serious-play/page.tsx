"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Calendar, MapPin, Euro, ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function LegoSeriousPlayPage() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="pt-32 pb-16 bg-primary/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="text-sm font-medium text-primary uppercase tracking-wider mb-4">
                Workshop
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold text-foreground">
                Three Horizon meets LEGO® Serious Play®
              </h1>
              <p className="mt-6 text-xl text-muted-foreground">
                A Playful Futures Exploration & Intention-Setting Workshop
              </p>

              <div className="mt-8 flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  <span className="text-foreground font-medium">
                    16 January 2026
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  <span className="text-foreground font-medium">
                    09:30 – 12:30
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  <span className="text-foreground font-medium">
                    Commons Hub Brussels
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Euro className="w-5 h-5 text-primary" />
                  <span className="text-foreground font-medium">
                    €60 early bird
                  </span>
                </div>
              </div>

              <Button size="lg" className="mt-8 gap-2 cursor-pointer" asChild>
                <a
                  href="https://luma.com/v7qklcet"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  RSVP on Luma
                  <ArrowRight className="w-4 h-4" />
                </a>
              </Button>
            </div>

            <div className="relative">
              <Image
                src="/images/workshops/legoworkshop-cover.jpg"
                alt="Three Horizon meets LEGO Serious Play workshop"
                width={600}
                height={400}
                className="rounded-xl shadow-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Introduction Section */}
      <section className="py-16 bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-foreground mb-6">
            Step into the New Year with a New Horizon
          </h2>
          <div className="prose prose-lg max-w-none text-muted-foreground space-y-4">
            <p>
              This half-day, in-person workshop invites you to pause, reflect,
              and open up to new possibilities. And while we meet at the start
              of a new year, our gaze will stretch far beyond it — reaching
              decades ahead so your intentions align with the deeper
              contribution you want to make.
            </p>
            <p>
              Blending the imagination-unlocking power of{" "}
              <strong>LEGO® Serious Play®</strong> with the clarity and
              perspective of the <strong>Three Horizon</strong> futures
              practice, we will create a playful yet meaningful space to explore
              the future we want to contribute to.
            </p>
            <p>
              This session is less about resolutions, and more about{" "}
              <strong>setting grounded, spacious intentions</strong> that can
              support your work, leadership, or organisation over a longer arc
              of time.
            </p>
          </div>
        </div>
      </section>

      {/* Guiding Question Section */}
      <section className="py-16 bg-primary/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-foreground mb-6">
            Our Guiding Question
          </h2>
          <div className="bg-card border border-border rounded-xl p-8">
            <p className="text-xl text-foreground font-medium italic">
              Throughout the morning, we'll explore a central question such as:
            </p>
            <p className="text-2xl text-foreground font-bold mt-4">
              What future do you want to contribute to— and what intentions will
              help you step toward it?
            </p>
            <p className="text-muted-foreground mt-4">
              This question becomes the doorway into a deeper exploration of
              what is emerging in your work, what patterns no longer serve, and
              what new possibilities may be ready to take shape.
            </p>
          </div>
        </div>
      </section>

      {/* What You Will Experience Section */}
      <section className="py-16 bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-foreground mb-6">
            What You Will Experience
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            In this creative and reflective workshop, you will:
          </p>
          <ul className="space-y-3 text-muted-foreground">
            <li className="flex items-start gap-3">
              <span className="text-primary font-bold mt-1">•</span>
              <span>
                <strong className="text-foreground">Build LEGO® models</strong>{" "}
                to express current realities, possibilities, and future
                aspirations
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-primary font-bold mt-1">•</span>
              <span>
                <strong className="text-foreground">
                  Explore transition pathways
                </strong>{" "}
                using the Three Horizon practice
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-primary font-bold mt-1">•</span>
              <span>
                <strong className="text-foreground">
                  Reflect on your own role, contribution, organisation or
                  ecosystem
                </strong>
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-primary font-bold mt-1">•</span>
              <span>
                <strong className="text-foreground">Name intentions</strong>{" "}
                that feel supportive, meaningful and oriented toward possibility
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-primary font-bold mt-1">•</span>
              <span>
                <strong className="text-foreground">Connect with peers</strong>{" "}
                who want to start the year with clarity, imagination and renewal
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-primary font-bold mt-1">•</span>
              <span>
                <strong className="text-foreground">
                  Leave with practical tools
                </strong>{" "}
                you can use throughout 2026 (and the next 40 years) to stay
                aligned with what matters
              </span>
            </li>
          </ul>
          <p className="mt-8 text-muted-foreground">
            No previous experience is needed. Just curiosity, openness, and a
            willingness to explore.
          </p>
        </div>
      </section>

      {/* Who This Is For Section */}
      <section className="py-16 bg-primary/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-foreground mb-6">
            Who This Is For
          </h2>
          <p className="text-lg text-muted-foreground mb-6">Perfect for:</p>
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-6">
                <p className="text-foreground">
                  Leaders navigating transitions or change
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-foreground">
                  Facilitators, coaches, and practitioners
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-foreground">
                  Entrepreneurs, intrapreneurs and innovators
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-foreground">
                  Sustainability, strategy and organisational development
                  professionals
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-foreground">
                  Philanthropy and impact ecosystem actors
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-foreground">
                  Anyone seeking a creative reset, a broader horizon, or a new
                  way of setting intention for the year ahead
                </p>
              </CardContent>
            </Card>
          </div>
          <p className="mt-6 text-muted-foreground">
            If you enjoy asking big questions, thinking in systems, or
            approaching challenges playfully, you'll feel right at home.
          </p>
        </div>
      </section>

      {/* What to Bring Section */}
      <section className="py-16 bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-foreground mb-6">
            What to Bring
          </h2>
          <p className="text-lg text-muted-foreground mb-4">Please bring:</p>
          <ul className="space-y-3 text-muted-foreground mb-6">
            <li className="flex items-start gap-3">
              <span className="text-primary font-bold mt-1">•</span>
              <span>
                A <strong className="text-foreground">notebook</strong>
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-primary font-bold mt-1">•</span>
              <span>
                <strong className="text-foreground">A playful mind</strong>
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-primary font-bold mt-1">•</span>
              <span>
                <strong className="text-foreground">Optional:</strong> your own
                food if you wish to stay afterwards to have lunch together!
              </span>
            </li>
          </ul>
          <p className="text-muted-foreground">
            All workshop materials will be provided.
          </p>
        </div>
      </section>

      {/* Facilitators Section */}
      <section className="py-16 bg-primary/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-foreground mb-8">
            Facilitators
          </h2>

          <div className="space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
              <Card>
                <CardContent className="p-6">
                  <div className="relative w-32 h-32 mx-auto mb-4 rounded-full overflow-hidden">
                    <Image
                      src="/images/workshops/JudithSaragossi.jpg"
                      alt="Judith Saragossi"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <h3 className="text-xl font-bold text-foreground text-center mb-2">
                    Judith Saragossi
                  </h3>
                  <p className="text-sm text-primary text-center mb-4">
                    Momentum Facilitation
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Judith is a co-founder of Momentum, together with Molly
                    Stevenson and Lettemieke Mulder. Momentum supports
                    organisations and teams in navigating complexity with
                    clarity and creativity. Judith is trained in LEGO® Serious
                    Play® and brings deep experience in participatory
                    facilitation, systemic thinking, and group process design.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="relative w-32 h-32 mx-auto mb-4 rounded-full overflow-hidden">
                    <Image
                      src="/images/workshops/MollyStevenson.jpg"
                      alt="Molly Stevenson"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <h3 className="text-xl font-bold text-foreground text-center mb-2">
                    Molly Stevenson
                  </h3>
                  <p className="text-sm text-primary text-center mb-4">
                    Momentum Facilitation
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Molly is a co-founder of Momentum, together with Judith
                    Saragossi and Lettemieke Mulder. Momentum supports
                    organisations and teams in navigating complexity with
                    clarity and creativity. Molly is trained in LEGO® Serious
                    Play® and brings deep experience in participatory
                    facilitation, systemic thinking, and group process design.
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-foreground mb-2">
                  Marion Birnstill
                </h3>
                <p className="text-sm text-primary mb-4">Inner Ripple</p>
                <p className="text-muted-foreground">
                  Marion works at the intersection of systems change, futures
                  thinking, and inner-led transformation. She is a custodian and
                  practitioner of the Three Horizon practice with Future
                  Stewards, integrating embodied and systemic approaches to help
                  groups sense and shape emerging futures.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Practical Details Section */}
      <section className="py-16 bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-foreground mb-6">
            Practical Details
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
              <div>
                <strong className="text-foreground">Location:</strong> Commons
                Hub Brussels
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
              <div>
                <strong className="text-foreground">Date:</strong> 16 January
                2026
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
              <div>
                <strong className="text-foreground">Time:</strong> 09:30 – 12:30
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-primary mt-1 flex-shrink-0">🥗</span>
              <div>
                <strong className="text-foreground">Optional:</strong>{" "}
                12:30–13:30 connecting lunch (bring your own food if you are
                planning on joining)
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Euro className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
              <div>
                <strong className="text-foreground">Price:</strong>
                <ul className="mt-2 ml-4 space-y-1">
                  <li>
                    • Self-funded participants: <strong>€60 early bird</strong>{" "}
                    until 31 December or <strong>€80</strong> from 1 January.
                  </li>
                  <li>
                    • For organisations (VAT applicable),{" "}
                    <strong>€100 early bird rate</strong> until 31st December or{" "}
                    <strong>€120</strong> as of 1st of January.
                  </li>
                  <li>
                    • We're offering a limited number of bursary tickets
                    (approx. 10% of all seats) at a significantly reduced rate.
                    No explanation required.
                  </li>
                </ul>
                <p className="mt-2">
                  Spaces are intentionally limited to ensure depth, quality and
                  connection.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary/5">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Ready to Explore Your Future?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join us for this playful yet meaningful exploration of the future
            you want to contribute to.
          </p>
          <Button size="lg" className="gap-2 cursor-pointer" asChild>
            <a
              href="https://luma.com/v7qklcet"
              target="_blank"
              rel="noopener noreferrer"
            >
              RSVP on Luma
              <ArrowRight className="w-4 h-4" />
            </a>
          </Button>
        </div>
      </section>
    </main>
  );
}


