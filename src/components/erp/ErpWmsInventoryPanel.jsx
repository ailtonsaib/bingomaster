import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Plus, Trash2, ClipboardList, FileDown, FileUp } from "lucide-react";
import { buildXlsxBlob, downloadBlob } from "@/lib/excelTemplate";
import { parseXlsxRows } from "@/lib/excelParser";
import ErpCombobox from "@/components/erp/ErpCombobox";
import { fmtMoney } from "@/lib/erpUtils";
import { gerarLancamentoAjusteInventario } from "@/lib/erpInventoryAdjust";

const STATUS_OPTS = [
  { value: "aberto", label: "Aberto", color: "bg-blue-100 text-blue-700" },
  { value: "contado", label: "Contado", color: "bg-amber-100 text-amber-700" },
  { value: "ajustado", label: "Ajustado", color: "bg-emerald-100 text-emerald-700" },
];
const INV_TYPES = [
  { value: "fisico", label: "Inventário Físico" },
  { value: "ciclico", label: "Inventário Cíclico" },
];
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function ErpWmsInventoryPanel({ user }) {
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [subgroups, setSubgroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [counting, setCounting] = useState(null);
  const [countForm, setCountForm] = useState({ counted_qty: 0, adjust: true, account_id: "", unit_cost: 0 });
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const [inv, p, w, l, acc, gr, sg] = await Promise.all([
        base44.entities.ErpWmsInventory.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpProduct.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpWarehouse.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpWmsLocation.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.ErpChartAccount.filter({ user_email: user.email, accepts_entries: true }, "code", 500),
        base44.entities.ErpStockGroup.filter({ user_email: user.email }, "code", 500),
        base44.entities.ErpStockSubgroup.filter({ user_email: user.email }, "code", 500),
      ]);
      setItems(inv); setProducts(p); setWarehouses(w); setLocations(l); setAccounts(acc); setGroups(gr); setSubgroups(sg);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const filtered = items.filter(it => {
    if (statusFilter && it.status !== statusFilter) return false;
    const t = [it.product_name, it.product_code, it.warehouse_name, it.location_code].map(v => String(v ?? "")).join(" ").toLowerCase();
    return t.includes(search.toLowerCase());
  });

  // Abre a janela de contagem com o custo unitário (informado ou do produto)
  const openCount = (it) => {
    setCounting(it);
    setCountForm({
      counted_qty: it.counted_qty || 0,
      adjust: true,
      account_id: "",
      unit_cost: Number(it.unit_cost) || Number(products.find(p => p.id === it.product_id)?.cost_price) || 0,
    });
  };

  // Converte texto do Excel para número (aceita 1.234,56 / 1234.56 / 1234,56)
  const num = (v) => {
    const s = String(v ?? "").trim();
    if (!s) return 0;
    const n = s.includes(",") ? parseFloat(s.replace(/\./g, "").replace(",", ".")) : parseFloat(s);
    return Number.isNaN(n) ? 0 : n;
  };

  // Exporta a listagem de inventário (respeitando o filtro atual) para conferência física
  const exportExcel = async () => {
    if (filtered.length === 0) return alert("Nenhuma contagem na lista para exportar.");
    const rows = filtered.map(it => {
      const prod = products.find(p => p.id === it.product_id);
      return [
        it.id,
        it.product_code || "",
        it.product_name || "",
        it.warehouse_name || "",
        it.location_code || "",
        it.unit || "",
        Number(it.system_qty) || 0,
        it.status !== "aberto" ? (Number(it.counted_qty) || 0) : "",
        Number(it.unit_cost) || Number(prod?.cost_price) || 0,
      ];
    });
    const blob = await buildXlsxBlob(
      ["ID", "Código", "Produto", "Armazém", "Endereço", "Unidade", "Qtd Sistema", "Qtd Contada", "Custo Unitário"],
      rows, "Inventário"
    );
    downloadBlob(blob, `inventario-${todayISO()}.xlsx`);
  };

  // Importa a planilha de contagem: registra as quantidades contadas por ID/código;
  // produto contado que não está na listagem gera uma nova contagem
  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const rows = await parseXlsxRows(file);
      const byId = new Map(items.map(it => [it.id, it]));
      let updated = 0, created = 0, skipped = 0;
      for (const r of rows) {
        const countedRaw = String(r.qtd_contada ?? "").trim();
        if (!countedRaw) { skipped++; continue; }
        const counted = num(countedRaw);
        const code = String(r.codigo ?? "").trim();
        const cost = num(r.custo_unitario);
        const id = String(r.id ?? "").trim();
        const target =
          (id && byId.get(id)) ||
          items.find(it => it.status !== "ajustado" && String(it.product_code ?? "").trim() === code &&
            String(it.warehouse_name ?? "") === String(r.armazem ?? "").trim() &&
            String(it.location_code ?? "") === String(r.endereco ?? "").trim()) ||
          items.find(it => it.status !== "ajustado" && String(it.product_code ?? "").trim() === code && code);
        if (target) {
          await base44.entities.ErpWmsInventory.update(target.id, {
            counted_qty: counted,
            status: "contado",
            ...(cost > 0 ? { unit_cost: cost } : {}),
          });
          updated++;
        } else if (code) {
          const prod = products.find(p => String(p.code ?? "").trim() === code);
          if (prod) {
            await base44.entities.ErpWmsInventory.create({
              user_email: user.email,
              inventory_type: "fisico",
              product_id: prod.id,
              product_code: prod.code || "",
              product_name: prod.name || "",
              unit: prod.unit || "",
              warehouse_name: String(r.armazem ?? "").trim(),
              location_code: String(r.endereco ?? "").trim(),
              system_qty: Number(prod.stock) || 0,
              counted_qty: counted,
              count_date: todayISO(),
              status: "contado",
              ...(cost > 0 ? { unit_cost: cost } : {}),
            });
            created++;
          } else skipped++;
        } else skipped++;
      }
      alert(`Importação concluída: ${updated} contagem(ns) atualizada(s), ${created} nova(s) contagem(ns) de produto(s) fora da lista, ${skipped} linha(s) ignorada(s). As contagens ficam com status "Contado" — clique em Contar para ajustar o estoque e gerar o lançamento contábil.`);
      load();
    } catch (err) { alert(err.message); }
  };

  const saveCount = async () => {
    setSaving(true);
    try {
      const counted = Number(countForm.counted_qty) || 0;
      const systemQty = Number(counting.system_qty) || 0;
      const diff = counted - systemQty;
      const adjust = countForm.adjust && diff !== 0;
      const product = products.find(p => p.id === counting.product_id);
      const unitCost = Number(countForm.unit_cost) || Number(product?.cost_price) || 0;
      let je = null;
      let adjustValue = 0;
      if (adjust) {
        // Confronto com o estoque real: exige a conta contábil do ajuste e gera o
        // lançamento na contabilidade antes de mexer no saldo do estoque
        const account = accounts.find(a => a.id === countForm.account_id);
        if (!account) { alert("Informe a conta contábil do ajuste (sobra/quebra de inventário)."); setSaving(false); return; }
        je = await gerarLancamentoAjusteInventario(user, {
          product, account, accounts, diff, unitCost,
          countDate: counting.count_date ? new Date(`${(counting.count_date).slice(0, 10)}T12:00:00`).toISOString() : undefined,
        });
        adjustValue = Math.round(Math.abs(diff) * unitCost * 100) / 100;
        // O custo unitário informado na contagem passa a ser o custo do produto —
        // reflete no kardex, nos relatórios e nos demais módulos
        if (product) await base44.entities.ErpProduct.update(product.id, {
          stock: counted,
          ...(unitCost > 0 ? { cost_price: Math.round(unitCost * 10000) / 10000 } : {}),
        });
        await base44.entities.ErpWmsMove.create({
          user_email: user.email,
          move_type: diff > 0 ? "entrada" : "saida",
          product_id: counting.product_id,
          product_code: counting.product_code || "",
          product_name: counting.product_name || "",
          unit: product?.unit || "",
          quantity: Math.abs(diff),
          warehouse_id: counting.warehouse_id || "",
          warehouse_name: counting.warehouse_name || "",
          location_id: counting.location_id || "",
          location_code: counting.location_code || "",
          document: `Inventário ${(counting.count_date || "").slice(0, 10)}`,
          move_date: todayISO(),
          notes: `Ajuste de inventário — ${diff > 0 ? "sobra" : "quebra"}${je?.number ? ` (${je.number})` : ""}`,
        });
      }
      await base44.entities.ErpWmsInventory.update(counting.id, {
        counted_qty: counted,
        status: adjust ? "ajustado" : "contado",
        adjust_account_id: adjust ? countForm.account_id : "",
        adjust_account_code: adjust ? (accounts.find(a => a.id === countForm.account_id)?.code || "") : "",
        adjust_account_name: adjust ? (accounts.find(a => a.id === countForm.account_id)?.name || "") : "",
        adjust_value: adjust ? adjustValue : 0,
        journal_entry_id: je?.id || "",
        journal_entry_number: je?.number || "",
        unit_cost: unitCost,
      });
      setCounting(null); load();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-base">Inventário (Físico / Cíclico)</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={exportExcel} className="gap-1.5"><FileDown className="w-4 h-4" /> Exportar Excel</Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5"><FileUp className="w-4 h-4" /> Importar Contagem</Button>
          <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4" /> Nova Contagem</Button>
          <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={handleImportFile} />
        </div>
      </div>
      <p className="text-xs text-gray-500 -mt-1">Contagem física por produto/endereço. Divergências podem ser ajustadas automaticamente: o saldo do produto é corrigido, a diferença é registrada como movimentação de estoque e o confronto com o estoque real gera o lançamento contábil (sobra: D estoque × C conta informada; quebra: D conta informada × C estoque) pelo valor da diferença × custo do produto.</p>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto, armazém, endereço..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-9 rounded-md border border-input bg-white px-3 text-sm">
          <option value="">Todos os status</option>
          {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-500 text-xs">
              <tr>
                <th className="p-2 text-left">Data</th><th className="p-2 text-left">Tipo</th><th className="p-2 text-left">Produto</th>
                <th className="p-2 text-left">Armazém</th><th className="p-2 text-left">Endereço</th><th className="p-2 text-right">Qtd Sistema</th>
                <th className="p-2 text-right">Qtd Contada</th><th className="p-2 text-right">Divergência</th><th className="p-2 text-left">Status</th><th className="p-2 text-left">Lançamento Contábil</th><th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="p-6 text-center text-gray-400">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={11} className="p-8 text-center text-gray-400">Nenhuma contagem de inventário.</td></tr>
              ) : filtered.map(it => {
                const counted = it.status !== "aberto" ? (Number(it.counted_qty) || 0) : null;
                const diff = counted !== null ? counted - (Number(it.system_qty) || 0) : null;
                const so = STATUS_OPTS.find(s => s.value === it.status);
                const to = INV_TYPES.find(t => t.value === it.inventory_type);
                return (
                  <tr
                    key={it.id}
                    className={`border-t hover:bg-gray-50 ${it.status !== "ajustado" ? "cursor-pointer" : ""}`}
                    onClick={() => { if (it.status !== "ajustado") openCount(it); }}
                  >
                    <td className="p-2 text-xs">{(it.count_date || "").slice(0, 10) || "—"}</td>
                    <td className="p-2 text-xs">{to ? to.label : it.inventory_type}</td>
                    <td className="p-2">{it.product_code ? <span className="font-mono text-xs mr-1">{it.product_code}</span> : null}{it.product_name || "—"}</td>
                    <td className="p-2">{it.warehouse_name || "—"}</td>
                    <td className="p-2 font-mono text-xs">{it.location_code || "—"}</td>
                    <td className="p-2 text-right">{Number(it.system_qty || 0).toLocaleString("pt-BR")}</td>
                    <td className="p-2 text-right">{counted !== null ? counted.toLocaleString("pt-BR") : "—"}</td>
                    <td className="p-2 text-right font-medium">
                      {diff === null ? "—" : (
                        <span className={diff === 0 ? "text-emerald-600" : diff > 0 ? "text-amber-600" : "text-red-600"}>
                          {diff > 0 ? "+" : ""}{diff.toLocaleString("pt-BR")}
                        </span>
                      )}
                    </td>
                    <td className="p-2">{so ? <span className={`text-xs px-2 py-0.5 rounded-full ${so.color}`}>{so.label}</span> : it.status}</td>
                    <td className="p-2 text-xs text-gray-600">
                      {it.journal_entry_number ? (
                        <span className="font-mono text-indigo-700" title={`Conta ${it.adjust_account_code || ""} ${it.adjust_account_name || ""} - ${fmtMoney(it.adjust_value || 0)}`}>{it.journal_entry_number}</span>
                      ) : (it.status === "ajustado" ? <span className="text-[11px] text-gray-400">sem lançamento</span> : "—")}
                    </td>
                    <td className="p-2 text-right whitespace-nowrap">
                      {it.status !== "ajustado" && (
                        <button title="Registrar Contagem" onClick={() => openCount(it)} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-600 text-white text-xs hover:bg-blue-700"><ClipboardList className="w-3.5 h-3.5" /> Contar</button>
                      )}
                      <button title="Excluir" onClick={async e => { e.stopPropagation(); if (confirm("Excluir esta contagem?")) { await base44.entities.ErpWmsInventory.delete(it.id); load(); } }} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <InventoryForm
          user={user} products={products} warehouses={warehouses} locations={locations} groups={groups} subgroups={subgroups}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}

      {counting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-bold">Contagem — {counting.product_name}</h2>
              <button onClick={() => setCounting(null)} className="p-1 hover:bg-gray-100 rounded text-gray-500">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-gray-600">
                Endereço: <b className="font-mono">{counting.location_code || "—"}</b> · Quantidade em sistema: <b>{Number(counting.system_qty || 0).toLocaleString("pt-BR")}</b>
              </p>
              <div>
                <Label className="text-xs font-medium text-gray-600">Quantidade Física Contada</Label>
                <Input type="number" step="0.01" value={countForm.counted_qty} onChange={e => setCountForm(p => ({ ...p, counted_qty: e.target.value }))} className="mt-1" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={countForm.adjust} onChange={e => setCountForm(p => ({ ...p, adjust: e.target.checked }))} className="w-4 h-4" />
                Ajustar o saldo do estoque automaticamente (gera movimentação da diferença e lançamento contábil)
              </label>
              {countForm.adjust && (Number(countForm.counted_qty) || 0) !== (Number(counting.system_qty) || 0) && (() => {
                const d = (Number(countForm.counted_qty) || 0) - (Number(counting.system_qty) || 0);
                const prod = products.find(p => p.id === counting.product_id);
                const unitCost = Number(countForm.unit_cost) || Number(prod?.cost_price) || 0;
                const val = Math.abs(d) * unitCost;
                const acc = accounts.find(a => a.id === countForm.account_id);
                return (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                    <p className="text-sm font-medium text-amber-800">
                      Ajuste para {d > 0 ? "mais (sobra)" : "menos (falta)"}: {d > 0 ? "+" : ""}{d.toLocaleString("pt-BR")} {prod?.unit || "un"} — valor contábil {fmtMoney(val)}
                    </p>
                    <p className="text-[11px] text-amber-700">
                      {d > 0
                        ? "Débito na conta de estoque do produto × crédito na conta informada (sobras de inventário)."
                        : "Débito na conta informada (quebras/perdas de inventário) × crédito na conta de estoque do produto."}
                      {" "}Conta de estoque do produto: <b>{prod?.account_estoque_name || "não configurada no cadastro do produto"}</b>.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs font-medium text-gray-600">Custo Unitário (R$)</Label>
                          <Input type="number" step="0.0001" value={countForm.unit_cost} onChange={e => setCountForm(p => ({ ...p, unit_cost: e.target.value }))} className="mt-1 h-8 text-sm" />
                          <p className="text-[10px] text-amber-700 mt-0.5">Se informado, atualiza o custo do produto.</p>
                        </div>
                      <div>
                        <Label className="text-xs font-medium text-gray-600">Custo Total do Ajuste</Label>
                        <p className="mt-2 text-sm font-semibold text-amber-800">{fmtMoney(val)}</p>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-gray-600">Conta Contábil do Ajuste *</Label>
                      <div className="mt-1">
                        <ErpCombobox
                          value={countForm.account_id}
                          onValueChange={v => setCountForm(p => ({ ...p, account_id: v }))}
                          options={accounts.map(a => ({ id: a.id, label: `${a.code} — ${a.name}` }))}
                          placeholder="Digite o número ou o nome da conta..."
                        />
                      </div>
                      {acc && <p className="text-[11px] text-emerald-700 mt-1">Lançamento: {d > 0 ? `D ${prod?.account_estoque_name || "estoque"} × C ${acc.name}` : `D ${acc.name} × C ${prod?.account_estoque_name || "estoque"}`}</p>}
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className="p-4 border-t flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setCounting(null)}>Cancelar</Button>
              <Button size="sm" disabled={saving} onClick={saveCount} className="bg-emerald-600 hover:bg-emerald-700">{saving ? "Salvando..." : "Registrar Contagem"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InventoryForm({ user, products, warehouses, locations, groups, subgroups, onClose, onSaved }) {
  const [form, setForm] = useState({
    inventory_type: "fisico", group_id: "", subgroup_id: "", product_id: "", warehouse_id: "", location_id: "", count_date: todayISO(), notes: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => {
    const next = { ...prev, [k]: v };
    if (k === "warehouse_id") { next.location_id = ""; }
    if (k === "group_id") { next.subgroup_id = ""; next.product_id = ""; }
    if (k === "subgroup_id") { next.product_id = ""; }
    return next;
  });

  // Produtos do filtro: grupo (via subgrupo vinculado) ou subgrupo — apenas produtos com controle de estoque ativos
  const filteredSubgroups = subgroups.filter(s => !form.group_id || s.group_id === form.group_id);
  const listProducts = products.filter(p =>
    p.controla_estoque !== false && p.is_active !== false &&
    (!form.subgroup_id || p.subgroup_id === form.subgroup_id) &&
    (!form.group_id || filteredSubgroups.some(s => s.id === p.subgroup_id))
  );
  const selectedProduct = products.find(p => p.id === form.product_id);
  const whLocations = locations.filter(l => l.warehouse_id === form.warehouse_id);

  // Abre a contagem para todos os produtos do filtro de uma só vez
  const openAll = async () => {
    if (!form.warehouse_id) return alert("Selecione o armazém para abrir as contagens.");
    if (listProducts.length === 0) return alert("Nenhum produto no filtro selecionado.");
    if (!confirm(`Iniciar inventário abrindo contagem para ${listProducts.length} produto(s) do filtro?`)) return;
    setSaving(true);
    try {
      const loc = locations.find(l => l.id === form.location_id);
      const wh = warehouses.find(w => w.id === form.warehouse_id);
      await base44.entities.ErpWmsInventory.bulkCreate(listProducts.map(p => ({
        user_email: user.email,
        inventory_type: form.inventory_type,
        product_id: p.id,
        product_code: p.code || "",
        product_name: p.name || "",
        unit: p.unit || "",
        warehouse_id: form.warehouse_id,
        warehouse_name: wh?.name || "",
        location_id: form.location_id || "",
        location_code: loc?.code || "",
        system_qty: Number(p.stock) || 0,
        count_date: form.count_date,
        notes: form.notes || "",
        status: "aberto",
      })));
      onSaved();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const save = async () => {
    if (!form.product_id) return alert("Selecione o produto.");
    if (!form.warehouse_id) return alert("Selecione o armazém.");
    setSaving(true);
    try {
      const loc = locations.find(l => l.id === form.location_id);
      const wh = warehouses.find(w => w.id === form.warehouse_id);
      await base44.entities.ErpWmsInventory.create({
        user_email: user.email,
        ...form,
        product_code: selectedProduct?.code || "",
        product_name: selectedProduct?.name || "",
        unit: selectedProduct?.unit || "",
        warehouse_name: wh?.name || "",
        location_code: loc?.code || "",
        system_qty: Number(selectedProduct?.stock) || 0,
      });
      onSaved();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="font-bold">Nova Contagem de Inventário</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-500">✕</button>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="text-xs font-medium text-gray-600">Tipo de Inventário</Label>
            <select value={form.inventory_type} onChange={e => set("inventory_type", e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1">
              {INV_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-600">Grupo de Estoque</Label>
            <select value={form.group_id} onChange={e => set("group_id", e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1">
              <option value="">Todos os grupos</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.code ? g.code + " — " : ""}{g.name}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-600">Subgrupo de Estoque</Label>
            <select value={form.subgroup_id} onChange={e => set("subgroup_id", e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1" disabled={subgroups.length === 0}>
              <option value="">Todos os subgrupos</option>
              {filteredSubgroups.map(s => <option key={s.id} value={s.id}>{s.code ? s.code + " — " : ""}{s.name}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <Label className="text-xs font-medium text-gray-600">Produto * {listProducts.length > 0 && <span className="font-normal text-gray-400">({listProducts.length} no filtro)</span>}</Label>
            <select value={form.product_id} onChange={e => set("product_id", e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1">
              <option value="">Selecione...</option>
              {listProducts.map(p => <option key={p.id} value={p.id}>{p.code ? p.code + " — " : ""}{p.name} (saldo: {Number(p.stock || 0).toLocaleString("pt-BR")})</option>)}
            </select>
          </div>
          {(form.group_id || form.subgroup_id) && (
            <div className="col-span-2 border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600">Produtos do filtro ({listProducts.length})</div>
              <div className="max-h-40 overflow-y-auto">
                {listProducts.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-gray-400">Nenhum produto encontrado no grupo/subgrupo selecionado.</p>
                ) : (
                  <table className="w-full text-xs">
                    <tbody>
                      {listProducts.map(p => (
                        <tr key={p.id} className="border-t">
                          <td className="px-3 py-1 font-mono">{p.code || ""}</td>
                          <td className="px-3 py-1">{p.name}</td>
                          <td className="px-3 py-1 text-right whitespace-nowrap">{Number(p.stock || 0).toLocaleString("pt-BR")} {p.unit || ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
          <div>
            <Label className="text-xs font-medium text-gray-600">Armazém *</Label>
            <select value={form.warehouse_id} onChange={e => set("warehouse_id", e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1">
              <option value="">Selecione...</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.code ? w.code + " — " : ""}{w.name}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-600">Endereço</Label>
            <select value={form.location_id} onChange={e => set("location_id", e.target.value)} className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm mt-1">
              <option value="">Selecione...</option>
              {whLocations.map(l => <option key={l.id} value={l.id}>{l.code}{l.zone ? " — " + l.zone : ""}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-600">Data da Contagem</Label>
            <Input type="date" value={form.count_date} onChange={e => set("count_date", e.target.value)} className="mt-1" />
          </div>
          <div className="col-span-2">
            <Label className="text-xs font-medium text-gray-600">Observações</Label>
            <Input value={form.notes} onChange={e => set("notes", e.target.value)} className="mt-1" />
          </div>
          {selectedProduct && (
            <p className="col-span-2 text-xs text-gray-500">Saldo atual em sistema: <b>{Number(selectedProduct.stock || 0).toLocaleString("pt-BR")} {selectedProduct.unit || ""}</b> (capturado na abertura da contagem)</p>
          )}
        </div>
        <p className="px-4 pb-2 text-[11px] text-gray-500">Após abrir a contagem, os produtos aparecem na listagem de inventário (abaixo) — clique na linha ou no botão <b>Contar</b> para digitar a quantidade física contada.</p>
        <div className="p-4 border-t flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          {listProducts.length > 0 && (
            <Button variant="secondary" size="sm" disabled={saving} onClick={openAll} title="Abre contagem para todos os produtos do filtro do grupo/subgrupo">Iniciar Inventário — Todos ({listProducts.length})</Button>
          )}
          <Button size="sm" disabled={saving} onClick={save} className="bg-emerald-600 hover:bg-emerald-700">{saving ? "Salvando..." : "Abrir Contagem"}</Button>
        </div>
      </div>
    </div>
  );
}