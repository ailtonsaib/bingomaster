import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, Plus, X, Loader2, Percent, Search, Info } from "lucide-react";

const EMPTY = {
  ncm: "", uf: "*", origin: 0, csosn: "102", cst_icms: "00",
  icms_rate: 17, mva_rate: 0, icms_st_rate: 0,
  cst_ipi: "99", ipi_rate: 0,
  cst_pis: "49", pis_rate: 0.65,
  cst_cofins: "49", cofins_rate: 3,
  description: "", is_active: true,
};

const UF_OPTIONS = ["*", "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

const CST_ICMS_OPTIONS = ["00","10","20","30","40","41","50","51","60","70","90"];
const CSOSN_OPTIONS = ["101","102","103","201","202","203","300","400","500","900"];
const CST_IPI_OPTIONS = ["00","01","02","03","04","05","49","50","51","52","53","54","55","99"];
const CST_PIS_OPTIONS = ["01","02","04","05","06","07","08","09","49","98","99"];

export default function TaxParameterManager({ user }) {
  const [params, setParams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await base44.entities.PDVTaxParameter.filter({ user_email: user.email });
      setParams(list);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user.email]);

  useEffect(() => { load(); }, [load]);

  const filtered = params.filter(p =>
    p.ncm?.includes(search) || p.uf?.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => { setForm(EMPTY); setEditing(null); setShowForm(true); };
  const openEdit = (p) => { setForm({ ...EMPTY, ...p }); setEditing(p); setShowForm(true); };

  const save = async () => {
    if (!form.ncm) { alert("Informe o NCM!"); return; }
    if (form.ncm.length !== 8) { alert("O NCM deve ter 8 dígitos!"); return; }
    setSaving(true);
    try {
      const data = { ...form, user_email: user.email };
      if (editing?.id) {
        await base44.entities.PDVTaxParameter.update(editing.id, data);
      } else {
        await base44.entities.PDVTaxParameter.create(data);
      }
      setShowForm(false);
      load();
    } catch (e) { alert("Erro ao salvar: " + e.message); }
    setSaving(false);
  };

  const remove = async (p) => {
    if (!confirm(`Excluir parâmetro tributário NCM ${p.ncm}/${p.uf}?`)) return;
    await base44.entities.PDVTaxParameter.delete(p.id);
    load();
  };

  const num = (v) => Number(v) || 0;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Percent className="w-5 h-5 text-orange-600" />
          <h2 className="text-lg font-bold">Parâmetros Tributários</h2>
          <span className="text-sm text-gray-500">({params.length})</span>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar NCM..." className="pl-9 h-9 w-48" />
          </div>
          <Button onClick={openNew} className="h-9 gap-1.5 bg-orange-600 hover:bg-orange-700">
            <Plus className="w-4 h-4" /> Novo
          </Button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-700">
          Cadastre as alíquotas por <b>NCM</b> e <b>UF do fornecedor</b>. Use <b>UF = *</b> para aplicar a todas as UFs.
          Estes parâmetros são usados no cálculo de impostos das notas de entrada.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-orange-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Percent className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>Nenhum parâmetro tributário cadastrado</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-2 text-left font-medium">NCM</th>
                <th className="p-2 text-center font-medium">UF</th>
                <th className="p-2 text-center font-medium">CSOSN</th>
                <th className="p-2 text-center font-medium">CST ICMS</th>
                <th className="p-2 text-right font-medium">ICMS%</th>
                <th className="p-2 text-right font-medium">IPI%</th>
                <th className="p-2 text-right font-medium">PIS%</th>
                <th className="p-2 text-right font-medium">COFINS%</th>
                <th className="p-2 text-center font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b hover:bg-gray-50">
                  <td className="p-2 font-mono text-xs">{p.ncm}</td>
                  <td className="p-2 text-center">{p.uf}</td>
                  <td className="p-2 text-center text-xs">{p.csosn || "—"}</td>
                  <td className="p-2 text-center text-xs">{p.cst_icms || "—"}</td>
                  <td className="p-2 text-right">{num(p.icms_rate).toFixed(2)}</td>
                  <td className="p-2 text-right">{num(p.ipi_rate).toFixed(2)}</td>
                  <td className="p-2 text-right">{num(p.pis_rate).toFixed(2)}</td>
                  <td className="p-2 text-right">{num(p.cofins_rate).toFixed(2)}</td>
                  <td className="p-2 text-center">
                    <div className="flex justify-center gap-1">
                      <button onClick={() => openEdit(p)} className="p-1 text-gray-400 hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => remove(p)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
              <h3 className="font-bold">{editing ? "Editar Parâmetro Tributário" : "Novo Parâmetro Tributário"}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <Label>NCM (8 dígitos) *</Label>
                  <Input value={form.ncm} onChange={e => setForm({...form, ncm: e.target.value.replace(/\D/g, '').slice(0,8)})} className="h-9 font-mono" placeholder="12345678" />
                </div>
                <div>
                  <Label>UF</Label>
                  <select value={form.uf} onChange={e => setForm({...form, uf: e.target.value})} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                    {UF_OPTIONS.map(uf => <option key={uf} value={uf}>{uf === "*" ? "Todas" : uf}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Origem</Label>
                  <select value={form.origin} onChange={e => setForm({...form, origin: Number(e.target.value)})} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                    <option value={0}>0 - Nacional</option>
                    <option value={1}>1 - Import. Direta</option>
                    <option value={2}>2 - Import. Mercado Interno</option>
                    <option value={3}>3 - Nacional (cont. import.)</option>
                    <option value={4}>4 - Nacional (prod. processo)</option>
                    <option value={5}>5 - Nacional (mat. import.)</option>
                    <option value={6}>6 - Import. Direta (sem sim.)</option>
                    <option value={7}>7 - Import. Mercado Interno (sem sim.)</option>
                    <option value={8}>8 - Nacional (cont. import. sem sim.)</option>
                  </select>
                </div>
              </div>

              <div className="border-t pt-3">
                <h4 className="text-sm font-semibold mb-2 text-gray-700">ICMS</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <Label>CSOSN</Label>
                    <select value={form.csosn} onChange={e => setForm({...form, csosn: e.target.value})} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                      {CSOSN_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>CST ICMS</Label>
                    <select value={form.cst_icms} onChange={e => setForm({...form, cst_icms: e.target.value})} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                      {CST_ICMS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Alíquota ICMS (%)</Label>
                    <Input type="number" step="0.01" value={form.icms_rate} onChange={e => setForm({...form, icms_rate: num(e.target.value)})} className="h-9" />
                  </div>
                  <div>
                    <Label>Alíquota ICMS-ST (%)</Label>
                    <Input type="number" step="0.01" value={form.icms_st_rate} onChange={e => setForm({...form, icms_st_rate: num(e.target.value)})} className="h-9" />
                  </div>
                  <div>
                    <Label>MVA (%)</Label>
                    <Input type="number" step="0.01" value={form.mva_rate} onChange={e => setForm({...form, mva_rate: num(e.target.value)})} className="h-9" />
                  </div>
                </div>
              </div>

              <div className="border-t pt-3">
                <h4 className="text-sm font-semibold mb-2 text-gray-700">IPI</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>CST IPI</Label>
                    <select value={form.cst_ipi} onChange={e => setForm({...form, cst_ipi: e.target.value})} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                      {CST_IPI_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Alíquota IPI (%)</Label>
                    <Input type="number" step="0.01" value={form.ipi_rate} onChange={e => setForm({...form, ipi_rate: num(e.target.value)})} className="h-9" />
                  </div>
                </div>
              </div>

              <div className="border-t pt-3">
                <h4 className="text-sm font-semibold mb-2 text-gray-700">PIS / COFINS</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <Label>CST PIS</Label>
                    <select value={form.cst_pis} onChange={e => setForm({...form, cst_pis: e.target.value})} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                      {CST_PIS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Alíquota PIS (%)</Label>
                    <Input type="number" step="0.01" value={form.pis_rate} onChange={e => setForm({...form, pis_rate: num(e.target.value)})} className="h-9" />
                  </div>
                  <div>
                    <Label>CST COFINS</Label>
                    <select value={form.cst_cofins} onChange={e => setForm({...form, cst_cofins: e.target.value})} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                      {CST_PIS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Alíquota COFINS (%)</Label>
                    <Input type="number" step="0.01" value={form.cofins_rate} onChange={e => setForm({...form, cofins_rate: num(e.target.value)})} className="h-9" />
                  </div>
                </div>
              </div>

              <div>
                <Label>Descrição</Label>
                <Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="h-9" placeholder="Ex: Comércio de alimentos - SC" />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t sticky bottom-0 bg-white">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving} className="bg-orange-600 hover:bg-orange-700 gap-1.5">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Salvar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}