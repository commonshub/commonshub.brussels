import { Button } from "@/components/ui/button"
import { ArrowRight, Wrench } from "lucide-react"
import Link from "next/link"

export function WorkshopsCTA() {
  return (
    <section className="py-24 bg-primary text-primary-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start gap-2 mb-4">
              <Wrench className="w-6 h-6" />
              <span className="text-sm font-medium uppercase tracking-wider">Skill Building</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-balance">Learn & Grow with Our Workshops</h2>
            <p className="mt-4 text-lg opacity-90 max-w-xl">
              From facilitation skills to sustainable business models, our workshops help you develop the capabilities
              you need to make an impact.
            </p>
          </div>
          <Button size="lg" variant="secondary" className="text-lg px-8 py-6 gap-2 whitespace-nowrap" asChild>
            <Link href="/workshops">
              Explore Workshops
              <ArrowRight className="w-5 h-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
