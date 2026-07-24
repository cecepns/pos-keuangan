import React, { useState, useRef, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, X, Expand } from "lucide-react";

export default function ProductImageGallery({ images, resolveUrl, alt = "Produk" }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const touchStart = useRef({ x: 0, y: 0 });

  const goPrev = useCallback(() => {
    setActiveIndex((i) => (i === 0 ? images.length - 1 : i - 1));
  }, [images.length]);

  const goNext = useCallback(() => {
    setActiveIndex((i) => (i === images.length - 1 ? 0 : i + 1));
  }, [images.length]);

  const handleTouchStart = (e) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 45) {
      if (dx > 0) goPrev();
      else goNext();
    }
  };

  useEffect(() => {
    if (!fullscreen) return undefined;
    const onKey = (e) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen, goPrev, goNext]);

  useEffect(() => {
    if (fullscreen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [fullscreen]);

  if (!images.length) return null;

  const renderSlide = (isFullscreen) => (
    <div
      className={
        isFullscreen
          ? "relative flex-1 flex items-center justify-center w-full min-h-0 px-4 select-none"
          : "relative aspect-square bg-slate-50 overflow-hidden rounded-2xl border border-slate-100"
      }
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <img
        src={resolveUrl(images[activeIndex])}
        alt={`${alt} - ${activeIndex + 1}`}
        onClick={() => !isFullscreen && setFullscreen(true)}
        className={`object-contain w-full max-w-full ${
          isFullscreen ? "max-h-[85vh] cursor-default" : "h-full cursor-zoom-in"
        }`}
        draggable={false}
      />

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className={`absolute left-2 md:left-4 p-2 rounded-full shadow-lg transition-all ${
              isFullscreen
                ? "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                : "bg-white/80 hover:bg-white text-slate-700 border border-slate-100"
            }`}
            aria-label="Gambar sebelumnya"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className={`absolute right-2 md:right-4 p-2 rounded-full shadow-lg transition-all ${
              isFullscreen
                ? "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                : "bg-white/80 hover:bg-white text-slate-700 border border-slate-100"
            }`}
            aria-label="Gambar berikutnya"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div
            className={`absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold ${
              isFullscreen ? "bg-black/50 text-white" : "bg-black/60 text-white"
            }`}
          >
            {activeIndex + 1} / {images.length}
          </div>
        </>
      )}

      {!isFullscreen && images.length > 1 && (
        <div className="absolute top-3 right-3 bg-black/50 text-white text-2xs font-semibold px-2 py-1 rounded-lg flex items-center gap-1 pointer-events-none">
          <Expand className="w-3 h-3" />
          Ketuk untuk perbesar
        </div>
      )}
    </div>
  );

  const renderThumbnails = (variant) => (
    <div
      className={`flex justify-center gap-2 overflow-x-auto scrollbar-none ${
        variant === "fullscreen" ? "p-4 bg-black/40" : "p-3 bg-white border-t border-slate-100"
      }`}
    >
      {images.map((img, idx) => (
        <button
          key={idx}
          type="button"
          onClick={() => setActiveIndex(idx)}
          className={`w-14 h-14 rounded-lg border-2 overflow-hidden flex-shrink-0 transition-all ${
            activeIndex === idx
              ? variant === "fullscreen"
                ? "border-emerald-400 scale-95"
                : "border-emerald-600 scale-95"
              : variant === "fullscreen"
                ? "border-white/30 opacity-70 hover:opacity-100"
                : "border-slate-200"
          }`}
        >
          <img src={resolveUrl(img)} className="object-cover w-full h-full" alt={`thumbnail-${idx}`} />
        </button>
      ))}
    </div>
  );

  return (
    <>
      <div className="flex flex-col">
        {renderSlide(false)}
        {images.length > 1 && renderThumbnails("inline")}
        {images.length > 1 && (
          <p className="text-center text-2xs text-slate-400 mt-2 font-medium">
            Geser kiri/kanan untuk melihat foto lainnya
          </p>
        )}
      </div>

      {fullscreen && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex flex-col animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-label="Galeri gambar produk"
        >
          <div className="flex items-center justify-between p-4 text-white shrink-0">
            <span className="text-sm font-bold truncate pr-4">{alt}</span>
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all"
              aria-label="Tutup"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {renderSlide(true)}
          {images.length > 1 && renderThumbnails("fullscreen")}
        </div>
      )}
    </>
  );
}
