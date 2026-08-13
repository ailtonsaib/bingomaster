import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, Radio, CheckCircle2, XCircle, AlertTriangle, WifiOff,
  Bug, RefreshCw, Search, ChevronDown, ChevronRight, Clock, Server,
  Trash2, Activity,
} from "lucide-react";

const RESULT_META = {
  autorizada: { label: "Autorizada", cls: "bg-emerald-100 text-emerald-700", Icon: CheckCircle2 },
  rejeitada: { label: "Rejeitada", cls: "bg-red-100 text-red-700", Icon: XCircle },
  denegada: { label: "Denegada", cls: "bg-orange-100 text-orange-700", Icon: AlertTriangle },
  processando: { label: "Processando", cls: "bg-blue-100 text-blue-700", Icon: Clock },
  erro_conexao: { label: "Erro Conexão", cls: "bg-rose-100 text-rose-700", Icon: WifiOff },
  erro_interno: { label: "Erro Interno", cls: "bg-purple-100 text-purple-700", Icon: Bug },
  validacao: { label: "Validação", cls: "bg-amber-100 text-amber-700", Icon: AlertTriangle },
};

const PAGE_SIZE = 50;

export default function SefazLogPanel({ user }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filterResult, setFilterResult] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [live, setLive] = useState(true);
  const [stats, setStats] = useState({ total: 0, autorizada: 0, falha: 0 });

  const load = useCallback(async () => {
    const isRefresh = !loading;
    if (isRefresh) setRefreshing(true);
    try {
      const list = await base44.entities.SefazTransmissionLog.filter(
        { user_email: user.email }, "-created_date", 200
      );
      setLogs(list);
      setStats({
        total: list.length,
        autorizada: list.filter(l => l.result === "autorizada").length,
        falha: list.filter(l => !["autorizada", "processando"].includes(l.result)).length,
      });
    } catch (e) { console.error(e); }
    setLoading(false);
    setRefreshing(false);
  }, [user.email, loading]);

  useEffect(() => { load(); }, [load]);

  // Atualização em tempo real via subscription
  useEffect(() => {
    if (!live) return;
    const unsubscribe = base44.entities.SefazTransmissionLog.subscribe((event) => {
      setLogs(prev => {
        if (event.type === "create") {
          const next = [event.data, ...prev];
          setStats({
            total: next.length,
            autorizada: next.filter(l => l.result === "autorizada").length,
            falha: next.filter(l => !["autorizada", "processando"].includes(l.result)).length,
          });
          return next.slice(0, 200);
        }
        if (event.type === "update") {
          return prev.map(l => l.id === event.id ? { ...l, ...event.data } : l);
        }
        if (event.type === "delete") {
          return prev.filter(l => l.id !== event.id);
        }
        return prev;
      });
    });
    return unsubscribe;
  }, [live]);

  const filtered = logs.filter(l => {
    if (filterResult && l.result !== filterResult) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [l.order_number, l.nfe_number, l.nfe_key, l.cstat, l.xmotivo, l.error_message, l.uf]
        .filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const fmtDate = (d) => d ? new Date(d).toLocaleString("pt-BR") : "—";

  const clearLogs = async () => {
    if (!confirm("Apagar todos os logs de transmissão SEFAZ? Esta ação não pode ser desfeita.")) return;
    try {
      await base44.entities.SefazTransmissionLog.deleteMany({ user_email: user.email });
      setLogs([]);
      setStats({ total: 0, autorizada: 0, falha: 0 });
    } catch (e) { alert("Erro ao limpar logs: " + e.message); }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-orange-600" />
          <h2 className="text-lg font-bold">Log de Transmissão SEFAZ</h2>
          <span className="text-sm text-gray-500">({logs.length} eventos)</span>
          {live && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> tempo real
            </span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={live ? "default" : "outline"}
            size="sm"
            onClick={() => setLive(v => !v)}
            className="h-9 gap-1.5"
          >
            <Activity className="w-4 h-4" /> {live ? "Ao vivo" : "Pausado"}
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={refreshing} className="h-9 gap-1.5">
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={clearLogs} className="h-9 gap-1.5 text-red-600 hover:text-red-700">
            <Trash2 className="w-4 h-4" /> Limpar
          </Button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-lg border p-3">
          <p className="text-xs text-gray-500">Total de tentativas</p>
          <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg border p-3">
          <p className="text-xs text-gray-500">Autorizadas</p>
          <p className="text-2xl font-bold text-emerald-600">{stats.autorizada}</p>
        </div>
        <div className="bg-white rounded-lg border p-3">
          <p className="text-xs text-gray-500">Falhas / Rejeições</p>
          <p className="text-2xl font-bold text-red-600">{stats.falha}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar (nota, chave, cStat, UF...)" className="pl-9 h-9" />
        </div>
        <select
          value={filterResult}
          onChange={e => setFilterResult(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="">Todos os resultados</option>
          {Object.entries(RESULT_META).map(([k, m]) => (
            <option key={k} value={k}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Lista de logs */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-orange-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Radio className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>Nenhum evento de transmissão registrado</p>
          <p className="text-xs mt-1">Transmita uma NF-e/NFC-e para gerar logs</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.slice(0, PAGE_SIZE).map(log => {
            const meta = RESULT_META[log.result] || RESULT_META.erro_interno;
            const Icon = meta.Icon;
            const isOpen = expanded === log.id;
            return (
              <div key={log.id} className="bg-white rounded-lg border overflow-hidden">
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpanded(isOpen ? null : log.id)}
                >
                  {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium ${meta.cls}`}>
                    <Icon className="w-3 h-3" /> {meta.label}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">
                        {log.doc_model === "65" ? "NFC-e" : "NF-e"} {log.nfe_number || "—"}
                      </span>
                      {log.order_number && <span className="text-xs text-gray-400">· {log.order_number}</span>}
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {log.cstat ? `[${log.cstat}] ` : ""}{log.xmotivo || log.error_message || "—"}
                    </p>
                  </div>
                  <div className="text-right text-xs flex-shrink-0">
                    <p className="text-gray-600 flex items-center gap-1 justify-end">
                      <Server className="w-3 h-3" /> {log.uf || "—"} · {log.system || "—"}
                    </p>
                    <p className="text-gray-400">{fmtDate(log.created_date)}</p>
                  </div>
                  <div className="text-xs text-gray-400 flex-shrink-0 w-16 text-right">
                    {log.duration_ms ? `${log.duration_ms}ms` : "—"}
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t bg-gray-50 p-3 space-y-2 text-xs">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <Field label="Ambiente" value={log.ambiente === "1" ? "Produção" : "Homologação"} />
                      <Field label="UF" value={log.uf || "—"} />
                      <Field label="Sistema" value={log.system || "—"} />
                      <Field label="HTTP" value={log.http_status || "—"} />
                      <Field label="cStat" value={log.cstat || "—"} />
                      <Field label="Protocolo" value={log.nprot || "—"} />
                      <Field label="Operador" value={log.operator_email || "—"} />
                      <Field label="Duração" value={log.duration_ms ? `${log.duration_ms}ms` : "—"} />
                    </div>
                    {log.nfe_key && (
                      <div>
                        <p className="text-gray-500 font-medium">Chave de acesso</p>
                        <p className="font-mono break-all">{log.nfe_key}</p>
                      </div>
                    )}
                    {log.error_message && (
                      <div className="bg-red-50 border border-red-200 rounded p-2">
                        <p className="text-red-600 font-medium">Mensagem de erro</p>
                        <p className="text-red-700">{log.error_message}</p>
                      </div>
                    )}
                    {log.raw_response && (
                      <div>
                        <p className="text-gray-500 font-medium mb-1">Resposta SEFAZ (trecho)</p>
                        <pre className="bg-white border rounded p-2 overflow-x-auto max-h-40 font-mono text-[10px] whitespace-pre-wrap break-all">
                          {log.raw_response}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length > PAGE_SIZE && (
            <p className="text-center text-xs text-gray-400 py-2">
              Mostrando {PAGE_SIZE} de {filtered.length} eventos — refine a busca para ver mais
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-gray-500 font-medium">{label}</p>
      <p className="text-gray-800 truncate">{value}</p>
    </div>
  );
}