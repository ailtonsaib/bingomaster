import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import JSZip from "jszip";
import {
  Loader2, X, FileInput, FileOutput, FileCheck2, FolderArchive,
  Download, CheckCircle2, AlertTriangle, FileText, Receipt,
} from "lucide-react";

const MONTHS_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function inMonth(dateStr, year, month) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d.getFullYear() === year && d.getMonth() === month;
}

function safeName(s) {
  return String(s || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "SEM_NOME";
}

export default function XmlExportModal({ user, month, year, onClose }) {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [exitOrders, setExitOrders] = useState([]);
  const [nfseList, setNfseList] = useState([]);
  const [include, setInclude] = useState({ entrada: true, saida: true, nfse: true });
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, label: "" });
  const [result, setResult] = useState(null); // { ok, baixados, falhas }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [ent, orders, nfses] = await Promise.all([
          base44.entities.PDVEntryOperation.filter({ user_email: user.email }, "-entry_date", 500),
          base44.entities.PDVExitOrder.filter({ user_email: user.email }, "-order_date", 500),
          base44.entities.Nfse.filter({ user_email: user.email }, "-emission_date", 500),
        ]);
        setEntries(ent);
        setExitOrders(orders);
        setNfseList(nfses);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [user.email]);

  // Filtra por período e por ter XML disponível
  const filtered = useMemo(() => {
    const ent = entries.filter(e => e.status !== "cancelada" && e.xml_file_url && inMonth(e.entry_date || e.issue_date, year, month));
    const nfe = exitOrders.filter(o => o.status === "emitida" && o.nfe_xml && o.nfe_model !== "65" && inMonth(o.nfe_issue_date || o.order_date, year, month));
    const nfce = exitOrders.filter(o => o.status === "emitida" && o.nfe_xml && o.nfe_model === "65" && inMonth(o.nfe_issue_date || o.order_date, year, month));
    const nfse = nfseList.filter(n => n.status === "emitida" && (n.nfse_xml || n.rps_xml) && inMonth(n.emission_date, year, month));
    return { entrada: ent, nfe, nfce, nfse };
  }, [entries, exitOrders, nfseList, year, month]);

  const counts = {
    entrada: filtered.entrada.length,
    saida: filtered.nfe.length + filtered.nfce.length,
    nfse: filtered.nfse.length,
  };

  const totalSelected =
    (include.entrada ? counts.entrada : 0) +
    (include.saida ? counts.saida : 0) +
    (include.nfse ? counts.nfse : 0);

  const handleExport = async () => {
    if (totalSelected === 0) return;
    setExporting(true);
    setResult(null);
    const zip = new JSZip();
    const pastas = {
      entrada: zip.folder("1-Entrada"),
      saida: zip.folder("2-Saida"),
      nfse: zip.folder("3-NFS-e"),
    };
    const baixados = [];
    const falhas = [];
    let done = 0;
    const total = totalSelected;
    const setProg = (label) => setProgress({ done: ++done, total, label });

    // ENTRADA — XML vem de URL (xml_file_url)
    if (include.entrada) {
      for (const e of filtered.entrada) {
        try {
          const resp = await fetch(e.xml_file_url);
          if (!resp.ok) throw new Error("HTTP " + resp.status);
          const xml = await resp.text();
          const nome = `ENT_${e.nota_number || "SN"}_${e.nota_series || ""}_${safeName(e.supplier_name)}.xml`;
          pastas.entrada.file(nome, xml);
          baixados.push(nome);
        } catch (err) {
          falhas.push(`Entrada ${e.nota_number || ""}: ${err.message}`);
        }
        setProg(`Entrada ${e.nota_number || ""}`);
      }
    }

    // SAÍDA — NF-e e NFC-e (XML inline em nfe_xml)
    if (include.saida) {
      for (const o of [...filtered.nfe, ...filtered.nfce]) {
        try {
          if (!o.nfe_xml) throw new Error("XML ausente");
          const prefix = o.nfe_model === "65" ? "NFCe" : "NFe";
          const nome = `${prefix}_${o.nfe_number || "SN"}_${o.nfe_series || "0"}_${safeName(o.customer_name)}.xml`;
          pastas.saida.file(nome, o.nfe_xml);
          baixados.push(nome);
        } catch (err) {
          falhas.push(`Saída ${o.nfe_number || ""}: ${err.message}`);
        }
        setProg(`${o.nfe_model === "65" ? "NFC-e" : "NF-e"} ${o.nfe_number || ""}`);
      }
    }

    // NFS-e — XML inline (nfse_xml autorizada ou rps_xml)
    if (include.nfse) {
      for (const n of filtered.nfse) {
        try {
          const xml = n.nfse_xml || n.rps_xml;
          if (!xml) throw new Error("XML ausente");
          const nome = `NFSe_${n.nfse_number || n.rps_number || "SN"}_${safeName(n.tomador_name)}.xml`;
          pastas.nfse.file(nome, xml);
          baixados.push(nome);
        } catch (err) {
          falhas.push(`NFS-e ${n.nfse_number || n.rps_number || ""}: ${err.message}`);
        }
        setProg(`NFS-e ${n.nfse_number || n.rps_number || ""}`);
      }
    }

    // Arquivo de índice/manifesto
    const indice = [
      `Exportação de XMLs fiscais — ${MONTHS_FULL[month]} de ${year}`,
      `Empresa: ${user.email}`,
      `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
      `Total de arquivos: ${baixados.length}`,
      ``,
      `== Arquivos incluídos ==`,
      ...baixados.map((n, i) => `${String(i + 1).padStart(3, "0")}. ${n}`),
      ...(falhas.length ? [``, `== Falhas (${falhas.length}) ==`, ...falhas] : []),
    ].join("\n");
    zip.file("_INDICE.txt", indice);

    try {
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `XMLs_Contabilidade_${MONTHS_FULL[month]}_${year}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setResult({ ok: true, baixados: baixados.length, falhas });
    } catch (err) {
      setResult({ ok: false, error: err.message });
    }
    setExporting(false);
  };

  const toggle = (k) => setInclude(prev => ({ ...prev, [k]: !prev[k] }));

  const sections = [
    { key: "entrada", label: "Notas de Entrada", icon: FileInput, color: "text-amber-600", bg: "bg-amber-50", desc: "NF-e/NFC-e de fornecedores importadas" },
    { key: "saida", label: "Notas de Saída (NF-e + NFC-e)", icon: FileOutput, color: "text-blue-600", bg: "bg-blue-50", desc: "Vendas e operações de saída emitidas" },
    { key: "nfse", label: "Notas de Serviço (NFS-e)", icon: FileCheck2, color: "text-purple-600", bg: "bg-purple-50", desc: "Notas fiscais de serviço eletrônicas" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <FolderArchive className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="font-bold text-base">Exportar XMLs para Contabilidade</h2>
              <p className="text-xs text-gray-500">{MONTHS_FULL[month]} de {year}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded" disabled={exporting}>
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-7 h-7 animate-spin text-indigo-600" /></div>
          ) : (
            <>
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex gap-2">
                <FileText className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-700">
                  Selecione os tipos de documento e exporte um arquivo <b>.zip</b> organizado por pastas
                  (<b>1-Entrada</b>, <b>2-Saida</b>, <b>3-NFS-e</b>) com um índice. Pronto para enviar ao contador.
                </p>
              </div>

              {sections.map(s => {
                const Icon = s.icon;
                const checked = include[s.key];
                const count = counts[s.key];
                return (
                  <button
                    key={s.key}
                    onClick={() => toggle(s.key)}
                    disabled={exporting}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                      checked ? `${s.bg} border-current/30` : "bg-white border-gray-200 opacity-60"
                    }`}
                  >
                    <input type="checkbox" checked={checked} readOnly className="pointer-events-none" />
                    <Icon className={`w-5 h-5 ${s.color}`} />
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{s.label}</p>
                      <p className="text-[11px] text-gray-500">{s.desc}</p>
                    </div>
                    <span className={`text-sm font-bold ${count > 0 ? s.color : "text-gray-400"}`}>
                      {count} XML(s)
                    </span>
                  </button>
                );
              })}

              {totalSelected === 0 && (
                <div className="text-center py-4 text-gray-400 text-sm flex items-center justify-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Nenhum XML disponível para o período selecionado.
                </div>
              )}

              {exporting && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                    <span className="truncate">{progress.label || "Preparando..."}</span>
                    <span className="ml-auto font-medium">{progress.done}/{progress.total}</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 transition-all"
                      style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}

              {result && (
                <div className={`rounded-lg p-3 text-sm ${result.ok ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
                  {result.ok ? (
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div className="text-emerald-800">
                        <p className="font-semibold">Exportação concluída: {result.baixados} arquivo(s)</p>
                        {result.falhas.length > 0 && (
                          <p className="text-xs mt-1 text-amber-700">
                            {result.falhas.length} falha(s): {result.falhas.slice(0, 3).join("; ")}
                            {result.falhas.length > 3 && "..."}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-red-700">Erro ao gerar ZIP: {result.error}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div className="p-4 border-t flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              {totalSelected > 0 ? `${totalSelected} arquivo(s) serão exportados` : "Nada para exportar"}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose} disabled={exporting}>Fechar</Button>
              <Button
                size="sm"
                onClick={handleExport}
                disabled={exporting || totalSelected === 0}
                className="gap-1.5 bg-indigo-600 hover:bg-indigo-700"
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {exporting ? "Gerando ZIP..." : "Exportar ZIP"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}