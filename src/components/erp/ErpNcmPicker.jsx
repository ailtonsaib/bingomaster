import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { X } from "lucide-react";

// Cache em nível de módulo para não recarregar ~10.500 NCMs a cada abertura
let ncmCache = null;
let loadingPromise = null;

async function loadAllNcms() {
  if (ncmCache) return ncmCache;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    const all = [];
    let skip = 0;
    while (true) {
      const batch = await base44.entities.ErpNcm.filter({}, "code", 5000, skip);
      all.push(...batch);
      if (batch.length < 5000) break;
      skip += 5000;
    }
    ncmCache = all;
    return all;
  })();
  return loadingPromise;
}

export default function ErpNcmPicker({ value, onChange, allowClear = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [all, setAll] = useState(null);
  const ref = useRef(null);

  useEffect(() => { loadAllNcms().then(setAll).catch(() => setAll([])); }, []);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = all
    ? all.filter(n => !q || n.code.toLowerCase().includes(q) || n.description.toLowerCase().includes(q)).slice(0, 80)
    : [];
  const selected = all && value ? all.find(n => n.code === value) : null;
  const display = open ? query : (selected ? `${selected.code} — ${selected.description}` : (value || ""));

  return (
    <div ref={ref} className="relative">
      <input
        value={display}
        onFocus={() => { setOpen(true); setQuery(""); }}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        placeholder="Buscar NCM por código ou descrição..."
        className="w-full h-9 rounded-md border border-input bg-transparent pl-3 pr-8 text-sm"
      />
      {allowClear && value && (
        <button type="button" onClick={() => onChange("")} title="Limpar NCM (regra geral)" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
          <X className="w-4 h-4" />
        </button>
      )}
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-white border rounded-md shadow-lg">
          {!all ? (
            <div className="p-2 text-xs text-gray-400">Carregando NCMs...</div>
          ) : filtered.length === 0 ? (
            <div className="p-2 text-xs text-gray-400">Nenhum NCM encontrado.</div>
          ) : (
            filtered.map(n => (
              <button
                key={n.code}
                type="button"
                onClick={() => { onChange(n.code); setOpen(false); setQuery(""); }}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 ${n.code === value ? "bg-emerald-50" : ""}`}
              >
                <span className="font-mono text-xs text-gray-800">{n.code}</span>
                <span className="text-gray-500 text-xs ml-2">{n.description}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}