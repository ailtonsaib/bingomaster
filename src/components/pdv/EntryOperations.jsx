import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Loader2, FileInput, Trash2, Search, ChevronDown, ChevronRight } from "lucide-react";
import ImportXmlModal from "@/components/pdv/ImportXmlModal";

export default function EntryOperations({ user }) {
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await base44.entities.PDVEntryOperation.filter(
        { user_email: user.email },
        "-entry_date",
        100
      );
      setOperations(list);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user.email]);

  useEffect(() => { load(); }, [load]);

  const filtered = operations.filter(o =>
    o.supplier_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.nota_number?.includes(search) ||
    o.cfop?.includes(search)
  );

  const fmtDate = (dt) => {
    if (!dt) return "—";
    try {
      return new Date(dt).toLocaleDateString("pt-BR") + " " + new Date(dt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch { return dt; }
  };

  const fmtMoney = (v) => "R$ " + (Number(v) || 0).toFixed(2);

  const remove = async (op) => {
    if (!confirm(`Excluir operação de entrada NF ${op.nota_number || ""}?`)) return;
    await base44.entities.PDVEntryOperation.delete(op.id);
    load();
  };

  const totalGeral = operations.reduce((s, o) => s + (o.total_nota || 0), 0);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <FileInput className="w-5 h-5 text-orange-600" />
          <h2 className="text-lg font-bold">Operações de Entrada</h2>
          <span className="text-sm text-gray-500">({operations.length})</span>
          {totalGeral > 0 && (
            <span className="text-sm font-medium text-orange-600">Total: {fmtMoney(totalGeral)}</span>
          )}
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-9 h-9 w-48" />
          </div>
          <Button onClick={() => setShowImport(true)} className="h-9 gap-1.5 bg-orange-600 hover:bg-orange-700">
            <Upload className="w-4 h-4" /> Importar XML
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-orange-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FileInput className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>Nenhuma operação de entrada registrada</p>
          <p className="text-xs mt-1">Clique em "Importar XML" para começar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(op => (
            <div key={op.id} className="bg-white rounded-lg border overflow-hidden">
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpanded(expanded === op.id ? null : op.id)}
              >
                {expanded === op.id ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                <div className="flex-1 flex flex-wrap items-center gap-4">
                  <div>
                    <p className="font-semibold text-sm">{op.supplier_name || "—"}</p>
                    <p className="text-xs text-gray-500">{op.supplier_cnpj || ""} {op.supplier_uf ? `· ${op.supplier_uf}` : ""}</p>
                  </div>
                  <div className="text-sm">
                    <p className="text-xs text-gray-500">NF</p>
                    <p className="font-medium">{op.nota_number || "—"}/{op.nota_series || ""}</p>
                  </div>
                  <div className="text-sm">
                    <p className="text-xs text-gray-500">CFOP</p>
                    <p className="font-medium">{op.cfop || "—"}</p>
                  </div>
                  <div className="text-sm">
                    <p className="text-xs text-gray-500">Emissão</p>
                    <p className="font-medium text-xs">{fmtDate(op.issue_date)}</p>
                  </div>
                  <div className="text-sm">
                    <p className="text-xs text-gray-500">Itens</p>
                    <p className="font-medium">{op.items?.length || 0}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Total</p>
                    <p className="font-bold text-orange-600">{fmtMoney(op.total_nota)}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); remove(op); }}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {expanded === op.id && op.items?.length > 0 && (
                <div className="border-t bg-gray-50 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="p-2 text-left">Produto</th>
                        <th className="p-2 text-center">NCM</th>
                        <th className="p-2 text-center">CFOP</th>
                        <th className="p-2 text-center">Un</th>
                        <th className="p-2 text-right">Qtd</th>
                        <th className="p-2 text-right">V. Unit</th>
                        <th className="p-2 text-right">Total</th>
                        <th className="p-2 text-right">ICMS%</th>
                        <th className="p-2 text-right">IPI%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {op.items.map((item, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-2">{item.product_name}</td>
                          <td className="p-2 text-center font-mono">{item.ncm}</td>
                          <td className="p-2 text-center">{item.cfop}</td>
                          <td className="p-2 text-center">{item.unit}</td>
                          <td className="p-2 text-right">{item.quantity}</td>
                          <td className="p-2 text-right">{(item.unit_price || 0).toFixed(2)}</td>
                          <td className="p-2 text-right font-medium">{(item.total || 0).toFixed(2)}</td>
                          <td className="p-2 text-right">{(item.icms_rate || 0).toFixed(2)}</td>
                          <td className="p-2 text-right">{(item.ipi_rate || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex gap-4 p-3 text-xs bg-white border-t flex-wrap">
                    <span><b>Produtos:</b> {fmtMoney(op.total_products)}</span>
                    <span><b>ICMS:</b> {fmtMoney(op.total_icms)}</span>
                    <span><b>IPI:</b> {fmtMoney(op.total_ipi)}</span>
                    <span><b>PIS:</b> {fmtMoney(op.total_pis)}</span>
                    <span><b>COFINS:</b> {fmtMoney(op.total_cofins)}</span>
                    <span className="ml-auto"><b>Total NF:</b> <span className="text-orange-600 font-bold">{fmtMoney(op.total_nota)}</span></span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showImport && (
        <ImportXmlModal
          user={user}
          onClose={() => setShowImport(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}