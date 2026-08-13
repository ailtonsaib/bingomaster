import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Loader2, Search, FileText, Download, Send, UploadCloud, ChevronDown, ChevronRight, Building, AlertTriangle, CheckCircle2, Printer, Square, CheckSquare } from "lucide-react";
import ExitOrderForm from "@/components/pdv/ExitOrderForm";
import CompanyConfigModal from "@/components/pdv/CompanyConfigModal";
import DanfePrint from "@/components/pdv/DanfePrint";

export default function ExitOrderManager({ user }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showCompanyConfig, setShowCompanyConfig] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [emitting, setEmitting] = useState(null);
  const [transmitting, setTransmitting] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [batchTransmitting, setBatchTransmitting] = useState(false);
  const [companyConfigured, setCompanyConfigured] = useState(false);
  const [companyConfig, setCompanyConfig] = useState(null);
  const [printOrder, setPrintOrder] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [orderList, configs] = await Promise.all([
        base44.entities.PDVExitOrder.filter({ user_email: user.email }, "-order_date", 100),
        base44.entities.PDVCompanyConfig.filter({ user_email: user.email }),
      ]);
      setOrders(orderList);
      setCompanyConfig(configs[0] || null);
      setCompanyConfigured(configs.length > 0 && configs[0].cnpj && configs[0].ie && configs[0].ibge_code);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user.email]);

  useEffect(() => { load(); }, [load]);

  const filtered = orders.filter(o =>
    o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
    o.nfe_number?.includes(search)
  );

  const fmtDate = (dt) => {
    if (!dt) return "—";
    try { return new Date(dt).toLocaleDateString("pt-BR"); } catch { return dt; }
  };

  const fmtMoney = (v) => "R$ " + (Number(v) || 0).toFixed(2);

  const statusBadge = (status) => {
    const map = {
      rascunho: { label: "Rascunho", cls: "bg-gray-100 text-gray-600" },
      emitida: { label: "Emitida", cls: "bg-emerald-100 text-emerald-700" },
      cancelada: { label: "Cancelada", cls: "bg-red-100 text-red-600" },
    };
    const s = map[status] || map.rascunho;
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>;
  };

  const emitDocumento = async (order, modelo) => {
    if (!companyConfigured) {
      alert("Configure os dados da empresa antes de emitir!");
      setShowCompanyConfig(true);
      return;
    }
    setEmitting(order.id);
    try {
      const res = await base44.functions.invoke("gerarNfeSaida", { order_id: order.id, modelo });
      if (res.data?.success) {
        const label = modelo === "65" ? "NFC-e" : "NF-e";
        alert(`${label} gerada com sucesso!\nNúmero: ${res.data.nfe_number}\nChave: ${res.data.nfe_key}`);
        load();
      } else {
        alert("Erro ao emitir:\n" + (res.data?.error || "Erro desconhecido."));
      }
    } catch (e) {
      const errMsg = e?.response?.data?.error || e?.message || "Erro desconhecido.";
      alert("Erro ao emitir:\n" + errMsg);
    }
    setEmitting(null);
  };

  const transmitNfe = async (order) => {
    setTransmitting(order.id);
    try {
      const res = await base44.functions.invoke("transmitirNfe", { order_id: order.id });
      const d = res.data || {};
      if (d.success) {
        alert(`NF-e autorizada!\nProtocolo: ${d.nProt}\nStatus: ${d.cStat} - ${d.xMotivo}`);
        load();
      } else {
        alert(
          `Transmissão não autorizada.\n${d.statusText || d.error || "Erro desconhecido."}` +
          (d.rawResponse ? "\n\nResposta SEFAZ (início):\n" + d.rawResponse.slice(0, 500) : "")
        );
        load();
      }
    } catch (e) {
      const errMsg = e?.response?.data?.error || e?.message || "Erro desconhecido.";
      alert("Erro ao transmitir NF-e:\n" + errMsg);
    }
    setTransmitting(null);
  };

  const transmittable = filtered.filter(o => o.status === "emitida" && o.nfe_xml && !o.nfe_protocol);

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allSelected = transmittable.length > 0 && transmittable.every(o => selected.has(o.id));

  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(transmittable.map(o => o.id)));
  };

  const transmitLote = async () => {
    const ids = [...selected];
    if (ids.length === 0) return alert("Selecione ao menos uma nota para transmitir.");
    if (!confirm(`Transmitir ${ids.length} nota(s) à SEFAZ?`)) return;
    setBatchTransmitting(true);
    const ok = [], falha = [];
    for (const id of ids) {
      try {
        const res = await base44.functions.invoke("transmitirNfe", { order_id: id });
        const d = res.data || {};
        if (d.success) ok.push(id); else falha.push({ id, msg: d.statusText || d.error || "Erro" });
      } catch (e) {
        falha.push({ id, msg: e?.response?.data?.error || e?.message || "Erro" });
      }
    }
    setSelected(new Set());
    setBatchTransmitting(false);
    let msg = `Transmissão concluída.\nAutorizadas: ${ok.length}`;
    if (falha.length) msg += `\nFalhas: ${falha.length}` + falha.slice(0, 5).map(f => `\n— ${f.msg}`).join("");
    alert(msg);
    load();
  };

  const downloadXml = (order) => {
    if (!order.nfe_xml) return;
    const blob = new Blob([order.nfe_xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `NFe_${order.nfe_number || order.order_number}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-orange-600" />
          <h2 className="text-lg font-bold">Pedidos de Saída / NF-e</h2>
          <span className="text-sm text-gray-500">({orders.length})</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {transmittable.length > 0 && (
            <Button
              onClick={transmitLote}
              disabled={batchTransmitting || selected.size === 0}
              className="h-9 gap-1.5 bg-blue-600 hover:bg-blue-700"
            >
              {batchTransmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              Transmitir SEFAZ {selected.size > 0 ? `(${selected.size})` : "(selecionar)"}
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowCompanyConfig(true)} className="h-9 gap-1.5">
            <Building className="w-4 h-4" /> Empresa
            {companyConfigured && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
          </Button>
          <Button onClick={() => setShowForm(true)} className="h-9 gap-1.5 bg-orange-600 hover:bg-orange-700">
            <Plus className="w-4 h-4" /> Novo Pedido
          </Button>
        </div>
      </div>

      {!companyConfigured && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            Configure os <b>dados da empresa emitente</b> antes de emitir NF-e. Clique em "Empresa" acima.
          </p>
        </div>
      )}

      <div className="relative max-w-xs">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar pedido..." className="pl-9 h-9" />
      </div>

      {transmittable.length > 0 && (
        <div className="flex items-center gap-3 text-sm bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <button onClick={toggleSelectAll} className="flex items-center gap-1.5 text-blue-700 font-medium">
            {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            Selecionar todas ({transmittable.length})
          </button>
          {selected.size > 0 && (
            <>
              <span className="text-blue-600">{selected.size} selecionada(s)</span>
              <button onClick={() => setSelected(new Set())} className="text-xs text-gray-500 hover:text-gray-700">limpar</button>
            </>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-orange-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>Nenhum pedido de saída registrado</p>
          <p className="text-xs mt-1">Clique em "Novo Pedido" para começar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(order => (
            <div key={order.id} className="bg-white rounded-lg border overflow-hidden">
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpanded(expanded === order.id ? null : order.id)}
              >
                {order.status === "emitida" && order.nfe_xml && !order.nfe_protocol && (
                  <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
                    <button onClick={() => toggleSelect(order.id)} className="p-0.5" title="Selecionar nota">
                      {selected.has(order.id)
                        ? <CheckSquare className="w-4 h-4 text-blue-600" />
                        : <Square className="w-4 h-4 text-gray-400 hover:text-gray-600" />}
                    </button>
                  </div>
                )}
                {expanded === order.id ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                <div className="flex-1 flex flex-wrap items-center gap-4">
                  <div>
                    <p className="font-semibold text-sm">{order.customer_name || "—"}</p>
                    <p className="text-xs text-gray-500">{order.order_number} · {fmtDate(order.order_date)}</p>
                  </div>
                  <div className="text-sm">
                    <p className="text-xs text-gray-500">CFOP</p>
                    <p className="font-medium">{order.cfop || "—"}</p>
                  </div>
                  <div className="text-sm">
                    <p className="text-xs text-gray-500">Itens</p>
                    <p className="font-medium">{order.items?.length || 0}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Total</p>
                    <p className="font-bold text-orange-600">{fmtMoney(order.total_nota)}</p>
                  </div>
                  {order.status === "emitida" && order.nfe_number && (
                    <div className="text-sm">
                      <p className="text-xs text-gray-500">{order.nfe_model === "65" ? "NFC-e" : "NF-e"}</p>
                      <p className="font-medium text-xs">{order.nfe_number}/{order.nfe_series}</p>
                    </div>
                  )}
                  {statusBadge(order.status)}
                </div>
                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                  {order.status === "rascunho" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => emitDocumento(order, "55")}
                        disabled={emitting === order.id}
                        className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-xs"
                      >
                        {emitting === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Emitir NF-e
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => emitDocumento(order, "65")}
                        disabled={emitting === order.id}
                        className="h-8 gap-1.5 bg-teal-600 hover:bg-teal-700 text-xs"
                      >
                        {emitting === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Emitir NFC-e
                      </Button>
                    </>
                  )}
                  {order.status === "emitida" && order.nfe_xml && (
                    <Button size="sm" variant="outline" onClick={() => downloadXml(order)} className="h-8 gap-1.5 text-xs">
                      <Download className="w-3.5 h-3.5" /> XML
                    </Button>
                  )}
                  {order.status === "emitida" && order.nfe_xml && !order.nfe_protocol && (
                    <Button
                      size="sm"
                      onClick={() => transmitNfe(order)}
                      disabled={transmitting === order.id}
                      className="h-8 gap-1.5 bg-blue-600 hover:bg-blue-700 text-xs"
                    >
                      {transmitting === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                      Transmitir SEFAZ
                    </Button>
                  )}
                  {order.status === "emitida" && (
                    <Button size="sm" variant="outline" onClick={() => setPrintOrder(order)} className="h-8 gap-1.5 text-xs">
                      <Printer className="w-3.5 h-3.5" /> DANFE
                    </Button>
                  )}
                </div>
              </div>

              {expanded === order.id && order.items?.length > 0 && (
                <div className="border-t bg-gray-50 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="p-2 text-left">Produto</th>
                        <th className="p-2 text-center">NCM</th>
                        <th className="p-2 text-center">CFOP</th>
                        <th className="p-2 text-right">Qtd</th>
                        <th className="p-2 text-right">V. Unit</th>
                        <th className="p-2 text-right">Total</th>
                        <th className="p-2 text-right">ICMS</th>
                        <th className="p-2 text-right">IPI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((item, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-2">{item.product_name}</td>
                          <td className="p-2 text-center font-mono">{item.ncm}</td>
                          <td className="p-2 text-center">{item.cfop}</td>
                          <td className="p-2 text-right">{item.quantity}</td>
                          <td className="p-2 text-right">{(item.unit_price || 0).toFixed(2)}</td>
                          <td className="p-2 text-right font-medium">{(item.total || 0).toFixed(2)}</td>
                          <td className="p-2 text-right">{(item.icms_rate || 0).toFixed(2)}% (R$ {(item.icms_value || 0).toFixed(2)})</td>
                          <td className="p-2 text-right">{(item.ipi_rate || 0).toFixed(2)}% (R$ {(item.ipi_value || 0).toFixed(2)})</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex gap-4 p-3 text-xs bg-white border-t flex-wrap">
                    <span><b>Produtos:</b> {fmtMoney(order.total_products)}</span>
                    <span><b>ICMS:</b> {fmtMoney(order.total_icms)}</span>
                    <span><b>IPI:</b> {fmtMoney(order.total_ipi)}</span>
                    <span><b>PIS:</b> {fmtMoney(order.total_pis)}</span>
                    <span><b>COFINS:</b> {fmtMoney(order.total_cofins)}</span>
                    <span className="ml-auto"><b>Total NF:</b> <span className="text-orange-600 font-bold">{fmtMoney(order.total_nota)}</span></span>
                  </div>
                  {order.nfe_key && (
                    <div className="p-3 bg-blue-50 border-t text-xs">
                      <p><b>Chave de Acesso:</b> <span className="font-mono break-all">{order.nfe_key}</span></p>
                    </div>
                  )}
                  {order.nfe_protocol && (
                    <div className="p-3 bg-emerald-50 border-t text-xs">
                      <p><b>Protocolo SEFAZ:</b> {order.nfe_protocol}</p>
                      <p className="text-gray-600"><b>Status:</b> {order.nfe_status}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ExitOrderForm
          user={user}
          onClose={() => setShowForm(false)}
          onSaved={load}
        />
      )}

      {showCompanyConfig && (
        <CompanyConfigModal
          user={user}
          onClose={() => setShowCompanyConfig(false)}
          onSaved={load}
        />
      )}
      {printOrder && (
        <DanfePrint
          order={printOrder}
          company={companyConfig}
          onClose={() => setPrintOrder(null)}
        />
      )}
    </div>
  );
}