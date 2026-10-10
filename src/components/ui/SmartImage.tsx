/**
 * src/components/ui/SmartImage.tsx
 * WHAT: An image component that lazily loads, fades in, shows a skeleton while
 *       loading and falls back to a placeholder icon if the image fails.
 * WHY : Lodge and item photos come from Cloudinary or a user's seed data. On a
 *       slow network an image can take seconds, and a broken image icon looks
 *       unprofessional. This component handles all three cases gracefully.
 *
 * NOTE: We deliberately use a plain <img> with loading="lazy" instead of
 * next/image for user-supplied URLs, because next/image needs every hostname
 * pre-approved at build time. The `optimisedUrl` helper still rewrites
 * Cloudinary URLs to serve compressed WebP, so the data saving is the same.
 */
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { optimisedUrl } from "@/lib/cloudinary-url";
import { ImageIcon } from "./Icons";

type SmartImageProps = {
  src: string | null | undefined;
  alt: string;
  /** Width in pixels for the Cloudinary transformation. */
  width?: number;
  className?: string;
  /** Extra classes for the wrapper. */
  wrapperClassName?: string;
  /** Render as a square (avatars, thumbnails). */
  rounded?: "none" | "md" | "lg" | "xl" | "full";
};

/** Corner radius options, mapped so Tailwind can see the class names. */
const radiusClasses = {
  none: "",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  full: "rounded-full",
} as const;

/**
 * SmartImage
 * WHAT: A resilient image.
 * WHY : One component handles loading, errors and compression for every photo
 *       in the app.
 */
export function SmartImage({
  src,
  alt,
  width = 900,
  className,
  wrapperClassName,
  rounded = "xl",
}: SmartImageProps) {
  // Track whether the image has loaded or failed so we can swap the UI.
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // Rewrite Cloudinary URLs to serve a compressed, correctly-sized version.
  const url = src ? optimisedUrl(src, width) : "";
  const showFallback = !url || failed;

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-slate-100",
        radiusClasses[rounded],
        wrapperClassName
      )}
    >
      {showFallback ? (
        // Fallback: a centred icon on a neutral background.
        <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-300">
          <ImageIcon size={32} />
        </div>
      ) : (
        <>
          {/* Skeleton shown until the real image paints. */}
          {!loaded ? <div className="mc-skeleton absolute inset-0" aria-hidden="true" /> : null}
          <img
            src={url}
            alt={alt}
            // Lazy loading: images below the fold are not downloaded until the
            // user scrolls near them. Critical on expensive mobile data.
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={cn(
              "h-full w-full object-cover transition-opacity duration-300",
              loaded ? "opacity-100" : "opacity-0",
              className
            )}
          />
        </>
      )}
    </div>
  );
}

/**
 * Avatar
 * WHAT: A circular user photo, or the user's initials when there is no photo.
 * WHY : Most students will not upload a photo. Initials on a coloured circle
 *       look intentional instead of broken.
 */
export function Avatar({
  src,
  name,
  size = 40,
  className,
}: {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  // Take the first letter of up to two words.
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-100 text-primary-700", className)}
      style={{ width: size, height: size }}
      aria-hidden={src ? undefined : true}
    >
      {src ? (
        <SmartImage src={src} alt={name} width={size * 2} rounded="full" wrapperClassName="h-full w-full" />
      ) : (
        <span className="text-xs font-bold" style={{ fontSize: Math.max(11, size / 3.2) }}>
          {initials || "?"}
        </span>
      )}
    </div>
  );
}
