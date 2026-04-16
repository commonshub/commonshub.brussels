import Image from "@/components/optimized-image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function EconomySection() {
  return (
    <section id="economy" className="py-20 bg-primary/5">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            A Yin and a Yang economy
          </h2>
          <p className="text-lg text-muted-foreground">
            More than one currency, more than one way to contribute, more than
            one way to pay
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Yin - Internal Economy */}
          <div className="space-y-4">
            <div className="aspect-[4/3] relative rounded-lg overflow-hidden bg-neutral-900">
              <Image
                src="/images/cht-tokens.avif"
                alt="Commons Hub Brussels Token (CHT)"
                fill
                className="object-cover"
              />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-foreground">
                Yin (internal economy)
              </h3>
              <p className="text-primary font-semibold">
                To take care of the space
              </p>
              <p className="text-muted-foreground">
                The more you contribute to the space, the more Commons Hub
                Tokens (CHT) you receive.
              </p>
              <p className="text-muted-foreground">
                Redeem those tokens for goods and services offered by the
                community.
              </p>
            </div>
          </div>

          {/* Yang - External Economy */}
          <div className="space-y-4">
            <div className="aspect-[4/3] relative rounded-lg overflow-hidden bg-neutral-900">
              <Image
                src="/images/e2-82-ac-tokens.avif"
                alt="Euro coins"
                fill
                className="object-cover"
              />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-foreground">
                Yang (external economy)
              </h3>
              <p className="text-primary font-semibold">
                To cover our expenses
              </p>
              <p className="text-muted-foreground">
                We still depend on external resources that can only be acquired
                with euros.
              </p>
              <p className="text-muted-foreground">
                Everyone contributes what they can and we try to find ways to
                collectively bring more money in the common to reduce the
                financial pressure on the community.
              </p>
            </div>
          </div>
        </div>

        <div className="text-center mt-12">
          <Link
            href="/economy"
            className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-semibold transition-colors cursor-pointer"
          >
            Learn more about our economic model
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
