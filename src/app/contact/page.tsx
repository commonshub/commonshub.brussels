import { ContactForm } from "@/components/contact-form"
import { MapPin, Mail } from "lucide-react"

export const metadata = {
  title: "Contact Us | Commons Hub Brussels",
  description:
    "Get in touch with Commons Hub Brussels. Book a room, join our community, or visit us at Rue de la Madeleine 51, 1000 Brussels.",
}

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="pt-24 pb-16">
        {/* Hero Section */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-primary/5 to-background">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">Get in Touch</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Have a question or want to visit? We'd love to hear from you!
            </p>
          </div>
        </section>

        {/* Contact Info & Map */}
        <section className="py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8 mb-12">
              {/* Contact Info */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-4">Visit Us</h2>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium">Commons Hub Brussels</p>
                        <a
                          href="https://map.commonshub.brussels"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary transition-colors"
                        >
                          Rue de la Madeleine 51
                          <br />
                          1000 Brussels
                        </a>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-primary flex-shrink-0" />
                      <a
                        href="mailto:hello@commonshub.brussels"
                        className="text-muted-foreground hover:text-primary transition-colors"
                      >
                        hello@commonshub.brussels
                      </a>
                    </div>
                  </div>
                </div>

                <div className="bg-card p-6 rounded-lg border border-border">
                  <h3 className="font-semibold mb-2">Opening Hours</h3>
                  <p className="text-sm text-muted-foreground">
                    We're a community-driven space. Opening hours vary based on events and activities.
                    <br />
                    <br />
                    Drop by on Fridays for our community potluck!
                  </p>
                </div>
              </div>

              {/* Map */}
              <div className="rounded-lg overflow-hidden border border-border shadow-sm h-[400px]">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2519.1234567890123!2d4.356611!3d50.845611!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47c3c38b08d3c6c9%3A0x1234567890abcdef!2sRue%20de%20la%20Madeleine%2051%2C%201000%20Bruxelles!5e0!3m2!1sen!2sbe!4v1234567890123!5m2!1sen!2sbe"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Commons Hub Brussels Location"
                ></iframe>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Form */}
        <section className="py-12 px-4 sm:px-6 lg:px-8 bg-card/50">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">Send Us a Message</h2>
              <p className="text-muted-foreground">
                Fill out the form below and we'll get back to you as soon as possible.
              </p>
            </div>

            <ContactForm />
          </div>
        </section>
      </div>
    </main>
  )
}
