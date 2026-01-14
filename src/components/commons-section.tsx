import Image from "next/image"

export function CommonsSection() {
  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* A space as a common */}
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center mb-20 md:mb-32">
          <div className="relative aspect-[4/3] rounded-lg overflow-hidden">
            <Image
              src="/images/chb-livingroom.avif"
              alt="Community members gathered in the Commons Hub living room"
              fill
              className="object-cover"
            />
          </div>
          <div className="space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">A space as a common</h2>
            <p className="text-lg text-muted-foreground">
              The Commons Hub Brussels is a shared space to meet, co-create, work, and organize events. It is managed as
              a common itself, with shared responsibilities and ownership.
            </p>
            <p className="text-lg text-muted-foreground">
              <strong className="text-foreground">All members are crew.</strong> We share responsibilities to steward
              our common resources.
            </p>
          </div>
        </div>

        {/* A space to experience community */}
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
          <div className="space-y-4 order-2 md:order-1">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              A space to
              <br />
              <span className="text-primary">experience community</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              We invite you to join a community of commoners, citizens that put resources in common.
            </p>
            <p className="text-lg text-muted-foreground">
              Sharing is caring. Here, collaboration and regeneration go hand in hand, making our collective impact
              greater than the sum of its parts. <strong className="text-foreground">Community is immunity.</strong>
            </p>
          </div>
          <div className="relative aspect-[4/3] rounded-lg overflow-hidden order-1 md:order-2">
            <Image
              src="/images/chb-ostrom-circle.jpeg"
              alt="Community circle gathering at the Commons Hub"
              fill
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
