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
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [isBrowserFs, setIsBrowserFs] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  const fsContainerRef = useRef(null);

  // Auto-advance slideshow
  useEffect(() => {
    if (!playing || screenshots.length <= 1) return;
    const timer = setInterval(() => {
      setIdx((p) => (p + 1) % screenshots.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [playing, screenshots.length]);

  // Fullscreen change listener
  useEffect(() => {
    if (!fullscreenOpen) return;
    const handler = () => setIsBrowserFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, [fullscreenOpen]);

  // Reset iframe loading on open
  useEffect(() => {
    if (fullscreenOpen) {
      setIframeLoading(true);
      const t = setTimeout(() => setIframeLoading(false), 3000);
      return () => clearTimeout(t);
    }
  }, [fullscreenOpen]);

  // Esc to close
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && fullscreenOpen && !document.fullscreenElement) {
        setFullscreenOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreenOpen]);

  const toggleBrowserFs = () => {
    if (!document.fullscreenElement) {
      fsContainerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen();
    }
  };

  if (!screenshots.length && !previewRoute) return null;

  return (
    <div className="px-6 pb-4 space-y-2">
      {/* Vídeo slideshow — auto-play, view only */}
      {screenshots.length > 0 && (
        <div className="relative rounded-xl overflow-hidden bg-black/5 group">
          <div className="relative h-44 overflow-hidden">
            {screenshots.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`${appName} tela ${i + 1}`}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                  i === idx ? "opacity-100" : "opacity-0"
                }`}
              />
            ))}
            <span className="absolute top-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/50 text-white">
              ▶ Telas reais do {appName}
            </span>
            {/* Controls overlay */}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPlaying(!playing)}
                  className="w-7 h-7 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                >
                  {playing ? (
                    <Pause className="w-3.5 h-3.5" fill="white" />
                  ) : (
                    <Play className="w-3.5 h-3.5 ml-0.5" fill="white" />
                  )}
                </button>
                {screenshots.length > 1 && (
                  <div className="flex items-center gap-1 ml-1">
                    {screenshots.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => {
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
              {screenshots.length > 1 && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setIdx((p) => (p - 1 + screenshots.length) % screenshots.length)}
                    className="w-7 h-7 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIdx((p) => (p + 1) % screenshots.length)}
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
          onClick={() => setFullscreenOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium text-white shadow-sm hover:opacity-90 transition-opacity"
          style={{ backgroundColor: accent }}
        >
          <Maximize2 className="w-3.5 h-3.5" />
          Ver aplicativo real em tela cheia
        </button>
      )}

      {/* Overlay fullscreen interativo */}
      {fullscreenOpen && previewRoute && (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 bg-black border-b border-white/10">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: accent }}
              />
              <span className="text-white font-medium text-sm">
                {appName} — Interface real do aplicativo
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={toggleBrowserFs}
                className="text-white/60 hover:text-white p-2 rounded-md hover:bg-white/10"
                title="Tela cheia do navegador"
              >
                {isBrowserFs ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
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
                onClick={() => {
                  if (document.fullscreenElement) document.exitFullscreen();
                  setFullscreenOpen(false);
                }}
                className="text-white/60 hover:text-white p-2 rounded-md hover:bg-white/10"
                title="Fechar (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div ref={fsContainerRef} className="flex-1 relative bg-white">
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