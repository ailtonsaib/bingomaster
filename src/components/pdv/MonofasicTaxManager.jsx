import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, Plus, X, Loader2, Scale, Search, Info, Database } from "lucide-react";

const EMPTY = {
  ncm: "", description: "",
  product_category: "outro",
  tax_regime: "monofasico",
  legal_law: "Lei 13.097/2015",
  pis_rate: 0, cofins_rate: 0, ipi_rate: 0,
  effective_pis_rate: 0, effective_cofins_rate: 0, effective_ipi_rate: 0,
  cst_pis: "04", cst_cofins: "04", cst_ipi: "99",
  pis_rate_distributor: 0, cofins_rate_distributor: 0,
  cst_pis_distributor: "02", cst_cofins_distributor: "02",
  legal_basis: "Lei 13.097/2015",
  is_active: true,
};

const CST_PIS_OPTIONS = ["01","02","04","05","06","07","08","09","49","98","99"];
const CST_IPI_OPTIONS = ["00","01","02","03","04","05","49","50","51","52","53","54","55","99"];
const PRODUCT_CATEGORIES = [
  { value: "combustivel", label: "Combustível", law: "Lei 9.718/1998 + LC 192/2020", cst: "07", regime: "monofasico" },
  { value: "bebida_fria", label: "Bebida Fria", law: "Lei 13.097/2015 art. 14", cst: "04", regime: "bifasico" },
  { value: "medicamento", label: "Medicamento", law: "Lei 10.147/2000", cst: "04", regime: "monofasico" },
  { value: "cosmetico", label: "Cosmético/Perfumaria", law: "Lei 10.147/2000", cst: "04", regime: "monofasico" },
  { value: "autopeca", label: "Autopeça/Pneu", law: "Lei 10.485/2002", cst: "04", regime: "monofasico" },
  { value: "cigarro", label: "Cigarro/Fumo", law: "Lei 10.865/2004", cst: "04", regime: "monofasico" },
  { value: "outro", label: "Outro", law: "Lei 13.097/2015", cst: "04", regime: "monofasico" },
];

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

  const onCategoryChange = (cat) => {
    const preset = PRODUCT_CATEGORIES.find(c => c.value === cat);
    if (preset) {
      setForm(prev => ({
        ...prev,
        product_category: cat,
        legal_law: preset.law,
        cst_pis: preset.cst,
        cst_cofins: preset.cst,
        tax_regime: preset.regime,
      }));
    }
  };

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

  const COMMON_NCMS = [
    // Combustíveis — CST 07 (monofásica combustíveis, alíquota zero na revenda)
    { ncm: "27101210", description: "Gasolina automotiva", product_category: "combustivel", tax_regime: "monofasico", legal_law: "Lei 9.718/1998 + LC 192/2020", cst_pis: "07", cst_cofins: "07", pis_rate: 4.13, cofins_rate: 18.96, effective_pis_rate: 0, effective_cofins_rate: 0 },
    { ncm: "27101250", description: "Óleo diesel", product_category: "combustivel", tax_regime: "monofasico", legal_law: "Lei 9.718/1998 + LC 192/2020", cst_pis: "07", cst_cofins: "07", pis_rate: 2.05, cofins_rate: 9.44, effective_pis_rate: 0, effective_cofins_rate: 0 },
    { ncm: "27111241", description: "GLP - Gás Liquefeito de Petróleo", product_category: "combustivel", tax_regime: "monofasico", legal_law: "Lei 9.718/1998 + LC 192/2020", cst_pis: "07", cst_cofins: "07", pis_rate: 2.05, cofins_rate: 9.44, effective_pis_rate: 0, effective_cofins_rate: 0 },
    { ncm: "27101230", description: "Querosene iluminante", product_category: "combustivel", tax_regime: "monofasico", legal_law: "Lei 9.718/1998", cst_pis: "07", cst_cofins: "07", pis_rate: 1.44, cofins_rate: 6.61, effective_pis_rate: 0, effective_cofins_rate: 0 },
    { ncm: "38260000", description: "Biodiesel", product_category: "combustivel", tax_regime: "monofasico", legal_law: "Lei 9.718/1998", cst_pis: "07", cst_cofins: "07", pis_rate: 2.05, cofins_rate: 9.44, effective_pis_rate: 0, effective_cofins_rate: 0 },
    // Bebidas Frias — Bifásico (Lei 13.097/2015 art. 14) — CST 04 na revenda, CST 02 para distribuidor
    { ncm: "22021000", description: "Refrigerantes", product_category: "bebida_fria", tax_regime: "bifasico", legal_law: "Lei 13.097/2015 art. 14", cst_pis: "04", cst_cofins: "04", pis_rate: 4.13, cofins_rate: 18.96, effective_pis_rate: 0, effective_cofins_rate: 0, pis_rate_distributor: 1.86, cofins_rate_distributor: 8.54, cst_pis_distributor: "02", cst_cofins_distributor: "02" },
    { ncm: "22030000", description: "Cervejas", product_category: "bebida_fria", tax_regime: "bifasico", legal_law: "Lei 13.097/2015 art. 14", cst_pis: "04", cst_cofins: "04", pis_rate: 4.13, cofins_rate: 18.96, effective_pis_rate: 0, effective_cofins_rate: 0, pis_rate_distributor: 1.86, cofins_rate_distributor: 8.54, cst_pis_distributor: "02", cst_cofins_distributor: "02" },
    { ncm: "22011000", description: "Águas minerais/naturais", product_category: "bebida_fria", tax_regime: "bifasico", legal_law: "Lei 13.097/2015 art. 14", cst_pis: "04", cst_cofins: "04", pis_rate: 4.13, cofins_rate: 18.96, effective_pis_rate: 0, effective_cofins_rate: 0, pis_rate_distributor: 1.86, cofins_rate_distributor: 8.54, cst_pis_distributor: "02", cst_cofins_distributor: "02" },
    { ncm: "22029000", description: "Outras bebidas não alcoólicas", product_category: "bebida_fria", tax_regime: "bifasico", legal_law: "Lei 13.097/2015 art. 14", cst_pis: "04", cst_cofins: "04", pis_rate: 4.13, cofins_rate: 18.96, effective_pis_rate: 0, effective_cofins_rate: 0, pis_rate_distributor: 1.86, cofins_rate_distributor: 8.54, cst_pis_distributor: "02", cst_cofins_distributor: "02" },
    // Medicamentos — CST 04 (Lei 10.147/2000)
    { ncm: "30049099", description: "Medicamentos de uso humano", product_category: "medicamento", tax_regime: "monofasico", legal_law: "Lei 10.147/2000", cst_pis: "04", cst_cofins: "04", pis_rate: 2.4, cofins_rate: 11.04, effective_pis_rate: 0, effective_cofins_rate: 0 },
    // Cosméticos/Perfumaria — CST 04 (Lei 10.147/2000)
    { ncm: "33030010", description: "Perfumes", product_category: "cosmetico", tax_regime: "monofasico", legal_law: "Lei 10.147/2000", cst_pis: "04", cst_cofins: "04", pis_rate: 2.4, cofins_rate: 11.04, effective_pis_rate: 0, effective_cofins_rate: 0 },
    { ncm: "33049990", description: "Cosméticos", product_category: "cosmetico", tax_regime: "monofasico", legal_law: "Lei 10.147/2000", cst_pis: "04", cst_cofins: "04", pis_rate: 2.4, cofins_rate: 11.04, effective_pis_rate: 0, effective_cofins_rate: 0 },
    // Autopeças/Pneus — CST 04 (Lei 10.485/2002)
    { ncm: "40111000", description: "Pneus novos de automóveis", product_category: "autopeca", tax_regime: "monofasico", legal_law: "Lei 10.485/2002", cst_pis: "04", cst_cofins: "04", pis_rate: 2.4, cofins_rate: 11.04, effective_pis_rate: 0, effective_cofins_rate: 0 },
    { ncm: "40112000", description: "Pneus para ônibus/caminhão", product_category: "autopeca", tax_regime: "monofasico", legal_law: "Lei 10.485/2002", cst_pis: "04", cst_cofins: "04", pis_rate: 2.4, cofins_rate: 11.04, effective_pis_rate: 0, effective_cofins_rate: 0 },
    // Cigarros — CST 04 (Lei 10.865/2004)
    { ncm: "24022020", description: "Cigarros contendo tabaco", product_category: "cigarro", tax_regime: "monofasico", legal_law: "Lei 10.865/2004", cst_pis: "04", cst_cofins: "04", pis_rate: 2.4, cofins_rate: 11.04, effective_pis_rate: 0, effective_cofins_rate: 0 },
  ];

  const seedCommon = async () => {
    if (!confirm(`Pré-cadastrar ${COMMON_NCMS.length} NCMs monofásicos?`)) return;
    setSaving(true);
    try {
      const existing = new Set(taxes.map(t => t.ncm));
      const toCreate = COMMON_NCMS.filter(n => !existing.has(n.ncm)).map(n => ({
        ...n, user_email: user.email, cst_ipi: "99", effective_ipi_rate: 0, ipi_rate: 0, is_active: true,
      }));
      if (toCreate.length === 0) { alert("Todos os NCMs já estão cadastrados!"); setSaving(false); return; }
      await base44.entities.PDVMonofasicTax.bulkCreate(toCreate);
      alert(`${toCreate.length} NCMs cadastrados!`);
      load();
    } catch (e) { alert("Erro: " + e.message); }
    setSaving(false);
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
          <Button onClick={seedCommon} variant="outline" className="h-9 gap-1.5">
            <Database className="w-4 h-4" /> Pré-cadastrar NCMs
          </Button>
          <Button onClick={openNew} className="h-9 gap-1.5 bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Novo
          </Button>
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex items-start gap-2">
        <Info className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-indigo-700 space-y-1">
          <p><b>Tributação Monofásica e Bifásica de PIS/COFINS — Lei 13.097/2015 e demais leis.</b></p>
          <p><b>Monofásico:</b> tributado uma vez (fabricante paga alíquota majorada, revenda a 0%). CST 04 na revenda. Aplica-se a medicamentos (Lei 10.147), cosméticos (Lei 10.147), autopeças (Lei 10.485), cigarros (Lei 10.865) e combustíveis (CST 07 — Lei 9.718).</p>
          <p><b>Bifásico:</b> tributado em duas etapas (fabricante + distribuidor), varejo a 0%. <b>Bebidas frias</b> (Lei 13.097 art. 14): venda a distribuidor usa alíquota reduzida (PIS 1,86% / COFINS 8,54%, CST 02); venda a consumidor/varejista usa 0% (CST 04).</p>
          <p>Marque o campo <b>"Monofásico (Lei 13.097)"</b> no cadastro do produto e informe o <b>Tipo de Comprador</b> no pedido de saída para aplicar automaticamente as regras corretas.</p>
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
                <th className="p-2 text-center font-medium">Categoria</th>
                <th className="p-2 text-center font-medium">Regime</th>
                <th className="p-2 text-center font-medium">CST PIS</th>
                <th className="p-2 text-center font-medium">CST COFINS</th>
                <th className="p-2 text-right font-medium">PIS Efet.%</th>
                <th className="p-2 text-right font-medium">COFINS Efet.%</th>
                <th className="p-2 text-center font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="border-b hover:bg-gray-50">
                  <td className="p-2 font-mono text-xs">{t.ncm}</td>
                  <td className="p-2 text-xs">{t.description || "—"}</td>
                  <td className="p-2 text-center text-xs">{PRODUCT_CATEGORIES.find(c => c.value === t.product_category)?.label || t.product_category || "—"}</td>
                  <td className="p-2 text-center">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${t.tax_regime === "bifasico" ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"}`}>
                      {t.tax_regime === "bifasico" ? "Bifásico" : "Monofásico"}
                    </span>
                  </td>
                  <td className="p-2 text-center text-xs font-medium text-indigo-600">{t.cst_pis}</td>
                  <td className="p-2 text-center text-xs font-medium text-indigo-600">{t.cst_cofins}</td>
                  <td className="p-2 text-right">{num(t.effective_pis_rate).toFixed(2)}</td>
                  <td className="p-2 text-right">{num(t.effective_cofins_rate).toFixed(2)}</td>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Categoria do Produto</Label>
                  <select value={form.product_category} onChange={e => onCategoryChange(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                    {PRODUCT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Regime</Label>
                  <select value={form.tax_regime} onChange={e => setForm({...form, tax_regime: e.target.value})} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                    <option value="monofasico">Monofásico (1 fase)</option>
                    <option value="bifasico">Bifásico (2 fases)</option>
                  </select>
                </div>
              </div>
              <div>
                <Label>Descrição</Label>
                <Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="h-9" placeholder="Óleo diesel, Gasolina, GLP, etc." />
              </div>
              <div>
                <Label>Lei Aplicável</Label>
                <Input value={form.legal_law} onChange={e => setForm({...form, legal_law: e.target.value})} className="h-9" />
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
                <h4 className="text-sm font-semibold mb-2 text-gray-700">CSTs aplicados na saída (revenda/varejo)</h4>
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

              {form.tax_regime === "bifasico" && (
                <div className="border-t pt-3 bg-amber-50 -mx-4 px-4 py-3 rounded-lg">
                  <h4 className="text-sm font-semibold mb-1 text-amber-800">⚠ Regra Bifásica — Venda a Distribuidor (Lei 13.097 art. 14)</h4>
                  <p className="text-xs text-amber-700 mb-2">Na venda a distribuidor/atacadista, aplicam-se alíquotas reduzidas (ex: bebidas frias PIS 1,86% / COFINS 8,54%). Venda a varejista/consumidor = 0%.</p>
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <Label>PIS Distrib. (%)</Label>
                      <Input type="number" step="0.01" value={form.pis_rate_distributor} onChange={e => setForm({...form, pis_rate_distributor: num(e.target.value)})} className="h-9" />
                    </div>
                    <div>
                      <Label>COFINS Distrib. (%)</Label>
                      <Input type="number" step="0.01" value={form.cofins_rate_distributor} onChange={e => setForm({...form, cofins_rate_distributor: num(e.target.value)})} className="h-9" />
                    </div>
                    <div>
                      <Label>CST PIS Distrib.</Label>
                      <select value={form.cst_pis_distributor} onChange={e => setForm({...form, cst_pis_distributor: e.target.value})} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                        {CST_PIS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label>CST COFINS Distrib.</Label>
                      <select value={form.cst_cofins_distributor} onChange={e => setForm({...form, cst_cofins_distributor: e.target.value})} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                        {CST_PIS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}
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