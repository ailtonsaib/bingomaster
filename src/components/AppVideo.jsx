import { useState, useRef, useEffect } from "react";
import { Maximize2, Minimize2, X, ExternalLink, Loader2 } from "lucide-react";

export default function AppPreview({ previewRoute, appName, accent }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = () => setIsBrowserFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      setLoading(true);
      const timer = setTimeout(() => setLoading(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && open && !document.fullscreenElement) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const toggleBrowserFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen();
    }
  };

  if (!previewRoute) return null;

  return (
    <>
      {/* Botão no card */}
      <div className="px-6 pb-4">
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all text-white shadow-sm hover:opacity-90"
          style={{ backgroundColor: accent }}
        >
          <Maximize2 className="w-4 h-4" />
          Ver aplicativo real em tela cheia
        </button>
      </div>

      {/* Overlay fullscreen */}
      {open && (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
          {/* Barra superior */}
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
                onClick={toggleBrowserFullscreen}
                className="text-white/60 hover:text-white p-2 rounded-md hover:bg-white/10 transition-colors"
                title="Tela cheia do navegador"
              >
                {isBrowserFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
              <a
                href={previewRoute}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/60 hover:text-white p-2 rounded-md hover:bg-white/10 transition-colors"
                title="Abrir em nova aba"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              <button
                onClick={() => {
                  if (document.fullscreenElement) document.exitFullscreen();
                  setOpen(false);
                }}
                className="text-white/60 hover:text-white p-2 rounded-md hover:bg-white/10 transition-colors"
                title="Fechar (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Container do iframe */}
          <div ref={containerRef} className="flex-1 relative bg-white">
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white z-10">
                <Loader2
                  className="w-8 h-8 animate-spin"
                  style={{ color: accent }}
                />
                <p className="text-sm text-gray-500">
                  Carregando {appName}...
                </p>
              </div>
            )}
            <iframe
              src={previewRoute}
              className="w-full h-full border-0"
              title={appName}
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
              onLoad={() => setLoading(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}