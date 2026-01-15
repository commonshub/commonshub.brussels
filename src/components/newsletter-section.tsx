"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Mail, ExternalLink, Calendar } from "lucide-react"
import useSWR from "swr"
import Image from "next/image"
import { getProxiedImageUrl } from "@/lib/image-proxy"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface NewsletterIssue {
  title: string
  link: string
  description: string
  pubDate: string
  coverImage?: string
}


export function NewsletterSection() {
  const { data } = useSWR<{ issues: NewsletterIssue[]; subscribeUrl: string }>("/api/newsletter", fetcher)

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    } catch {
      return dateStr
    }
  }

  return (
    <section id="newsletter" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Newsletter</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Stay updated with the latest news, events, and stories from Commons Hub Brussels
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-10">
          {data?.issues?.slice(0, 2).map((issue, index) => (
            <a key={index} href={issue.link} target="_blank" rel="noopener noreferrer" className="block group">
              <Card className="h-full transition-all duration-300 hover:shadow-lg hover:border-primary/50 overflow-hidden">
                {issue.coverImage && (
                  <div className="relative h-48 w-full overflow-hidden">
                    <Image
                      src={getProxiedImageUrl(issue.coverImage, undefined, { relative: true }) || "/placeholder.svg"}
                      alt={issue.title}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  </div>
                )}
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors mb-2">
                        {issue.title}
                      </h3>
                      {issue.pubDate && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
                          <Calendar className="h-3 w-3" />
                          {formatDate(issue.pubDate)}
                        </div>
                      )}
                      <p className="text-sm text-muted-foreground line-clamp-3">{issue.description}</p>
                    </div>
                    <ExternalLink className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>

        <div className="text-center">
          <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer">
            <a
              href={data?.subscribeUrl || "https://paragraph.com/@commonshub_bxl"}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Mail className="mr-2 h-5 w-5" />
              Subscribe to our Newsletter
            </a>
          </Button>
        </div>
      </div>
    </section>
  )
}
