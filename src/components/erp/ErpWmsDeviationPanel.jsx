import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Search, Loader2, AlertTriangle, ShieldAlert } from "lucide-react";
import { fmtDate } from "@/lib/erpUtils";

const TYPE_OPTS = {
  fifo: { label: "Fora do FIFO", color: "bg-amber-100 text-amber-700" },
  produto_invalido: { label: "Produto inválido", color: "bg-red-100 text-red-700" },
};

// Dashboard de inconsistências do WMS: bipagens fora da ordem de validade
// (FIFO) confirmadas pelo operador e tentativas de bipar produto fora da requisição
export default function ErpWmsDeviationPanel({ user }) {
  const [devs, setDevs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    base44.entities.ErpWmsDeviation.filter({ user_email: user.email }, "-created_date", 500)
      .then(list => setDevs(list))
      .catch(() => setDevs([]))
      .finally(() => setLoading(false));
  }, [user.email]);

  const month = new Date().toISOString().slice(0, 7);
  const monthCount = devs.filter(d => String(d.date || "").slice(0, 7) === month).length;
  const productsCount = new Set(devs.map(d => d.product_name).filter(Boolean)).size;

  const s = search.toLowerCase();
  const filtered = devs.filter(d =>
    [d.requisition_number, d.product_name, d.product_code, d.expected_label_code, d.used_label_code, d.expected_lot, d.used_lot]
      .map(v => String(v ?? "")).join(" ").toLowerCase().includes(s)
  );

  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-base flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-amber-600" /> Dashboard de Inconsistências (WMS)</h2>
      <p className="text-xs text-gray-500 -mt-1">Registros de bipagens fora da ordem de validade (FIFO) confirmadas pelo operador no atendimento de requisições e de tentativas de bipar produtos fora da requisição.</p>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-xl border p-3">
          <p className="text-xs text-gray-500">Total de inconsistências</p>
          <p className="text-2xl font-bold text-amber-600">{devs.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-3">
          <p className="text-xs text-gray-500">No mês corrente</p>
          <p className="text-2xl font-bold text-amber-600">{monthCount}</p>
        </div>
        <div className="bg-white rounded-xl border p-3">
          <p className="text-xs text-gray-500">Produtos afetados</p>
          <p className="text-2xl font-bold text-amber-600">{productsCount}</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar requisição, produto, etiqueta, lote..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Data</th>
                <th className="p-2 text-left">Tipo</th>
                <th className="p-2 text-left">Requisição</th>
                <th className="p-2 text-left">Produto</th>
                <th className="p-2 text-left">Esperado (FIFO)</th>
                <th className="p-2 text-left">Bipado</th>
                <th className="p-2 text-left">Operador</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-6 text-center text-gray-400"><Loader2 className="w-4 h-4 animate-spin inline" /> Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-400"><AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhuma inconsistência registrada.</td></tr>
              ) : filtered.map(d => {
                const t = TYPE_OPTS[d.type] || { label: d.type, color: "bg-gray-100 text-gray-600" };
                return (
                  <tr key={d.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 text-gray-600 whitespace-nowrap">{fmtDate(d.date)}</td>
                    <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${t.color}`}>{t.label}</span></td>
                    <td className="p-2 font-mono text-xs">{d.requisition_number || "—"}</td>
                    <td className="p-2">{d.product_name || "—"}{d.product_code && <span className="block text-[10px] text-gray-400">{d.product_code}</span>}</td>
                    <td className="p-2 text-xs">
                      {d.type === "fifo" ? (<>
                        <span className="font-mono">{d.expected_label_code || "—"}</span>
                        <span className="block text-gray-500">Lote {d.expected_lot || "—"} — val. {d.expected_expiry ? fmtDate(d.expected_expiry) : "—"}</span>
                      </>) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="p-2 text-xs">
                      <span className="font-mono">{d.used_label_code || "—"}</span>
                      <span className="block text-gray-500">Lote {d.used_lot || "—"} — val. {d.used_expiry ? fmtDate(d.used_expiry) : "—"}</span>
                    </td>
                    <td className="p-2 text-xs text-gray-500">{d.operator_name || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}