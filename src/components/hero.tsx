"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users, Calendar } from "lucide-react";
import useSWR from "swr";
import { useState, useEffect } from "react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const rotatingPhrases = [
  "your community",
  "building community",
  "rediscovering the commons",
  "rebuilding the commons",
  "building relationships",
  "you",
];

export function Hero() {
  const { data: stats } = useSWR("/api/stats", fetcher);

  const [phraseIndex, setPhraseIndex] = useState(0);
  const [revealProgress, setRevealProgress] = useState(100);

  useEffect(() => {
    const interval = setInterval(() => {
      setRevealProgress(0);
      setPhraseIndex((prev) => (prev + 1) % rotatingPhrases.length);

      let progress = 0;
      const revealInterval = setInterval(() => {
        progress += 4;
        setRevealProgress(progress);
        if (progress >= 100) {
          clearInterval(revealInterval);
        }
      }, 30);
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src="/images/chb-facade.avif"
          alt="Commons Hub Brussels facade"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-linear-to-b from-background/80 via-background/70 to-background" />
      </div>

      <div className="absolute top-20 right-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground leading-tight max-w-5xl mx-auto">
          <span className="block">A space for</span>
          <span className="block h-[1.3em] relative w-[300px] sm:w-[400px] md:w-[600px] mx-auto">
            <span
              className="text-primary whitespace-nowrap inline-block"
              style={{
                clipPath: `inset(0 ${100 - revealProgress}% 0 0)`,
              }}
            >
              {rotatingPhrases[phraseIndex]}
            </span>
          </span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl font-extrabold text-muted-foreground max-w-2xl mx-auto text-pretty">
          Commons Hub Brussels is a collaborative space where communities
          gather, create, and grow. Book our space for your events or become a
          member to access our vibrant ecosystem.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            size="lg"
            className="text-lg px-8 py-6 gap-2 cursor-pointer"
            asChild
          >
            <Link href="#book">
              <Calendar className="w-5 h-5" />
              Book the Space
              <ArrowRight className="w-5 h-5" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="text-lg px-8 py-6 gap-2 bg-transparent cursor-pointer"
            asChild
          >
            <Link href="/membership">
              <Users className="w-5 h-5" />
              Join the community
            </Link>
          </Button>
        </div>

        <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto">
          {[
            {
              number: stats?.communityMembers || "–",
              label: "Community Members",
            },
            {
              number: stats?.partnerOrganizations || "–",
              label: "Partner Organizations",
            },
            { number: stats?.events || "–", label: "Upcoming Events" },
            { number: stats?.commonSpaces || 1, label: "Common Space" },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-primary">
                {stat.number}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
