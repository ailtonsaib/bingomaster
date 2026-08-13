import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, X, UserCheck } from "lucide-react";

// Lista vendedores (ErpSalesTeam role=vendedor) e permite selecionar um.
export default function ErpVendedorPicker({ vendedores, selectedId, onSelect, onClose }) {
  const [search, setSearch] = useState("");
  const filtered = (vendedores || []).filter(v => (v.name + " " + (v.supervisor_name || "") + " " + (v.gerente_name || "")).toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-bold">Selecionar Vendedor</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-2 overflow-y-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar vendedor..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
          </div>
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">Nenhum vendedor cadastrado. Cadastre vendedores na aba Equipe de Vendas.</p>
          ) : filtered.map(v => {
            const sel = v.id === selectedId;
            return (
              <button key={v.id} onClick={() => { onSelect(v); onClose(); }} className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left ${sel ? "border-emerald-500 bg-emerald-50" : "border-gray-200 hover:bg-gray-50"}`}>
                <div>
                  <p className="text-sm font-medium">{v.name}</p>
                  <p className="text-xs text-gray-500">{v.supervisor_name ? `Supervisor: ${v.supervisor_name}` : "Sem supervisor"}{v.gerente_name ? ` · Gerente: ${v.gerente_name}` : ""}</p>
                  {(v.phone || v.email) && <p className="text-xs text-gray-400">{v.phone || v.email}</p>}
                </div>
                {sel && <UserCheck className="w-5 h-5 text-emerald-600" />}
              </button>
            );
          })}
        </div>
        <div className="p-3 border-t flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </div>
  );
}