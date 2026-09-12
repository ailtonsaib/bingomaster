import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";

// Combobox com busca dinâmica: digitar parte do código ou da descrição filtra as opções
// options: [{ id, label }] — label já contém "código — descrição"
// A lista abre em posição fixa (calculada na abertura) para não ser cortada
// por tabelas/containers com rolagem.
export default function ErpCombobox({ value, onValueChange, options, placeholder, clearable = false, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rect, setRect] = useState(null);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const selected = options.find(o => o.id === value);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener("mousedown", onClickOutside);
    // Ao rolar a página/a tabela a lista desanexaria do campo — fecha
    window.addEventListener("scroll", onClickOutside, true);
    return () => {
      window.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("scroll", onClickOutside, true);
    };
  }, []);

  const openList = () => {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    setOpen(true);
  };

  // Busca: digitar pelo código ou pelo nome — ignora maiúsculas e acentos
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const filtered = query
    ? options.filter(o => norm(o.label).includes(norm(query)))
    : options;

  return (
    <div className="relative" ref={wrapRef}>
      <input
        ref={inputRef}
        type="text"
        disabled={disabled}
        value={open ? query : (selected?.label || "")}
        onFocus={() => { setQuery(""); openList(); }}
        onChange={e => { setQuery(e.target.value); if (!open) openList(); }}
        placeholder={placeholder}
        className="w-full h-9 rounded-md border border-input bg-white px-2 pr-8 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
      />
      {clearable && selected && !disabled && (
        <button type="button" onClick={() => onValueChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" title="Limpar">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      {open && rect && (
        <div
          className="fixed z-[60] max-h-52 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg"
          style={{ top: rect.top, left: rect.left, width: rect.width }}
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-400">Nenhum resultado.</p>
          ) : filtered.map(o => (
            <div
              key={o.id}
              onClick={() => { onValueChange(o.id); setOpen(false); setQuery(""); }}
              className={`px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer truncate ${o.id === value ? "bg-gray-50 font-medium" : ""}`}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}