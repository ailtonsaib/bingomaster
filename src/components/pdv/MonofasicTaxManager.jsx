import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, Plus, X, Loader2, Scale, Search, Info } from "lucide-react";

const EMPTY = {
  ncm: "", description: "",
  pis_rate: 0, cofins_rate: 0, ipi_rate: 0,
  effective_pis_rate: 0, effective_cofins_rate: 0, effective_ipi_rate: 0,
  cst_pis: "08", cst_cofins: "08", cst_ipi: "99",
  legal_basis: "Lei 13.097/2015",
  is_active: true,
};

const CST_PIS_OPTIONS = ["01","02","04","05","06","07","08","09","49","98","99"];
const CST_IPI_OPTIONS = ["00","01","02","03","04","05","49","50","51","52","53","54","55","99"];

export default function MonofasicTaxManager({ user }) {
  const [taxes, setTaxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await base44.entities.PDVMonofasicTax.filter({ user_email: user.email });
      setTaxes(list);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user.email]);

  useEffect(() => { load(); }, [load]);

  const filtered = taxes.filter(t =>
    t.ncm?.includes(search) || t.description?.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => { setForm(EMPTY); setEditing(null); setShowForm(true); };
  const openEdit = (t) => { setForm({ ...EMPTY, ...t }); setEditing(t); setShowForm(true); };

  const save = async () => {
    if (!form.ncm || form.ncm.length !== 8) { alert("NCM deve ter 8 dígitos!"); return; }
    setSaving(true);
    try {
      const data = { ...form, user_email: user.email };
      if (editing?.id) await base44.entities.PDVMonofasicTax.update(editing.id, data);
      else await base44.entities.PDVMonofasicTax.create(data);
      setShowForm(false);
      load();
    } catch (e) { alert("Erro ao salvar: " + e.message); }
    setSaving(false);
  };

  const remove = async (t) => {
    if (!confirm(`Excluir NCM monofásico ${t.ncm}?`)) return;
    await base44.entities.PDVMonofasicTax.delete(t.id);
    load();
  };

  const num = (v) => Number(v) || 0;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold">Impostos Monofásicos — Lei 13.097/2015</h2>
          <span className="text-sm text-gray-500">({taxes.length})</span>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar NCM..." className="pl-9 h-9 w-48" />
          </div>
          <Button onClick={openNew} className="h-9 gap-1.5 bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Novo
          </Button>
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex items-start gap-2">
        <Info className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-indigo-700 space-y-1">
          <p><b>Lei 13.097/2015 — Tributação Monofásica de PIS/COFINS e IPI.</b></p>
          <p>Produtos sujeitos a este regime têm o PIS e COFINS cobrados uma única vez (na fabricação/importação).
          Nas operações de saída posteriores, aplica-se <b>CST 08</b> (sem incidência) para PIS/COFINS.</p>
          <p>Marque o campo <b>"Monofásico (Lei 13.097)"</b> no cadastro do produto para aplicar automaticamente estes parâmetros nas saídas.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Scale className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>Nenhum NCM monofásico cadastrado</p>
          <p className="text-xs mt-1">Cadastre os NCMs sujeitos à Lei 13.097/2015</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-2 text-left font-medium">NCM</th>
                <th className="p-2 text-left font-medium">Descrição</th>
                <th className="p-2 text-center font-medium">CST PIS</th>
                <th className="p-2 text-center font-medium">CST COFINS</th>
                <th className="p-2 text-center font-medium">CST IPI</th>
                <th className="p-2 text-right font-medium">PIS Efet.%</th>
                <th className="p-2 text-right font-medium">COFINS Efet.%</th>
                <th className="p-2 text-right font-medium">IPI Efet.%</th>
                <th className="p-2 text-center font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="border-b hover:bg-gray-50">
                  <td className="p-2 font-mono text-xs">{t.ncm}</td>
                  <td className="p-2 text-xs">{t.description || "—"}</td>
                  <td className="p-2 text-center text-xs font-medium text-indigo-600">{t.cst_pis}</td>
                  <td className="p-2 text-center text-xs font-medium text-indigo-600">{t.cst_cofins}</td>
                  <td className="p-2 text-center text-xs">{t.cst_ipi || "—"}</td>
                  <td className="p-2 text-right">{num(t.effective_pis_rate).toFixed(2)}</td>
                  <td className="p-2 text-right">{num(t.effective_cofins_rate).toFixed(2)}</td>
                  <td className="p-2 text-right">{num(t.effective_ipi_rate).toFixed(2)}</td>
                  <td className="p-2 text-center">
                    <div className="flex justify-center gap-1">
                      <button onClick={() => openEdit(t)} className="p-1 text-gray-400 hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => remove(t)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
              <h3 className="font-bold">{editing ? "Editar NCM Monofásico" : "Novo NCM Monofásico"}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>NCM (8 dígitos) *</Label>
                  <Input value={form.ncm} onChange={e => setForm({...form, ncm: e.target.value.replace(/\D/g, '').slice(0,8)})} className="h-9 font-mono" placeholder="27101250" />
                </div>
                <div>
                  <Label>Fundamento Legal</Label>
                  <Input value={form.legal_basis} onChange={e => setForm({...form, legal_basis: e.target.value})} className="h-9" placeholder="Lei 13.097/2015" />
                </div>
              </div>
              <div>
                <Label>Descrição</Label>
                <Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="h-9" placeholder="Óleo diesel, Gasolina, GLP, etc." />
              </div>

              <div className="border-t pt-3">
                <h4 className="text-sm font-semibold mb-2 text-gray-700">Alíquotas Originais (fabricante/importador — informativo)</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>PIS (%)</Label>
                    <Input type="number" step="0.01" value={form.pis_rate} onChange={e => setForm({...form, pis_rate: num(e.target.value)})} className="h-9" />
                  </div>
                  <div>
                    <Label>COFINS (%)</Label>
                    <Input type="number" step="0.01" value={form.cofins_rate} onChange={e => setForm({...form, cofins_rate: num(e.target.value)})} className="h-9" />
                  </div>
                  <div>
                    <Label>IPI (%)</Label>
                    <Input type="number" step="0.01" value={form.ipi_rate} onChange={e => setForm({...form, ipi_rate: num(e.target.value)})} className="h-9" />
                  </div>
                </div>
              </div>

              <div className="border-t pt-3">
                <h4 className="text-sm font-semibold mb-2 text-gray-700">Alíquotas Efetivas na Saída</h4>
                <p className="text-xs text-gray-500 mb-2">Valores aplicados no cálculo de PIS/COFINS/IPI nas saídas. Para monofásicos, geralmente 0%.</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>PIS Efetivo (%)</Label>
                    <Input type="number" step="0.01" value={form.effective_pis_rate} onChange={e => setForm({...form, effective_pis_rate: num(e.target.value)})} className="h-9" />
                  </div>
                  <div>
                    <Label>COFINS Efetivo (%)</Label>
                    <Input type="number" step="0.01" value={form.effective_cofins_rate} onChange={e => setForm({...form, effective_cofins_rate: num(e.target.value)})} className="h-9" />
                  </div>
                  <div>
                    <Label>IPI Efetivo (%)</Label>
                    <Input type="number" step="0.01" value={form.effective_ipi_rate} onChange={e => setForm({...form, effective_ipi_rate: num(e.target.value)})} className="h-9" />
                  </div>
                </div>
              </div>

              <div className="border-t pt-3">
                <h4 className="text-sm font-semibold mb-2 text-gray-700">CSTs aplicados na saída</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>CST PIS</Label>
                    <select value={form.cst_pis} onChange={e => setForm({...form, cst_pis: e.target.value})} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                      {CST_PIS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>CST COFINS</Label>
                    <select value={form.cst_cofins} onChange={e => setForm({...form, cst_cofins: e.target.value})} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                      {CST_PIS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>CST IPI</Label>
                    <select value={form.cst_ipi} onChange={e => setForm({...form, cst_ipi: e.target.value})} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                      {CST_IPI_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t sticky bottom-0 bg-white">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 gap-1.5">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Salvar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}