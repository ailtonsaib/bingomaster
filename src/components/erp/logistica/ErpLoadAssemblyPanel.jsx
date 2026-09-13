import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { genOrderNumber, fmtMoney, fmtDate } from "@/lib/erpUtils";
import { computeWmsBalances, allocatePick, palletize, r2 } from "@/lib/erpLoadAssembly";
import ErpLoadReportModal from "./ErpLoadReportModal";
import { Loader2, Printer, Trash2, Truck, CheckCircle2, ListMinus } from "lucide-react";

const LOAD_STATUS = {
  montada: { label: "Montada", color: "text-amber-700 bg-amber-100" },
  carregada: { label: "Carregada", color: "text-emerald-700 bg-emerald-100" },
  cancelada: { label: "Cancelada", color: "text-gray-600 bg-gray-100" },
};

export default function ErpLoadAssemblyPanel({ user }) {
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [products, setProducts] = useState([]);
  const [moves, setMoves] = useState([]);
  const [loads, setLoads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // filtros de pedidos
  const [fSeller, setFSeller] = useState("");
  const [fCity, setFCity] = useState("");
  const [fDistrict, setFDistrict] = useState("");

  const [selected, setSelected] = useState([]);
  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [reportLoad, setReportLoad] = useState(null);
  const [editingLoad, setEditingLoad] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [os, cs, vs, ds, ps, ms, ls] = await Promise.all([
        base44.entities.ErpSalesOrder.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpCustomer.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpFleetVehicle.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpFleetDriver.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpProduct.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpWmsMove.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpLoadAssembly.filter({ user_email: user.email }, "-created_date", 500),
      ]);
      setOrders(os.filter(o => o.status === "aberto"));
      setCustomers(cs);
      setVehicles(vs.filter(v => v.is_active !== false && v.status !== "inativo"));
      setDrivers(ds.filter(d => d.is_active !== false && d.status !== "inativo"));
      setProducts(ps);
      setMoves(ms);
      setLoads(ls);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const custOf = (o) => customers.find(c => c.id === o.customer_id);

  // Consolida os produtos de uma lista de pedidos: paletização, peso (peso bruto por volume) e endereço/lote WMS
  const consolidate = (ordList) => {
    const byProduct = new Map();
    for (const o of ordList) {
      for (const it of o.items || []) {
        if (!it.product_id) continue;
        const cur = byProduct.get(it.product_id) || { qty: 0 };
        cur.qty = r2(cur.qty + (Number(it.quantity) || 0));
        byProduct.set(it.product_id, cur);
      }
    }
    const balances = computeWmsBalances(moves);
    const items = [];
    let totalVolumes = 0, totalPallets = 0, totalWeight = 0;
    for (const [pid, { qty }] of byProduct) {
      const p = products.find(x => x.id === pid);
      if (!p) continue;
      const pal = palletize(qty, p);
      totalVolumes = r2(totalVolumes + pal.volumes);
      totalPallets = r2(totalPallets + pal.pallets);
      totalWeight = r2(totalWeight + pal.volumes * (Number(p.gross_weight) || 0));
      items.push({
        product_id: p.id, product_code: p.code || "", product_name: p.name, unit: p.unit || "",
        quantity: pal.volumes,
        fator_pallet: Number(p.fator_pallet) || 0,
        volumes_por_camada: Number(p.volumes_por_camada) || 0,
        quantidade_camadas: Number(p.quantidade_camadas) || 0,
        pallets: pal.pallets, loose_volumes: pal.loose, layers: pal.layers,
        controla_lote: !!p.controla_lote,
        wms: allocatePick(balances, p, pal.volumes),
      });
    }
    return { items, totalVolumes, totalPallets, totalWeight };
  };

  // Peso bruto total de uma lista de pedidos (volumes × peso bruto do produto)
  const ordersWeight = (ordList) => r2((ordList || []).reduce((s, o) =>
    s + (o.items || []).reduce((s2, it) => {
      const p = products.find(x => x.id === it.product_id);
      return s2 + (Number(it.quantity) || 0) * (Number(p?.gross_weight) || 0);
    }, 0), 0));

  // pedidos já atrelados a cargas ativas não aparecem para nova montagem
  const ordersInActiveLoads = new Set(
    loads.filter(l => l.status === "montada" || l.status === "carregada")
      .flatMap(l => (l.orders || []).map(o => o.order_id))
  );

  const enrich = (o) => {
    const c = custOf(o);
    return { ...o, seller_name: c?.vendedor_name || "—", city: c?.city || "—", district: c?.district || "—" };
  };

  const available = orders.filter(o => !ordersInActiveLoads.has(o.id)).map(enrich);
  const filtered = available.filter(o =>
    (!fSeller || o.seller_name === fSeller) &&
    (!fCity || o.city === fCity) &&
    (!fDistrict || o.district === fDistrict)
  );

  const sellerOptions = [...new Set(available.map(o => o.seller_name).filter(v => v && v !== "—"))];
  const cityOptions = [...new Set(available.map(o => o.city).filter(v => v && v !== "—"))];
  const districtOptions = [...new Set(
    available.filter(o => (!fCity || o.city === fCity)).map(o => o.district).filter(v => v && v !== "—")
  )];

  const selectedOrders = available.filter(o => selected.includes(o.id));
  const selectedTotal = selectedOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const allSelected = filtered.length > 0 && filtered.every(o => selected.includes(o.id));
  const selectedWeight = ordersWeight(selectedOrders);
  const selVehicle = vehicles.find(v => v.id === vehicleId);
  const selTara = Number(selVehicle?.tara) || 0;
  const weightExceeded = selTara > 0 && selectedWeight > selTara;

  const toggle = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleMount = async () => {
    if (selected.length === 0) { alert("Selecione pelo menos um pedido."); return; }
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (!vehicle) { alert("Selecione o veículo da carga."); return; }
    const exceedNote = weightExceeded
      ? `\n\nATENÇÃO: o peso da carga (${selectedWeight.toLocaleString("pt-BR")} kg) EXCEDE a tara do veículo (${selTara.toLocaleString("pt-BR")} kg). A carga será montada mesmo assim.`
      : "";
    if (!confirm(`Montar a carga com ${selected.length} pedido(s) no veículo ${vehicle.plate}?${exceedNote}`)) return;
    setBusy(true);
    try {
      const { items, totalVolumes, totalPallets, totalWeight } = consolidate(selectedOrders);
      const driver = drivers.find(d => d.id === driverId);
      await base44.entities.ErpLoadAssembly.create({
        user_email: user.email,
        number: genOrderNumber("CARGA"),
        load_date: new Date().toISOString(),
        vehicle_id: vehicle.id,
        vehicle_plate: vehicle.plate || "",
        driver_id: driverId || "",
        driver_name: driver?.name || "",
        orders: selectedOrders.map(o => ({
          order_id: o.id, order_number: o.number || "",
          customer_name: o.customer_name || "", seller_name: o.seller_name || "",
          city: o.city || "", district: o.district || "",
          total: r2(o.total),
        })),
        items,
        total_volumes: totalVolumes,
        total_pallets: totalPallets,
        total_weight: totalWeight,
        status: "montada",
      });
      setSelected([]);
      load();
    } catch (e) { alert(e.message); }
    setBusy(false);
  };

  const handleStatus = async (l, status) => {
    if (status === "carregada" && !confirm(`Confirmar carregamento da carga ${l.number}?`)) return;
    setBusy(true);
    try {
      await base44.entities.ErpLoadAssembly.update(l.id, { status });
      load();
    } catch (e) { alert(e.message); }
    setBusy(false);
  };

  const handleDelete = async (l) => {
    if (!confirm(`Excluir a carga ${l.number}? Os pedidos voltarão a ficar disponíveis para montagem.`)) return;
    setBusy(true);
    try {
      await base44.entities.ErpLoadAssembly.delete(l.id);
      load();
    } catch (e) { alert(e.message); }
    setBusy(false);
  };

  // Retira um pedido da carga montada — recalcula produtos, paletização, peso e endereços WMS
  const handleRemoveOrder = async (orderId) => {
    const remaining = (editingLoad.orders || []).filter(o => o.order_id !== orderId);
    if (!confirm(remaining.length === 0
      ? "Este é o último pedido da carga — a carga será excluída. Confirmar?"
      : "Retirar este pedido da carga? Os produtos, os pallets, o peso e os endereços de separação serão recalculados.")) return;
    setBusy(true);
    try {
      if (remaining.length === 0) {
        await base44.entities.ErpLoadAssembly.delete(editingLoad.id);
      } else {
        const ordList = [];
        for (const o of remaining) {
          try { ordList.push(await base44.entities.ErpSalesOrder.get(o.order_id)); } catch (err) { /* pedido indisponível */ }
        }
        const c = consolidate(ordList);
        await base44.entities.ErpLoadAssembly.update(editingLoad.id, {
          orders: remaining,
          items: c.items,
          total_volumes: c.totalVolumes,
          total_pallets: c.totalPallets,
          total_weight: c.totalWeight,
        });
      }
      setEditingLoad(null);
      load();
    } catch (e) { alert(e.message); }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-base">Montagem de Carga</h2>
        <p className="text-xs text-gray-500">Filtre os pedidos por vendedor, cidade e bairro, selecione e atrele a um veículo. O relatório de separação mostra o endereço (WMS), o lote e a paletização (fator pallet × volumes por camada × camadas).</p>
      </div>

      <div className="bg-white rounded-xl border p-3 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <select value={fSeller} onChange={e => setFSeller(e.target.value)} className="h-9 rounded-md border border-input bg-white px-3 text-sm">
            <option value="">Vendedor: todos</option>
            {sellerOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={fCity} onChange={e => { setFCity(e.target.value); setFDistrict(""); }} className="h-9 rounded-md border border-input bg-white px-3 text-sm">
            <option value="">Cidade: todas</option>
            {cityOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={fDistrict} onChange={e => setFDistrict(e.target.value)} className="h-9 rounded-md border border-input bg-white px-3 text-sm">
            <option value="">Bairro: todos</option>
            {districtOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 w-8">
                  <input type="checkbox" className="w-4 h-4 accent-indigo-600" checked={allSelected}
                    onChange={e => setSelected(e.target.checked ? filtered.map(o => o.id) : [])} />
                </th>
                <th className="p-2 text-left">Pedido</th>
                <th className="p-2 text-left">Data</th>
                <th className="p-2 text-left">Cliente</th>
                <th className="p-2 text-left">Vendedor</th>
                <th className="p-2 text-left">Cidade</th>
                <th className="p-2 text-left">Bairro</th>
                <th className="p-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="p-6 text-center text-gray-400">Nenhum pedido aberto disponível (pedidos já atrelados a cargas ativas não aparecem).</td></tr>
              ) : filtered.map(o => (
                <tr key={o.id} className="border-t hover:bg-gray-50">
                  <td className="p-2"><input type="checkbox" className="w-4 h-4 accent-indigo-600" checked={selected.includes(o.id)} onChange={() => toggle(o.id)} /></td>
                  <td className="p-2 font-medium">{o.number || o.id}</td>
                  <td className="p-2 text-xs">{fmtDate(o.emission_date)}</td>
                  <td className="p-2">{o.customer_name}</td>
                  <td className="p-2">{o.seller_name}</td>
                  <td className="p-2">{o.city}</td>
                  <td className="p-2">{o.district}</td>
                  <td className="p-2 text-right">{fmtMoney(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2 flex-wrap bg-indigo-50 border border-indigo-100 rounded-lg p-2 text-sm">
          <span className={`text-xs font-medium ${weightExceeded ? "text-red-700" : "text-indigo-800"}`}>
            {selected.length} pedido(s) selecionado(s) — {fmtMoney(selectedTotal)}
          </span>
          <span className={`text-xs font-medium ${weightExceeded ? "text-red-700" : "text-gray-600"}`}>
            Peso: {selectedWeight.toLocaleString("pt-BR")} kg{selTara > 0 ? ` / Tara do veículo: ${selTara.toLocaleString("pt-BR")} kg` : ""}
          </span>
          {weightExceeded && <span className="text-xs font-bold text-red-700">CARGA EXCEDIDA — acima da tara do veículo</span>}
          <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} className="h-8 rounded-md border border-input bg-white px-2 text-xs">
            <option value="">Veículo...</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} — {v.brand || ""} {v.model || ""}</option>)}
          </select>
          <select value={driverId} onChange={e => setDriverId(e.target.value)} className="h-8 rounded-md border border-input bg-white px-2 text-xs">
            <option value="">Motorista (opcional)...</option>
            {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <Button size="sm" className="gap-1.5 bg-indigo-600 hover:bg-indigo-700" disabled={busy || loading} onClick={handleMount}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />} Montar Carga
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="p-2 bg-gray-50 border-b text-xs font-semibold text-gray-600">Cargas Montadas</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Carga</th>
                <th className="p-2 text-left">Data</th>
                <th className="p-2 text-left">Veículo</th>
                <th className="p-2 text-left">Motorista</th>
                <th className="p-2 text-right">Pedidos</th>
                <th className="p-2 text-right">Volumes</th>
                <th className="p-2 text-right">Pallets</th>
                <th className="p-2 text-right">Peso</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              ) : loads.length === 0 ? (
                <tr><td colSpan={10} className="p-6 text-center text-gray-400">Nenhuma carga montada.</td></tr>
              ) : loads.map(l => {
                const st = LOAD_STATUS[l.status] || {};
                const lTara = Number(vehicles.find(v => v.id === l.vehicle_id)?.tara) || 0;
                const lOver = lTara > 0 && (Number(l.total_weight) || 0) > lTara;
                return (
                  <tr key={l.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 font-medium">{l.number}</td>
                    <td className="p-2 text-xs">{fmtDate(l.load_date)}</td>
                    <td className="p-2 font-mono text-xs">{l.vehicle_plate || "—"}</td>
                    <td className="p-2">{l.driver_name || "—"}</td>
                    <td className="p-2 text-right">{(l.orders || []).length}</td>
                    <td className="p-2 text-right">{Number(l.total_volumes || 0).toLocaleString("pt-BR")}</td>
                    <td className="p-2 text-right">{Number(l.total_pallets || 0).toLocaleString("pt-BR")}</td>
                    <td className={`p-2 text-right font-medium ${lOver ? "text-red-600" : ""}`} title={lOver ? `Tara do veículo: ${lTara.toLocaleString("pt-BR")} kg` : ""}>
                      {Number(l.total_weight || 0).toLocaleString("pt-BR")} kg{lOver ? " (excedida)" : ""}
                    </td>
                    <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span></td>
                    <td className="p-2 text-right whitespace-nowrap">
                      <button onClick={() => setReportLoad(l)} title="Relatório de Separação e Carregamento" className="p-1 hover:bg-indigo-50 rounded"><Printer className="w-4 h-4 text-indigo-600" /></button>
                      {l.status === "montada" && (
                        <>
                          <button onClick={() => setEditingLoad(l)} title="Retirar pedido da carga" className="p-1 hover:bg-amber-50 rounded"><ListMinus className="w-4 h-4 text-amber-600" /></button>
                          <button onClick={() => handleStatus(l, "carregada")} title="Marcar como Carregada" className="p-1 hover:bg-emerald-50 rounded"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></button>
                        </>
                      )}
                      <button onClick={() => handleDelete(l)} title="Excluir carga" className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {reportLoad && (
        <ErpLoadReportModal
          load={reportLoad}
          vehicleTara={Number(vehicles.find(v => v.id === reportLoad.vehicle_id)?.tara) || 0}
          onClose={() => setReportLoad(null)}
        />
      )}

      {editingLoad && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
              <h2 className="font-bold">Retirar Pedido da Carga — {editingLoad.number}</h2>
              <button onClick={() => setEditingLoad(null)} className="p-1 hover:bg-gray-100 rounded text-gray-500">✕</button>
            </div>
            <div className="p-4">
              <p className="text-xs text-gray-500 mb-2">Ao retirar um pedido, os produtos, os pallets, o peso e os endereços de separação são recalculados automaticamente. Retirando o último pedido, a carga é excluída.</p>
              <table className="w-full text-sm">
                <thead className="bg-gray-100 text-gray-500 text-xs">
                  <tr>
                    <th className="p-2 text-left">Pedido</th>
                    <th className="p-2 text-left">Cliente</th>
                    <th className="p-2 text-left">Vendedor</th>
                    <th className="p-2 text-left">Cidade / Bairro</th>
                    <th className="p-2 text-right">Valor (R$)</th>
                    <th className="p-2 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {(editingLoad.orders || []).map((o, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 font-medium">{o.order_number}</td>
                      <td className="p-2">{o.customer_name}</td>
                      <td className="p-2">{o.seller_name || "—"}</td>
                      <td className="p-2">{o.city || "—"}{o.district ? ` / ${o.district}` : ""}</td>
                      <td className="p-2 text-right">{(Number(o.total) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right">
                        <Button size="sm" variant="destructive" className="gap-1" disabled={busy} onClick={() => handleRemoveOrder(o.order_id)}>
                          <ListMinus className="w-3.5 h-3.5" /> Retirar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}