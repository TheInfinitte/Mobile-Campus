/**
 * src/components/shared/ImageUploader.tsx
 * WHAT: Picks photos from the phone's gallery or camera, compresses them in the
 *       browser, uploads them straight to Cloudinary, and returns the URLs.
 * WHY : Three reasons this matters on a Nigerian student phone:
 *       1. Compression in the browser means we upload ~150KB instead of 4MB.
 *       2. Uploading straight to Cloudinary keeps large files off our server.
 *       3. The user sees a progress state per image, so a slow upload is not
 *          mistaken for a frozen app.
 *
 * SECURITY: We use Cloudinary's UNSIGNED upload preset. The preset is public but
 * restricted (folder, max size, allowed formats) and never exposes our API key.
 */
"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CameraIcon, CloseIcon, ImageIcon } from "@/components/ui/Icons";
import { SmartImage } from "@/components/ui/SmartImage";
import { cn } from "@/lib/utils";

/** Per-image upload state shown in the grid. */
type UploadState = {
  id: string;
  preview: string;   // Local blob URL for instant preview.
  status: "uploading" | "done" | "error";
  url?: string;      // Cloudinary URL once uploaded.
  error?: string;
};

type ImageUploaderProps = {
  /** Called with the full list of Cloudinary URLs after every change. */
  onChange: (urls: string[]) => void;
  maxImages?: number;
  /** Where the images go inside Cloudinary, e.g. "lodges" or "market". */
  folder?: string;
  label?: string;
  error?: string;
};

/** The longest side we keep. 1600px is plenty for a phone screen. */
const MAX_DIMENSION = 1600;
/** JPEG quality after compression. 0.75 looks great and is ~5x smaller. */
const QUALITY = 0.75;
/** Largest file we will accept before compressing (10MB). */
const MAX_FILE_BYTES = 10 * 1024 * 1024;

/**
 * compressImage
 * WHAT: Resizes and re-encodes an image file using a canvas.
 * WHY : Phone cameras produce 12-megapixel photos. Nobody needs that for a lodge
 *       listing, and the data cost would stop students from uploading at all.
 */
async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // Read the file as a data URL so the <img> element can load it.
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.onload = () => {
      const image = new Image();

      image.onerror = () => reject(new Error("That file is not a valid image."));
      image.onload = () => {
        // Work out the new size while keeping the aspect ratio.
        const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height));
        const width = Math.round(image.width * scale);
        const height = Math.round(image.height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Your browser cannot process images."));
          return;
        }

        context.drawImage(image, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Could not compress that image."));
          },
          "image/jpeg",
          QUALITY
        );
      };

      image.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * ImageUploader
 * WHAT: A grid of uploaded images with an "Add photo" tile.
 * WHY : Reused for lodge photos, item photos, verification documents and dispute
 *       evidence - four places that all need the same behaviour.
 */
export function ImageUploader({ onChange, maxImages = 8, folder = "uploads", label = "Photos", error }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<UploadState[]>([]);

  /** Pushes the successfully-uploaded URLs up to the parent form. */
  const emit = (list: UploadState[]) => onChange(list.filter((image) => image.url).map((image) => image.url as string));

  /** Handles the user picking one or more files. */
  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    // Cloudinary settings come from our own API route, so no key is in the bundle.
    let cloudName = "";
    let preset = "";
    try {
      const response = await fetch("/api/upload/preset");
      const payload = (await response.json()) as { data?: { cloudName: string; uploadPreset: string } };
      cloudName = payload.data?.cloudName ?? "";
      preset = payload.data?.uploadPreset ?? "";
    } catch {
      // Handled below - we show an error on the tile.
    }

    if (!cloudName || !preset) {
      setImages((current) => [
        ...current,
        { id: `err-${Date.now()}`, preview: "", status: "error", error: "Image upload is not configured yet." },
      ]);
      return;
    }

    // Take only as many as we are allowed.
    const accepted = Array.from(files).slice(0, Math.max(0, maxImages - images.length));

    for (const file of accepted) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      if (file.size > MAX_FILE_BYTES) {
        setImages((current) => [...current, { id, preview: "", status: "error", error: "That image is larger than 10MB." }]);
        continue;
      }

      // Show an instant preview from the local file while we compress.
      const preview = URL.createObjectURL(file);
      setImages((current) => [...current, { id, preview, status: "uploading" }]);

      try {
        const blob = await compressImage(file);

        const form = new FormData();
        form.append("file", blob, "photo.jpg");
        form.append("upload_preset", preset);
        // Putting uploads in a folder keeps the Cloudinary account organised.
        form.append("folder", `mobile-campus/${folder}`);

        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: "POST",
          body: form,
        });

        const data = (await response.json()) as { secure_url?: string; error?: { message: string } };

        if (!response.ok || !data.secure_url) {
          throw new Error(data.error?.message ?? "Upload failed.");
        }

        setImages((current) => {
          const next = current.map((image) =>
            image.id === id ? { ...image, status: "done" as const, url: data.secure_url } : image
          );
          emit(next);
          return next;
        });
      } catch (uploadError) {
        setImages((current) =>
          current.map((image) =>
            image.id === id
              ? { ...image, status: "error" as const, error: uploadError instanceof Error ? uploadError.message : "Upload failed." }
              : image
          )
        );
      }
    }

    // Clear the input so picking the same file again still fires onChange.
    if (inputRef.current) inputRef.current.value = "";
  }

  /** Removes an image from the grid and tells the parent. */
  function remove(id: string) {
    setImages((current) => {
      const next = current.filter((image) => image.id !== id);
      emit(next);
      return next;
    });
  }

  const canAddMore = images.length < maxImages;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="mc-label mb-0">{label}</span>
        <span className="text-[11px] text-slate-400">
          {images.filter((image) => image.status === "done").length}/{maxImages}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
        {/* Already-added images */}
        {images.map((image) => (
          <div key={image.id} className="relative aspect-square overflow-hidden rounded-xl bg-slate-100">
            {image.preview ? (
              <SmartImage src={image.preview} alt="Upload preview" width={300} rounded="none" wrapperClassName="h-full w-full" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-300">
                <ImageIcon size={24} />
              </div>
            )}

            {/* Status overlay */}
            {image.status === "uploading" ? (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
              </div>
            ) : null}

            {image.status === "error" ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-danger/85 px-1 text-center">
                <span className="text-[10px] font-semibold leading-tight text-white">{image.error ?? "Failed"}</span>
              </div>
            ) : null}

            {/* Remove button - 32px, but placed in a corner away from other targets. */}
            <button
              type="button"
              onClick={() => remove(image.id)}
              aria-label="Remove image"
              className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/70 text-white"
            >
              <CloseIcon size={14} />
            </button>
          </div>
        ))}

        {/* The "add" tile */}
        {canAddMore ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 bg-white text-slate-400",
              "transition-colors hover:border-primary-300 hover:text-primary-600"
            )}
          >
            <CameraIcon size={22} />
            <span className="text-[10px] font-semibold">Add photo</span>
          </button>
        ) : null}
      </div>

      {/* A hidden file input. `capture` is omitted so the phone offers both the
          camera and the gallery. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={maxImages > 1}
        onChange={(event) => void handleFiles(event.target.files)}
        className="hidden"
      />

      {error ? <p className="mt-2 text-xs font-medium text-danger">{error}</p> : null}

      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
        Photos are compressed automatically before upload to save your data. Clear, well-lit photos get far more responses.
      </p>
    </div>
  );
}
