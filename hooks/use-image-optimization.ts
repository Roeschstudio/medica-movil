"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ImageOptimizationOptions {
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  format?: "webp" | "jpeg" | "png";
  enableLazyLoading?: boolean;
  placeholder?: string;
}

interface OptimizedImage {
  src: string;
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useImageOptimization(
  originalSrc: string,
  options: ImageOptimizationOptions = {}
): OptimizedImage {
  const {
    quality = 80,
    maxWidth = 800,
    maxHeight = 600,
    format = "webp",
    enableLazyLoading = true,
    placeholder = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkNhcmdhbmRvLi4uPC90ZXh0Pjwvc3ZnPg==",
  } = options;

  const [optimizedImage, setOptimizedImage] = useState<OptimizedImage>({
    src: placeholder,
    isLoaded: false,
    isLoading: false,
    error: null,
  });

  const imgRef = useRef<HTMLImageElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const cacheRef = useRef<Map<string, OptimizedImage>>(new Map());
  const compressionWorkerRef = useRef<Worker | null>(null);

  // Generate optimized URL (for Supabase Storage)
  const generateOptimizedUrl = useCallback(
    (src: string) => {
      if (!src || src === placeholder) return src;

      // Check if it's a Supabase Storage URL
      if (src.includes("supabase") && src.includes("storage")) {
        const url = new URL(src);
        const params = new URLSearchParams();

        params.set("width", maxWidth.toString());
        params.set("height", maxHeight.toString());
        params.set("resize", "contain");
        params.set("quality", quality.toString());

        if (format === "webp") {
          params.set("format", "webp");
        }

        url.search = params.toString();
        return url.toString();
      }

      return src;
    },
    [maxWidth, maxHeight, quality, format]
  );

  // Initialize compression worker
  useEffect(() => {
    if (typeof Worker !== "undefined" && !compressionWorkerRef.current) {
      try {
        const workerCode = `
          self.onmessage = async function(e) {
            const { imageData, quality, format } = e.data;
            
            try {
              // Create canvas for compression
              const canvas = new OffscreenCanvas(imageData.width, imageData.height);
              const ctx = canvas.getContext('2d');
              
              // Draw image data to canvas
              const imageDataObj = new ImageData(imageData.data, imageData.width, imageData.height);
              ctx.putImageData(imageDataObj, 0, 0);
              
              // Convert to blob with compression
              const blob = await canvas.convertToBlob({
                type: format === 'webp' ? 'image/webp' : 'image/jpeg',
                quality: quality / 100
              });
              
              // Convert blob to data URL
              const reader = new FileReader();
              reader.onload = () => self.postMessage({ success: true, dataUrl: reader.result });
              reader.onerror = () => self.postMessage({ success: false, error: 'Compression failed' });
              reader.readAsDataURL(blob);
              
            } catch (error) {
              self.postMessage({ success: false, error: error.message });
            }
          };
        `;

        const blob = new Blob([workerCode], { type: "application/javascript" });
        compressionWorkerRef.current = new Worker(URL.createObjectURL(blob));
      } catch (error) {
        console.warn("Failed to initialize compression worker:", error);
      }
    }

    return () => {
      if (compressionWorkerRef.current) {
        compressionWorkerRef.current.terminate();
        compressionWorkerRef.current = null;
      }
    };
  }, []);

  // Load image with caching and compression
  const loadImage = useCallback(async () => {
    if (!originalSrc || originalSrc === placeholder) return;

    // Check cache first
    const cached = cacheRef.current.get(originalSrc);
    if (cached && cached.isLoaded) {
      setOptimizedImage(cached);
      return;
    }

    setOptimizedImage((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const optimizedSrc = generateOptimizedUrl(originalSrc);

      // Create a new image to test loading
      const img = new Image();
      img.crossOrigin = "anonymous"; // Enable CORS for canvas operations

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = optimizedSrc;
      });

      // Try client-side compression if worker is available
      let finalSrc = optimizedSrc;
      if (compressionWorkerRef.current && img.naturalWidth > 0) {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          if (ctx) {
            canvas.width = Math.min(img.naturalWidth, maxWidth);
            canvas.height = Math.min(img.naturalHeight, maxHeight);

            // Maintain aspect ratio
            const aspectRatio = img.naturalWidth / img.naturalHeight;
            if (canvas.width / canvas.height > aspectRatio) {
              canvas.width = canvas.height * aspectRatio;
            } else {
              canvas.height = canvas.width / aspectRatio;
            }

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Get compressed data URL
            finalSrc = canvas.toDataURL(
              format === "webp" ? "image/webp" : "image/jpeg",
              quality / 100
            );
          }
        } catch (compressionError) {
          console.warn("Client-side compression failed:", compressionError);
          // Use original optimized URL
        }
      }

      const result: OptimizedImage = {
        src: finalSrc,
        isLoaded: true,
        isLoading: false,
        error: null,
      };

      // Cache the result
      cacheRef.current.set(originalSrc, result);

      // Limit cache size
      if (cacheRef.current.size > 100) {
        const firstKey = cacheRef.current.keys().next().value;
        cacheRef.current.delete(firstKey);
      }

      setOptimizedImage(result);
    } catch (error) {
      console.error("Error loading optimized image:", error);

      // Fallback to original image
      try {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () =>
            reject(new Error("Failed to load original image"));
          img.src = originalSrc;
        });

        const fallbackResult: OptimizedImage = {
          src: originalSrc,
          isLoaded: true,
          isLoading: false,
          error: null,
        };

        cacheRef.current.set(originalSrc, fallbackResult);
        setOptimizedImage(fallbackResult);
      } catch (fallbackError) {
        const errorResult: OptimizedImage = {
          src: placeholder,
          isLoaded: false,
          isLoading: false,
          error: "Failed to load image",
        };

        setOptimizedImage(errorResult);
      }
    }
  }, [
    originalSrc,
    generateOptimizedUrl,
    placeholder,
    maxWidth,
    maxHeight,
    quality,
    format,
  ]);

  // Set up intersection observer for lazy loading
  useEffect(() => {
    if (!enableLazyLoading) {
      loadImage();
      return;
    }

    if (!imgRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (
            entry.isIntersecting &&
            !optimizedImage.isLoaded &&
            !optimizedImage.isLoading
          ) {
            loadImage();
          }
        });
      },
      {
        rootMargin: "50px", // Start loading 50px before the image comes into view
        threshold: 0.1,
      }
    );

    observerRef.current.observe(imgRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [
    enableLazyLoading,
    loadImage,
    optimizedImage.isLoaded,
    optimizedImage.isLoading,
  ]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return optimizedImage;
}

