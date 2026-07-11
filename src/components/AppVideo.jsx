import { useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

export default function AppVideo({ src, accent, appName }) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  return (
    <div className="px-6 pb-4">
      <div className="relative rounded-xl overflow-hidden bg-black/5 group">
        <video
          ref={videoRef}
          src={src}
          className="w-full h-40 object-cover"
          onClick={togglePlay}
          onEnded={() => setPlaying(false)}
          preload="metadata"
        />
        {!playing && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/20 transition-colors"
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
              style={{ backgroundColor: accent }}
            >
              <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
            </div>
          </button>
        )}
        {playing && (
          <button
            onClick={togglePlay}
            className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Pause className="w-4 h-4 text-white" fill="white" />
          </button>
        )}
        <span className="absolute top-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/50 text-white">
          ▶ Veja {appName} em ação
        </span>
      </div>
    </div>
  );
}