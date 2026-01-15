"use client";

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import Image from "next/image";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  ChevronLeft,
  ChevronRight,
  X,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DiscordMessage } from "./discord-message";
import {
  FavoriteButton,
  FavoriteButtonHandle,
} from "@/components/favorite-button";
import { RemoveButton } from "@/components/remove-button";
import { getProxiedImageUrl } from "@/lib/image-proxy";
import { useSession } from "next-auth/react";
import settings from "@/settings/settings.json";

// Hook for swipe gestures
function useSwipeGesture(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  enabled: boolean
) {
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchMove = (e: TouchEvent) => {
      touchEndX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = () => {
      const swipeThreshold = 50; // minimum distance for swipe
      const diff = touchStartX.current - touchEndX.current;

      if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
          // Swiped left - go to next
          onSwipeLeft();
        } else {
          // Swiped right - go to previous
          onSwipeRight();
        }
      }
    };

    document.addEventListener("touchstart", handleTouchStart);
    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [onSwipeLeft, onSwipeRight, enabled]);
}

interface ImageLightboxProps {
  images: Array<{
    url: string;
    thumbnailUrl?: string;
    caption?: string;
    author?: {
      id: string;
      displayName: string;
      avatar: string | null;
    };
    messageId?: string;
    channelId?: string;
    reactions?: Array<{ emoji: string; count: number; me?: boolean }>;
    timestamp?: string;
    attachmentId?: string;
  }>;
  thumbnailSize?: "sm" | "md" | "lg";
  layout?: "wrap" | "scroll";
  showThumbnails?: boolean;
  onImageClick?: (index: number) => void;
  userMap?: Record<string, { username: string; displayName: string } | string>;
  channelMap?: Record<string, string>;
  guildId?: string;
}

export interface ImageLightboxHandle {
  openLightbox: (index: number) => void;
  closeLightbox: () => void;
}

export const ImageLightbox = forwardRef<
  ImageLightboxHandle,
  ImageLightboxProps
