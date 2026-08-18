import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";

// Cache em nível de módulo — tabela CFOP é fixa (~660 códigos)
let cfopCache = null;
let loadingPromise = null;

async function loadAllCfops() {
  if (cfopCache) return cfopCache;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    const all = [];
    let skip = 0;
    while (true) {
      const batch = await base44.entities.ErpCfop.filter({}, "code", 5000, skip);
      all.push(...batch);
      if (batch.length < 5000) break;
      skip += 5000;
    }
    cfopCache = all;
    return all;
  })();
  return loadingPromise;
}

// prefixes: array de dígitos iniciais permitidos (ex: ["1"], ["5"], ["3","7"])
export default function ErpCfopPicker({ value, onChange, prefixes }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [all, setAll] = useState(null);
  const ref = useRef(null);

  const allowed = (c) => !prefixes || prefixes.length === 0 || prefixes.some(p => String(c.code).startsWith(p));

  useEffect(() => { loadAllCfops().then(setAll).catch(() => setAll([])); }, []);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = all
    ? all.filter(c => allowed(c) && (!q || c.code.toLowerCase().includes(q) || c.description.toLowerCase().includes(q))).slice(0, 80)
    : [];
  const selected = all && value ? all.find(c => c.code === value) : null;
  const display = open ? query : (selected ? `${selected.code} — ${selected.description}` : (value || ""));

  return (
    <div ref={ref} className="relative">
      <input
        value={display}
        onFocus={() => { setOpen(true); setQuery(""); }}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        placeholder="Buscar CFOP por código ou descrição..."
        className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-white border rounded-md shadow-lg">
          {!all ? (
            <div className="p-2 text-xs text-gray-400">Carregando CFOPs...</div>
          ) : filtered.length === 0 ? (
            <div className="p-2 text-xs text-gray-400">Nenhum CFOP encontrado.</div>
          ) : (
            filtered.map(c => (
              <button
                key={c.code}
                type="button"
                onClick={() => { onChange(c.code); setOpen(false); setQuery(""); }}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 ${c.code === value ? "bg-emerald-50" : ""}`}
              >
                <span className="font-mono text-xs text-gray-800">{c.code}</span>
                <span className="text-gray-500 text-xs ml-2">{c.description}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}