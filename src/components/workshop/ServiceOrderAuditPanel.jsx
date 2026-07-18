import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Search, ShieldAlert, Loader2, AlertTriangle, ChevronDown, ChevronUp, History } from "lucide-react";

const formatCurrency = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatDateTime = (d) => d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const FIELD_LABELS = {
  total: "Valor Total",
  discount: "Desconto",
  parts_total: "Total de Peças",
  labor_total: "Total de Mão de Obra",
  items: "Itens da OS",
};

export default function ServiceOrderAuditPanel({ userEmail }) {
  const { toast } = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [onlySuspicious, setOnlySuspicious] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.ServiceOrderAuditLog.filter(
        { user_email: userEmail },
        "-timestamp",
        200
      );
      setLogs(list || []);
    } catch {
      toast({ title: "Erro", description: "Falha ao carregar auditoria.", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = logs.filter(l => {
    if (onlySuspicious && !l.is_suspicious) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.order_number?.toLowerCase().includes(q) ||
      l.changed_by_name?.toLowerCase().includes(q) ||
      l.changed_by_email?.toLowerCase().includes(q) ||
      l.description?.toLowerCase().includes(q)
    );
  });

  const suspiciousCount = logs.filter(l => l.is_suspicious).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-[#1B1C21] flex items-center gap-2">
            <History className="w-5 h-5 text-[#2563EB]" /> Auditoria de Ordens de Serviço
          </h2>
          <p className="text-sm text-[#71717A]">
            Registro automático de toda alteração de valor em OS.{" "}
            {suspiciousCount > 0 && (
              <span className="text-red-600 font-medium">
                ⚠ {suspiciousCount} alteração(ões) suspeita(s) após aprovação do cliente.
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1AA]" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por OS, usuário ou descrição..."
            className="pl-9"
          />
        </div>
        <Button
          variant={onlySuspicious ? "default" : "outline"}
          size="sm"
          onClick={() => setOnlySuspicious(!onlySuspicious)}
          className="gap-2"
        >
          <AlertTriangle className="w-4 h-4" /> {onlySuspicious ? "Mostrando suspeitas" : " Só suspeitas"}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#2563EB]" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-[#71717A]">
          <History className="w-10 h-10 mx-auto mb-3 text-[#D4D4D8]" />
          <p className="text-sm">
            {logs.length === 0 ? "Nenhuma alteração registrada ainda." : "Nenhum registro corresponde aos filtros."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(log => {
            const isExpanded = expandedId === log.id;
            const diff = (log.new_total || 0) - (log.old_total || 0);
            return (
              <div
                key={log.id}
                className={`rounded-xl border p-4 transition-all ${
                  log.is_suspicious
                    ? "border-red-200 bg-red-50/50"
                    : "border-gray-100 bg-white hover:shadow-sm"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {log.is_suspicious ? (
                      <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <ShieldAlert className="w-5 h-5 text-red-600" />
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <History className="w-5 h-5 text-[#2563EB]" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[#1B1C21] text-sm">{log.order_number || "—"}</span>
                        {log.is_suspicious && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                            ⚠ Suspeita
                          </span>
                        )}
                        {log.changed_fields?.map(f => (
                          <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {FIELD_LABELS[f] || f}
                          </span>
                        ))}
                      </div>
                      <p className="text-sm text-[#52525B] mt-0.5">{log.description}</p>
                      <p className="text-xs text-[#A1A1AA] mt-1">
                        Alterado por <span className="font-medium text-[#52525B]">{log.changed_by_name || "—"}</span>
                        {" "}({log.changed_by_email || "—"})
                        {" "}em {formatDateTime(log.timestamp)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {totalChanged(log) && (
                      <div className={`text-sm font-bold ${diff > 0 ? "text-red-600" : "text-green-600"}`}>
                        {diff > 0 ? "+" : ""}{formatCurrency(diff)}
                      </div>
                    )}
                    <p className="text-xs text-[#A1A1AA]">
                      {formatCurrency(log.old_total)} → {formatCurrency(log.new_total)}
                    </p>
                  </div>
                </div>

                {hasItemDetails(log) && (
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                    className="mt-3 text-xs text-[#2563EB] hover:underline flex items-center gap-1"
                  >
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {isExpanded ? "Ocultar detalhes dos itens" : "Ver detalhes dos itens"}
                  </button>
                )}

                {isExpanded && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <ItemSnapshot title="Itens Anteriores" items={log.old_items} />
                    <ItemSnapshot title="Itens Novos" items={log.new_items} highlight />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function totalChanged(log) {
  return (log.old_total || 0) !== (log.new_total || 0);
}

function hasItemDetails(log) {
  return (log.old_items?.length > 0) || (log.new_items?.length > 0);
}

function ItemSnapshot({ title, items, highlight }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "border-blue-100 bg-blue-50/30" : "border-gray-100 bg-gray-50/50"}`}>
      <p className="text-xs font-semibold text-[#52525B] mb-2">{title}</p>
      {(!items || items.length === 0) ? (
        <p className="text-xs text-[#A1A1AA]">Nenhum item</p>
      ) : (
        <div className="space-y-1">
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-[#52525B] truncate flex-1 mr-2">
                {item.type === "peca" ? "🔧" : "⚙️"} {item.description || "—"}
                {item.quantity > 1 && ` x${item.quantity}`}
              </span>
              <span className="text-[#71717A] font-medium flex-shrink-0">
                {formatCurrency(item.total || 0)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}