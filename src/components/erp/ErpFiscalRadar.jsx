import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Radar, RefreshCw, Search, Loader2, ChevronRight } from "lucide-react";
import { fmtDate } from "@/lib/erpUtils";

const fmtMoney = v => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const maskCnpj = c => String(c || "").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

// Radar Fiscal: consulta a caixa postal da SEFAZ (documentos destinados à
// empresa — NF-e e CT-e) e compara com as entradas já lançadas no sistema;
// NFS-e (municipais, fora da SEFAZ) são exibidas a partir dos lançamentos.
export default function ErpFiscalRadar({ user }) {
  const [ambiente, setAmbiente] = useState("1");
  const [docs, setDocs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [temMais, setTemMais] = useState(false);
  const [lastNsu, setLastNsu] = useState(0);
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState("pendentes");
  const [search, setSearch] = useState("");
  const [entries, setEntries] = useState([]);
  const [ctes, setCtes] = useState([]);
  const [sysLoading, setSysLoading] = useState(true);

  useEffect(() => {
    setSysLoading(true);
    Promise.all([
      base44.entities.ErpFiscalEntry.filter({ user_email: user.email }, "-created_date", 500),
      base44.entities.ErpCte.filter({ user_email: user.email }, "-created_date", 500),
    ]).then(([fe, ct]) => { setEntries(fe || []); setCtes(ct || []); }).catch(() => {}).finally(() => setSysLoading(false));
  }, [user.email]);

  const chavesLancadas = useMemo(() => {
    const m = new Map();
    entries.forEach(e => { if (e.chave_acesso) m.set(e.chave_acesso, e); });
    ctes.forEach(c => { if (c.chave_acesso) m.set(c.chave_acesso, c); });
    return m;
  }, [entries, ctes]);

  const rows = useMemo(() => {
    const list = [];
    (docs || []).forEach(d => {
      list.push({
        tipo: d.tipo === "cte" ? "CT-e" : "NF-e",
        numero: d.numero, serie: d.serie, chave: d.chave,
        emissao: d.emissao, emitente_nome: d.emitente_nome, emitente_cnpj: d.emitente_cnpj,
        valor: d.valor, situacao: d.situacao,
        entrada: chavesLancadas.has(d.chave),
      });
    });
    // NFS-e não são distribuídas pela SEFAZ — exibidas a partir dos lançamentos no sistema
    entries.forEach(e => {
      if (!String(e.nota_model || "").toUpperCase().includes("NFSE")) return;
      list.push({
        tipo: "NFS-e", numero: e.nota_number, serie: e.nota_series, chave: e.chave_acesso || "",
        emissao: (e.issue_date || e.entry_date || "").slice(0, 10),
        emitente_nome: e.supplier_name, emitente_cnpj: e.supplier_cnpj,
        valor: e.total_nota, situacao: "Lançada no sistema", entrada: true,
      });
    });
    return list.sort((a, b) => String(b.emissao || "").localeCompare(String(a.emissao || "")));
  }, [docs, entries, chavesLancadas]);

  const totalEntrada = rows.filter(r => r.entrada).length;
  const totalPendente = rows.length - totalEntrada;

  const filtered = rows.filter(r => {
    const okFilter = filter === "todas" || (filter === "pendentes" ? !r.entrada : r.entrada);
    const t = [r.emitente_nome, r.emitente_cnpj, r.numero, r.chave, r.tipo].join(" ").toLowerCase();
    return okFilter && t.includes(search.toLowerCase());
  });

  const consultar = async (continuar = false) => {
    setLoading(true); setMsg("");
    try {
      const res = await base44.functions.invoke("radarFiscal", { ambiente, ...(continuar ? { ultNsu: lastNsu } : {}) });
      const d = res.data || {};
      if (!d.success) { setMsg(d.error || d.xMotivo || "Falha na consulta à SEFAZ."); return; }
      const novos = d.docs || [];
      setDocs(prev => continuar ? [...(prev || []), ...novos] : novos);
      setTemMais(!!d.temMais);
      setLastNsu(d.lastNsu || 0);
      if (!novos.length && d.status && d.status.cStat !== "138") setMsg(`SEFAZ: ${d.status.cStat} — ${d.status.xMotivo}`);
      else if (d.temMais) setMsg("Limite de documentos por consulta atingido — clique em \"Continuar\" para buscar mais.");
    } catch (e) {
      setMsg(e.message || "Erro ao consultar o radar fiscal.");
    }
    setLoading(false);
  };

  const sitColor = s => s === "Cancelada" || s === "Denegada" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Radar className="w-5 h-5 text-indigo-600" />
        <div className="flex-1">
          <h2 className="font-semibold text-base">Radar Fiscal — Documentos emitidos contra a empresa</h2>
          <p className="text-xs text-gray-500">Consulta a caixa postal da SEFAZ (NF-e e CT-e destinados à empresa) e compara com as entradas lançadas no sistema.</p>
        </div>
        <select value={ambiente} onChange={e => setAmbiente(e.target.value)} className="h-9 rounded-md border border-input bg-white px-2 text-sm">
          <option value="1">Produção</option>
          <option value="2">Homologação</option>
        </select>
        <Button size="sm" onClick={() => consultar(false)} disabled={loading} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {loading ? "Consultando SEFAZ..." : "Atualizar Radar"}
        </Button>
        {temMais && (
          <Button size="sm" variant="outline" onClick={() => consultar(true)} disabled={loading} className="gap-1.5">
            <ChevronRight className="w-4 h-4" /> Continuar
          </Button>
        )}
      </div>

      {msg && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">{msg}</p>}

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por emitente, número ou chave de acesso..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        {[
          { id: "todas", label: `Todas (${rows.length})` },
          { id: "pendentes", label: `Sem entrada (${totalPendente})` },
          { id: "lancadas", label: `Com entrada (${totalEntrada})` },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border ${filter === f.id ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Tipo</th>
                <th className="p-2 text-left">Número / Série</th>
                <th className="p-2 text-left">Emissão</th>
                <th className="p-2 text-left">Emitente</th>
                <th className="p-2 text-left">CNPJ</th>
                <th className="p-2 text-right">Valor</th>
                <th className="p-2 text-left">Situação SEFAZ</th>
                <th className="p-2 text-left">Entrada no Sistema</th>
                <th className="p-2 text-left">Chave de Acesso</th>
              </tr>
            </thead>
            <tbody>
              {sysLoading || loading ? (
                <tr><td colSpan={9} className="p-6 text-center text-gray-400">{sysLoading ? "Carregando lançamentos do sistema..." : "Consultando a caixa postal da SEFAZ — pode levar alguns segundos..."}</td></tr>
              ) : docs === null ? (
                <tr><td colSpan={9} className="p-8 text-center text-gray-400">Clique em <b>Atualizar Radar</b> para consultar na SEFAZ todas as notas (NF-e e CT-e) emitidas contra a empresa e identificar as que ainda não tiveram entrada.</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="p-8 text-center text-gray-400">Nenhum documento {filter === "pendentes" ? "pendente de entrada" : filter === "lancadas" ? "com entrada dada" : "encontrado"}.</td></tr>
              ) : filtered.map(r => (
                <tr key={r.chave || `${r.tipo}-${r.numero}`} className="border-t hover:bg-gray-50 align-top">
                  <td className="p-2 font-medium">{r.tipo}</td>
                  <td className="p-2">{r.numero}{r.serie ? ` / ${r.serie}` : ""}</td>
                  <td className="p-2 whitespace-nowrap">{fmtDate(r.emissao)}</td>
                  <td className="p-2">{r.emitente_nome || "—"}</td>
                  <td className="p-2 whitespace-nowrap">{maskCnpj(r.emitente_cnpj) || "—"}</td>
                  <td className="p-2 text-right whitespace-nowrap">{fmtMoney(r.valor)}</td>
                  <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${sitColor(r.situacao)}`}>{r.situacao}</span></td>
                  <td className="p-2">
                    {r.entrada
                      ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Entrada dada</span>
                      : <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Pendente de entrada</span>}
                  </td>
                  <td className="p-2 font-mono text-[10px] break-all text-gray-500 max-w-[180px]">{r.chave}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-gray-400">
        NF-e e CT-e vêm da caixa postal da SEFAZ (consulta com o certificado digital A1 da empresa). NFS-e são municipais e não são distribuídas pela SEFAZ — as notas de serviço já lançadas no sistema são exibidas marcadas como "Entrada dada".
      </p>
    </div>
  );
}