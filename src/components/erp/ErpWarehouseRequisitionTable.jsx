import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, ClipboardList, PackageMinus } from "lucide-react";
import { fmtDate } from "@/lib/erpUtils";

const REQ_STATUS = {
  pendente: { label: "Pendente", color: "text-amber-700 bg-amber-100" },
  atendida: { label: "Atendida", color: "text-emerald-700 bg-emerald-100" },
  cancelada: { label: "Cancelada", color: "text-red-700 bg-red-100" },
};

export default function RequisitionsTable({ reqs, loading, search, onOpen }) {
  const s = (search || "").toLowerCase();
  const filtered = reqs.filter(r =>
    (r.number + " " + (r.production_order_number || "") + " " + (r.items || []).map(i => i.product_name).join(" ")).toLowerCase().includes(s)
  );
  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-gray-500 text-xs">
            <tr>
              <th className="p-2 text-left">Requisição</th>
              <th className="p-2 text-left">OP Vinculada</th>
              <th className="p-2 text-left">Data</th>
              <th className="p-2 text-right">Itens</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-6 text-center text-gray-400">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-400">
                <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhuma requisição ao almoxarifado.
              </td></tr>
            ) : filtered.map(r => {
              const st = REQ_STATUS[r.status] || { label: r.status, color: "text-gray-700 bg-gray-100" };
              return (
                <tr key={r.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => onOpen(r)}>
                  <td className="p-2 font-mono text-xs">{r.number}</td>
                  <td className="p-2 font-medium">{r.production_order_number || "—"}</td>
                  <td className="p-2 text-gray-600">{fmtDate(r.request_date)}</td>
                  <td className="p-2 text-right">{(r.items || []).length}</td>
                  <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span></td>
                  <td className="p-2 text-right">
                    <button onClick={e => { e.stopPropagation(); onOpen(r); }} className="text-xs text-blue-600 hover:underline">Ver itens</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RequisitionDetailModal({ req, onClose, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [products, setProducts] = useState([]);
  const [jaBaixado, setJaBaixado] = useState(null);
  const st = REQ_STATUS[req.status] || { label: req.status, color: "text-gray-700 bg-gray-100" };

  // Saldo atual do produto (reflete ajustes de inventário posteriores à requisição)
  useEffect(() => {
    let alive = true;
    base44.entities.ErpProduct.filter({ user_email: req.user_email }, "-created_date", 500)
      .then(list => { if (alive) setProducts(list); })
      .catch(() => {});
    return () => { alive = false; };
  }, [req.user_email]);
  const currentStock = (productId) => {
    const p = products.find(p => p.id === productId);
    return p ? Number(p.stock) || 0 : null;
  };

  // Requisição já atendida: verifica se a baixa do estoque já foi registrada
  useEffect(() => {
    if (req.status !== "atendida") { setJaBaixado(null); return; }
    let alive = true;
    base44.entities.ErpWmsMove.filter({ user_email: req.user_email, document: `Requisição ${req.number}` }, "-created_date", 100)
      .then(list => { if (alive) setJaBaixado((list || []).length > 0); })
      .catch(() => { if (alive) setJaBaixado(false); });
    return () => { alive = false; };
  }, [req.id, req.status, req.number]);

  // Baixa do estoque: os itens entregues pelo almoxarifado saem do saldo dos produtos
  const baixarEstoque = async () => {
    for (const it of (req.items || [])) {
      if (!it.product_id || !(Number(it.quantity) > 0)) continue;
      const p = await base44.entities.ErpProduct.get(it.product_id);
      await base44.entities.ErpProduct.update(it.product_id, {
        stock: Math.round((((Number(p.stock) || 0) - Number(it.quantity)) + Number.EPSILON) * 1000) / 1000,
      });
      await base44.entities.ErpWmsMove.create({
        user_email: req.user_email,
        move_type: "saida",
        product_id: it.product_id,
        product_code: it.product_code || "",
        product_name: it.product_name || "",
        unit: it.unit || "",
        quantity: Number(it.quantity),
        document: `Requisição ${req.number}`,
        move_date: new Date().toISOString(),
        notes: `Saída por requisição ao almoxarifado${req.production_order_number ? ` — OP ${req.production_order_number}` : ""}`,
      });
    }
  };

  const changeStatus = async (status) => {
    if (status === "cancelada" && !confirm(`Cancelar a requisição ${req.number}?`)) return;
    if (status === "atendida" && !confirm(`Marcar a requisição ${req.number} como atendida? Os itens solicitados serão baixados do estoque.`)) return;
    setBusy(true);
    try {
      if (status === "atendida") await baixarEstoque();
      await base44.entities.ErpWarehouseRequisition.update(req.id, { status });
      onSaved();
      onClose();
    } catch (e) { alert("Erro: " + e.message); }
    setBusy(false);
  };

  // Requisição atendida antes da baixa automática: permite baixar o estoque agora
  const baixarAgora = async () => {
    if (!confirm(`Baixar do estoque os itens da requisição ${req.number}?`)) return;
    setBusy(true);
    try {
      await baixarEstoque();
      alert("Estoque baixado com sucesso.");
      onSaved();
      onClose();
    } catch (e) { alert("Erro: " + e.message); }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-bold">Requisição {req.number}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-500">✕</button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-gray-500">OP vinculada: </span><b>{req.production_order_number || "—"}</b></div>
            <div><span className="text-gray-500">Data: </span><b>{fmtDate(req.request_date)}</b></div>
            <div><span className="text-gray-500">Status: </span><span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span></div>
          </div>
          <div>
            <p className="font-semibold mb-1">Itens solicitados:</p>
            {req.items?.length ? (
              <>
              <table className="w-full text-xs border rounded">
                <thead className="bg-gray-100"><tr><th className="p-1.5 text-left">Insumo</th><th className="p-1.5 text-left">Un.</th><th className="p-1.5 text-right">Solicitado</th><th className="p-1.5 text-right">Estoque na ocasião</th><th className="p-1.5 text-right">Saldo Atual</th></tr></thead>
                <tbody>
                  {req.items.map((it, i) => {
                    const cur = currentStock(it.product_id);
                    const changed = cur !== null && Number(cur) !== Number(it.stock_at_request || 0);
                    return (
                      <tr key={i} className="border-t">
                        <td className="p-1.5">{it.product_name}</td>
                        <td className="p-1.5">{it.unit}</td>
                        <td className="p-1.5 text-right font-medium">{it.quantity}</td>
                        <td className="p-1.5 text-right text-gray-500">{it.stock_at_request}</td>
                        <td className={`p-1.5 text-right font-medium ${changed ? "text-indigo-600" : ""}`}>
                          {cur === null ? "—" : <span title={changed ? "Saldo corrigido após a geração da requisição (ex.: ajuste de inventário)" : ""}>{cur.toLocaleString("pt-BR")}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-[11px] text-gray-400 mt-1">O estoque na ocasião é o saldo no momento em que a requisição foi gerada; o saldo atual reflete os ajustes posteriores (ex.: inventário).</p>
              </>
            ) : <p className="text-gray-400">Sem itens.</p>}
          </div>
          {req.notes && <div><span className="text-gray-500">Obs: </span>{req.notes}</div>}
          {req.status === "pendente" && (
            <div className="flex gap-2 justify-end pt-2 border-t">
              <Button size="sm" variant="outline" disabled={busy} onClick={() => changeStatus("cancelada")} className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"><XCircle className="w-4 h-4" /> Cancelar</Button>
              <Button size="sm" disabled={busy} onClick={() => changeStatus("atendida")} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 className="w-4 h-4" /> Marcar como Atendida</Button>
            </div>
          )}
          {req.status === "atendida" && (
            <div className="flex gap-2 items-center justify-end pt-2 border-t">
              {jaBaixado === false && (
                <Button size="sm" disabled={busy} onClick={baixarAgora} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><PackageMinus className="w-4 h-4" /> Baixar do Estoque</Button>
              )}
              {jaBaixado && <p className="text-xs text-emerald-700">Estoque já baixado para os itens desta requisição.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}