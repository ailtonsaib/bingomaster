import { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  Maximize2,
  Minimize2,
  X,
  ExternalLink,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default function AppVideo({ screenshots = [], previewRoute, appName, accent }) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [videoFullscreen, setVideoFullscreen] = useState(false);
  const [iframeFullscreen, setIframeFullscreen] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  const iframeRef = useRef(null);

  const slides = screenshots.map((s) =>
    typeof s === "string" ? { src: s, caption: "" } : s
  );

  // Auto-advance slideshow
  useEffect(() => {
    if (!playing || slides.length <= 1) return;
    const timer = setInterval(() => {
      setIdx((p) => (p + 1) % slides.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [playing, slides.length]);

  // Reset iframe loading on open
  useEffect(() => {
    if (iframeFullscreen) {
      setIframeLoading(true);
      const t = setTimeout(() => setIframeLoading(false), 3000);
      return () => clearTimeout(t);
    }
  }, [iframeFullscreen]);

  // Esc to close
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (videoFullscreen) setVideoFullscreen(false);
        if (iframeFullscreen) setIframeFullscreen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [videoFullscreen, iframeFullscreen]);

  if (!slides.length && !previewRoute) return null;

  const current = slides[idx] || slides[0];

  const openVideoFull = () => {
    setPlaying(true);
    setVideoFullscreen(true);
  };

  return (
    <div className="px-6 pb-4 space-y-2">
      {/* Vídeo slideshow — click to expand */}
      {slides.length > 0 && (
        <div
          className="relative rounded-xl overflow-hidden bg-black/5 group cursor-pointer"
          onClick={openVideoFull}
        >
          <div className="relative h-44 overflow-hidden">
            {slides.map((slide, i) => (
              <img
                key={i}
                src={slide.src}
                alt={`${appName} ${slide.caption || `tela ${i + 1}`}`}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                  i === idx ? "opacity-100" : "opacity-0"
                }`}
              />
            ))}
            <span className="absolute top-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/50 text-white">
              ▶ Telas reais do {appName}
            </span>
            {/* Caption badge */}
            {current.caption && (
              <span className="absolute top-2 right-2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/50 text-white">
                {current.caption}
              </span>
            )}
            {/* Expand hint */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
              <div className="flex flex-col items-center gap-1">
                <Maximize2 className="w-6 h-6 text-white" />
                <span className="text-[10px] text-white font-medium">Clique para expandir</span>
              </div>
            </div>
            {/* Controls overlay (non-clickable to allow card click) */}
            <div
              className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-1 pointer-events-auto">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPlaying(!playing);
                  }}
                  className="w-7 h-7 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                >
                  {playing ? (
                    <Pause className="w-3.5 h-3.5" fill="white" />
                  ) : (
                    <Play className="w-3.5 h-3.5 ml-0.5" fill="white" />
                  )}
                </button>
                {slides.length > 1 && (
                  <div className="flex items-center gap-1 ml-1">
                    {slides.map((_, i) => (
                      <button
                        key={i}
                        onClick={(e) => {
                          e.stopPropagation();
                          setIdx(i);
                          setPlaying(false);
                        }}
                        className={`h-1.5 rounded-full transition-all ${
                          i === idx ? "w-5 bg-white" : "w-1.5 bg-white/50"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
              {slides.length > 1 && (
                <div className="flex items-center gap-1 pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIdx((p) => (p - 1 + slides.length) % slides.length);
                    }}
                    className="w-7 h-7 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIdx((p) => (p + 1) % slides.length);
                    }}
                    className="w-7 h-7 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Botão tela cheia interativo */}
      {previewRoute && (
        <button
          onClick={() => setIframeFullscreen(true)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium text-white shadow-sm hover:opacity-90 transition-opacity"
          style={{ backgroundColor: accent }}
        >
          <Maximize2 className="w-3.5 h-3.5" />
          Ver aplicativo real em tela cheia
        </button>
      )}

      {/* Overlay: vídeo ampliado em tela cheia */}
      {videoFullscreen && slides.length > 0 && (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-black border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accent }} />
              <span className="text-white font-medium text-sm">
                {appName} — Demonstração das telas
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white/50 text-xs">
                {idx + 1} / {slides.length}
              </span>
              <button
                onClick={() => setVideoFullscreen(false)}
                className="text-white/60 hover:text-white p-2 rounded-md hover:bg-white/10"
                title="Fechar (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
            {slides.map((slide, i) => (
              <img
                key={i}
                src={slide.src}
                alt={`${appName} ${slide.caption || `tela ${i + 1}`}`}
                className={`absolute max-w-full max-h-full object-contain transition-opacity duration-500 ${
                  i === idx ? "opacity-100" : "opacity-0"
                }`}
              />
            ))}
            {/* Caption */}
            {current.caption && (
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/60 text-white text-sm font-medium">
                {current.caption}
              </div>
            )}
            {/* Nav arrows */}
            {slides.length > 1 && (
              <>
                <button
                  onClick={() => setIdx((p) => (p - 1 + slides.length) % slides.length)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={() => setIdx((p) => (p + 1) % slides.length)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>
          {/* Bottom controls */}
          <div className="flex items-center justify-center gap-3 py-3 bg-black border-t border-white/10">
            <button
              onClick={() => setPlaying(!playing)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              {playing ? (
                <>
                  <Pause className="w-4 h-4" fill="white" /> Pausar
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" fill="white" /> Reproduzir
                </>
              )}
            </button>
            {/* Progress dots */}
            {slides.length > 1 && (
              <div className="flex items-center gap-1.5">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIdx(i)}
                    className={`h-2 rounded-full transition-all ${
                      i === idx ? "w-8 bg-white" : "w-2 bg-white/40"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay: aplicativo real interativo em tela cheia */}
      {iframeFullscreen && previewRoute && (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 bg-black border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accent }} />
              <span className="text-white font-medium text-sm">
                {appName} — Interface real do aplicativo
              </span>
            </div>
            <div className="flex items-center gap-1">
              <a
                href={previewRoute}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/60 hover:text-white p-2 rounded-md hover:bg-white/10"
                title="Abrir em nova aba"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              <button
                onClick={() => setIframeFullscreen(false)}
                className="text-white/60 hover:text-white p-2 rounded-md hover:bg-white/10"
                title="Fechar (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 relative bg-white">
            {iframeLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white z-10">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: accent }} />
                <p className="text-sm text-gray-500">Carregando {appName}...</p>
              </div>
            )}
            <iframe
              src={previewRoute}
              className="w-full h-full border-0"
              title={appName}
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
              onLoad={() => setIframeLoading(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}