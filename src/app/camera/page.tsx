import type { Metadata } from "next";
import { CameraPlayer } from "@/components/camera-player";

export const metadata: Metadata = {
  title: "Live Camera | Commons Hub Brussels",
  description: "Live camera feed from Commons Hub Brussels.",
};

export default function CameraPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        <section className="py-24 bg-linear-to-b from-primary/10 to-background">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
                Live Camera
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Live view from the Commons Hub Brussels.
              </p>
            </div>
            <div className="rounded-2xl overflow-hidden shadow-2xl bg-black aspect-video">
              <CameraPlayer />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