>(
  (
    {
      images,
      thumbnailSize = "md",
      layout = "wrap",
      showThumbnails = true,
      onImageClick,
      userMap = {},
      channelMap = {},
      guildId = "",
    },
    ref
  ) => {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const favoriteButtonRef = useRef<FavoriteButtonHandle>(null);
    const { data: session } = useSession();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Update URL when image is opened or changed
    const updateUrl = useCallback(
      (index: number | null) => {
        const currentImageId = searchParams.get("image");
        const newImageId = index !== null && images[index]?.attachmentId
          ? images[index].attachmentId
          : null;

        // Only update if the URL actually needs to change
        if (currentImageId === newImageId) {
          return;
        }

        const params = new URLSearchParams(searchParams.toString());

        if (newImageId) {
          params.set("image", newImageId);
        } else {
          params.delete("image");
        }

        const newUrl = params.toString()
          ? `${pathname}?${params.toString()}`
          : pathname;

        router.push(newUrl, { scroll: false });
      },
      [images, pathname, router, searchParams]
    );

    const openLightbox = useCallback(
      (index: number) => {
        setSelectedIndex(index);
        updateUrl(index);
        onImageClick?.(index);
      },
      [onImageClick, updateUrl]
    );

    const closeLightbox = useCallback(() => {
      setSelectedIndex(null);
      updateUrl(null);
    }, [updateUrl]);

    useImperativeHandle(
      ref,
      () => ({
        openLightbox,
        closeLightbox,
      }),
      [openLightbox, closeLightbox]
    );

    const goToPrevious = useCallback(() => {
      if (selectedIndex !== null && selectedIndex > 0) {
        const newIndex = selectedIndex - 1;
        setSelectedIndex(newIndex);
        updateUrl(newIndex);
      }
    }, [selectedIndex, updateUrl]);

    const goToNext = useCallback(() => {
      if (selectedIndex !== null && selectedIndex < images.length - 1) {
        const newIndex = selectedIndex + 1;
        setSelectedIndex(newIndex);
        updateUrl(newIndex);
      }
    }, [selectedIndex, images.length, updateUrl]);

    // Enable swipe gestures when lightbox is open
    useSwipeGesture(goToNext, goToPrevious, selectedIndex !== null);

    // Prefetch next image when image changes
    useEffect(() => {
      if (selectedIndex !== null && selectedIndex < images.length - 1) {
        const nextImage = images[selectedIndex + 1];
        const nextImageUrl = getProxiedImageUrl(nextImage.url, undefined, { relative: true });
        const img = new window.Image();
        img.src = nextImageUrl;
      }
    }, [selectedIndex, images]);

    useEffect(() => {
      if (selectedIndex === null) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          goToPrevious();
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          goToNext();
        } else if (e.key === "Escape") {
          e.preventDefault();
          closeLightbox();
        } else if (e.key === "f" || e.key === "F") {
          // Feature/star the current image
          e.preventDefault();
          favoriteButtonRef.current?.toggleStar();
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [selectedIndex, goToPrevious, goToNext, closeLightbox]);

    const sizeClasses = {
      sm: "w-24 h-24",
      md: "w-32 h-32",
      lg: "w-48 h-48",
    };

    if (images.length === 0) return null;

    return (
      <>
        {showThumbnails && (
          <div
            className={
              layout === "scroll"
                ? "flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
                : "flex flex-wrap gap-2"
            }
          >
            {images.map((image, index) => {
              return (
                <button
                  key={index}
                  onClick={() => openLightbox(index)}
                  className={`relative ${sizeClasses[thumbnailSize]} rounded-lg overflow-hidden group cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary ${layout === "scroll" ? "flex-shrink-0" : ""}`}
                >
                  <Image
                    src={
                      getProxiedImageUrl(image.thumbnailUrl || image.url, undefined, { relative: true }) ||
                      "/placeholder.svg"
                    }
                    alt={image.caption || "Image"}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                    sizes="128px"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                </button>
              );
            })}
          </div>
        )}

        <Dialog
          open={selectedIndex !== null}
          onOpenChange={(open) => {
            if (!open) closeLightbox();
          }}
        >
          <DialogContent
            className="!max-w-none !w-screen !h-[100dvh] !max-h-[100dvh] p-0 bg-black border-none rounded-none !z-[60]"
            showCloseButton={false}
          >
            <DialogTitle className="sr-only">
              Image gallery -{" "}
              {selectedIndex !== null
                ? `Image ${selectedIndex + 1} of ${images.length}`
                : ""}
            </DialogTitle>
            <div
              className="relative w-full h-full flex flex-col pointer-events-auto"
              onClick={closeLightbox}
            >
              {/* Reaction buttons - top left with iOS safe area */}
              {selectedIndex !== null && (() => {
                const currentImage = images[selectedIndex];
                const userId = session?.user?.discordId;
                const userRoles = session?.user?.roles || [];

                // Check if user can add remove emoji
                // Admin check - note: we need to add admin role to settings if not present
                const isAdmin = userRoles.includes(settings.discord.roles.member); // TODO: add proper admin role
                const isAuthor = currentImage?.author && userId === currentImage.author.id;
                // TODO: check if user is mentioned in the message
                const canRemove = isAdmin || isAuthor;

                return (
                  <div
                    className="fixed z-[9999] pointer-events-auto flex gap-2"
                    style={{
                      zIndex: 9999,
                      top: "max(0.5rem, env(safe-area-inset-top))",
                      left: "max(0.5rem, env(safe-area-inset-left))",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <FavoriteButton
                      ref={favoriteButtonRef}
                      channelId={currentImage?.channelId}
                      messageId={currentImage?.messageId}
                      reactions={currentImage?.reactions}
                      className="text-white hover:bg-white/20 bg-black/50 backdrop-blur-sm cursor-pointer shadow-lg"
                    />
                    {canRemove && (
                      <RemoveButton
                        channelId={currentImage?.channelId}
                        messageId={currentImage?.messageId}
                        reactions={currentImage?.reactions}
                        className="text-white hover:bg-white/20 bg-black/50 backdrop-blur-sm cursor-pointer shadow-lg"
                      />
                    )}
                  </div>
                );
              })()}

              {/* Close button - top right with iOS safe area */}
              <div
                className="fixed z-[9999] pointer-events-auto"
                style={{
                  zIndex: 9999,
                  top: "max(0.5rem, env(safe-area-inset-top))",
                  right: "max(0.5rem, env(safe-area-inset-right))",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20 bg-black/50 backdrop-blur-sm cursor-pointer shadow-lg"
                  onClick={closeLightbox}
                  aria-label="Close"
                >
                  <X className="w-6 h-6" />
                </Button>
              </div>

              {selectedIndex !== null &&
                (() => {
                  const currentImage = images[selectedIndex];

                  return (
                    <>
                      <div
                        className="relative flex-1 w-full h-full pointer-events-none"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Image
                          key={`image-${selectedIndex}`}
                          src={
                            getProxiedImageUrl(currentImage.url, undefined, { relative: true }) ||
                            "/placeholder.svg"
                          }
                          alt={currentImage.caption || "Image"}
                          fill
                          className="object-contain pointer-events-auto"
                          sizes="100vw"
                          priority
                        />
                      </div>

                      <div
                        className="absolute inset-y-0 z-[100] flex items-center justify-center"
                        style={{
                          left: "env(safe-area-inset-left)",
                          width:
                            "max(5rem, calc(5rem + env(safe-area-inset-left)))",
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-14 h-14 text-white hover:bg-white/20 disabled:opacity-30 cursor-pointer bg-black/20 backdrop-blur-sm"
                          onClick={goToPrevious}
                          disabled={selectedIndex === 0}
                        >
                          <ChevronLeft className="w-12 h-12" />
                        </Button>
                      </div>

                      <div
                        className="absolute inset-y-0 z-[100] flex items-center justify-center"
                        style={{
                          right: "env(safe-area-inset-right)",
                          width:
                            "max(5rem, calc(5rem + env(safe-area-inset-right)))",
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-14 h-14 text-white hover:bg-white/20 disabled:opacity-30 cursor-pointer bg-black/20 backdrop-blur-sm"
                          onClick={goToNext}
                          disabled={selectedIndex === images.length - 1}
                        >
                          <ChevronRight className="w-12 h-12" />
                        </Button>
                      </div>

                      {currentImage.caption && currentImage.author && (
                        <div
                          className="absolute bottom-0 left-0 right-0 p-6 text-white bg-gradient-to-t from-black/90 via-black/60 to-transparent"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="max-w-4xl">
                            <div className="flex items-center gap-3 mb-3">
                              <Avatar className="w-10 h-10 border-2 border-white/20">
                                <AvatarImage
                                  src={currentImage.author.avatar || undefined}
                                />
                                <AvatarFallback className="bg-primary text-primary-foreground">
                                  {currentImage.author.displayName
                                    .charAt(0)
                                    .toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span className="text-lg font-semibold">
                                  {currentImage.author.displayName}
                                </span>
                                {currentImage.timestamp && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-white/70">
                                      {new Date(
                                        currentImage.timestamp
                                      ).toLocaleDateString("en-US", {
                                        year: "numeric",
                                        month: "short",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                    {currentImage.channelId &&
                                      currentImage.messageId &&
                                      guildId && (
                                        <a
                                          href={`https://discord.com/channels/${guildId}/${currentImage.channelId}/${currentImage.messageId}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center text-white/70 hover:text-white transition-colors"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <ExternalLink className="w-4 h-4" />
                                        </a>
                                      )}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-base leading-relaxed">
                              <DiscordMessage
                                content={currentImage.caption}
                                userMap={userMap}
                                channelMap={channelMap}
                                guildId={guildId}
                                className="text-white"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Page counter - bottom right */}
                      <div className="absolute bottom-4 right-4 text-white/80 text-sm bg-black/50 px-3 py-1.5 rounded-full">
                        {selectedIndex + 1} / {images.length}
                      </div>
                    </>
                  );
                })()}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }
);

ImageLightbox.displayName = "ImageLightbox";
