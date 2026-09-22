// The design-system surface synced to claude.ai/design.
//
// Scoped to what the homepage, the rooms pages and the community page are
// built from: the shadcn primitives carrying the Commons Hub theme, and the
// page sections that give the site its shape. Everything re-exported here
// lands on window.CommonsHub for the design agent to build with.

// ── primitives ──
export * from "@/components/ui/badge";
export * from "@/components/ui/button";
export * from "@/components/ui/card";
export * from "@/components/ui/checkbox";
export * from "@/components/ui/hover-card";
export * from "@/components/ui/input";
export * from "@/components/ui/label";
export * from "@/components/ui/select";
export * from "@/components/ui/textarea";

// ── page sections ──
export * from "@/components/hero";
export * from "@/components/about-section";
export * from "@/components/events-section";
export * from "@/components/booking-section";
export * from "@/components/commons-section";
export * from "@/components/economy-section";
export * from "@/components/membership-preview-section";
export * from "@/components/workshops-cta";
export * from "@/components/newsletter-section";
export * from "@/components/empty-data-state";
export * from "@/components/room-booking-form";
export * from "@/components/community-activity-gallery";
export * from "@/components/recent-contributors";
export * from "@/components/other-members";
export * from "@/components/discord-stats";

// optimized-image default-exports as `Image`; give it its own name.
export { default as OptimizedImage } from "@/components/optimized-image";