// Hook for batch image preloading
export function useImagePreloader(
  urls: string[],
  options: ImageOptimizationOptions = {}
) {
  const [preloadedImages, setPreloadedImages] = useState<
    Map<string, OptimizedImage>
  >(new Map());
  const [isPreloading, setIsPreloading] = useState(false);

  const preloadImages = useCallback(async () => {
    if (urls.length === 0) return;

    setIsPreloading(true);
    const results = new Map<string, OptimizedImage>();

    try {
      await Promise.allSettled(
        urls.map(async (url) => {
          try {
            const optimizedUrl =
              url.includes("supabase") && url.includes("storage")
                ? (() => {
                    const urlObj = new URL(url);
                    const params = new URLSearchParams();
                    params.set("width", (options.maxWidth || 400).toString());
                    params.set("height", (options.maxHeight || 300).toString());
                    params.set("resize", "contain");
                    params.set("quality", (options.quality || 80).toString());
                    if (options.format === "webp") {
                      params.set("format", "webp");
                    }
                    urlObj.search = params.toString();
                    return urlObj.toString();
                  })()
                : url;

            const img = new Image();
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = () => reject(new Error("Failed to preload image"));
              img.src = optimizedUrl;
            });

            results.set(url, {
              src: optimizedUrl,
              isLoaded: true,
              isLoading: false,
              error: null,
            });
          } catch (error) {
            results.set(url, {
              src: url,
              isLoaded: false,
              isLoading: false,
              error: "Failed to preload image",
            });
          }
        })
      );

      setPreloadedImages(results);
    } finally {
      setIsPreloading(false);
    }
  }, [urls, options]);

  useEffect(() => {
    preloadImages();
  }, [preloadImages]);

  return {
    preloadedImages,
    isPreloading,
    getPreloadedImage: (url: string) => preloadedImages.get(url),
  };
}
