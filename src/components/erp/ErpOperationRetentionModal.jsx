import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { X, Plus, Trash2, Loader2, Landmark } from "lucide-react";
import ErpCombobox from "@/components/erp/ErpCombobox";

const TAX_TYPES = ["IRRF", "PIS", "COFINS", "CSLL", "INSS", "ISS"];

// Parametrização das retenções da operação: por imposto, o fornecedor destinatário
// (com código), a alíquota, o dia de vencimento, a conta contábil e o histórico
// padrão — usados na entrada da nota para abater o valor retido do fornecedor e
// gerar o financeiro (conta a pagar por imposto) e o lançamento contábil.
export default function ErpOperationRetentionModal({ user, params, onClose, onSave }) {
  const [rows, setRows] = useState(() => (params || []).map(p => ({ ...p })));
  const [partners, setPartners] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [histories, setHistories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.ErpPartner.filter({ user_email: user.email, is_active: true }, "name", 500),
      base44.entities.ErpChartAccount.filter({ user_email: user.email, accepts_entries: true, is_active: true }, "code", 500),
      base44.entities.ErpStandardHistory.filter({ user_email: user.email, is_active: true }, "code", 500),
    ]).then(([ps, accs, hs]) => {
      setPartners(ps.filter(p => p.partner_type === "fornecedor" || p.partner_type === "ambos"));
      setAccounts(accs);
      setHistories(hs);
    }).catch(() => {});
    setLoading(false);
  }, [user.email]);

  const compareChartCode = (a, b) => String(a.code || "").localeCompare(String(b.code || ""), "pt-BR", { numeric: true });
  const accountOptions = useMemo(() => [...accounts].sort(compareChartCode).map(a => ({ id: a.id, label: `${a.code ? `${a.code} — ` : ""}${a.name}` })), [accounts]);
  const historyOptions = useMemo(() => histories.map(h => ({ id: h.id, label: `${h.code ? `${h.code} — ` : ""}${h.description}` })), [histories]);

  const addRow = () => setRows(prev => [...prev, { tax_type: "", rate: 0, supplier_id: "", supplier_code: "", supplier_name: "", due_day: 0, account_id: "", account_code: "", account_name: "", history_id: "", history_code: "", history_text: "" }]);
  const removeRow = (i) => setRows(prev => prev.filter((_, idx) => idx !== i));
  const update = (i, patch) => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  const setSupplier = (i, id) => {
    const p = partners.find(x => x.id === id);
    update(i, { supplier_id: id || "", supplier_name: p?.name || "" });
  };
  const setAccount = (i, id) => {
    const a = accounts.find(x => x.id === id);
    update(i, { account_id: id || "", account_code: a?.code || "", account_name: a?.name || "" });
  };
  const setHistory = (i, id) => {
    const h = histories.find(x => x.id === id);
    update(i, { history_id: id || "", history_code: h?.code || "", history_text: h?.description || "" });
  };

  const handleSave = () => {
    const filled = rows.filter(r => r.tax_type);
    const dup = filled.map(r => r.tax_type).filter((t, i, a) => a.indexOf(t) !== i);
    if (dup.length) { alert(`Imposto duplicado: ${[...new Set(dup)].join(", ")}.`); return; }
    for (const r of filled) {
      if (!r.supplier_name) { alert(`Informe o fornecedor destinatário da retenção de ${r.tax_type}.`); return; }
      if (!r.account_id) { alert(`Informe a conta contábil da retenção de ${r.tax_type}.`); return; }
      if (!(Number(r.due_day) > 0)) { alert(`Informe o dia de vencimento da retenção de ${r.tax_type}.`); return; }
    }
    onSave(filled.map(r => ({
      tax_type: r.tax_type,
      rate: Number(r.rate) || 0,
      supplier_id: r.supplier_id || "",
      supplier_code: r.supplier_code || "",
      supplier_name: r.supplier_name || "",
      due_day: Number(r.due_day) || 0,
      account_id: r.account_id,
      account_code: r.account_code || "",
      account_name: r.account_name || "",
      history_id: r.history_id || "",
      history_code: r.history_code || "",
      history_text: r.history_text || "",
    })));
  };

  const inputCls = "h-8 rounded border border-input px-2 text-xs w-full";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="font-bold flex items-center gap-2"><Landmark className="w-5 h-5 text-indigo-600" /> Retenções da Operação</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-500">Cada imposto retido gera, na entrada da nota, uma conta a pagar própria (com o vencimento no dia informado) e o crédito contábil na conta configurada — o valor retido é abatido do fornecedor da nota.</p>
          <p className="text-xs text-gray-500">O <b>Código</b> é o código de recolhimento do imposto retido junto ao órgão destinatário (ex.: DARF 0561 — IRRF, 2172 — PIS, 2172/2372 — COFINS, 2089 — CSLL). A conta contábil e o histórico podem ser buscados digitando o código ou a descrição.</p>

          {loading ? (
            <div className="p-6 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin inline" /></div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="p-2 text-left w-28">Imposto</th>
                      <th className="p-2 text-right w-20">Alíq. (%)</th>
                      <th className="p-2 text-left w-64">Fornecedor Destinatário</th>
                      <th className="p-2 text-left w-28">Código</th>
                      <th className="p-2 text-right w-20">Dia Venc.</th>
                      <th className="p-2 text-left w-72">Conta Contábil</th>
                      <th className="p-2 text-left w-56">Histórico Padrão</th>
                      <th className="p-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr><td colSpan={8} className="p-4 text-center text-gray-400">Nenhum imposto retido. Clique em "Imposto Retido".</td></tr>
                    ) : rows.map((r, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="p-2">
                          <select value={r.tax_type} onChange={e => update(i, { tax_type: e.target.value })} className={inputCls}>
                            <option value="">Selecione...</option>
                            {TAX_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>
                        <td className="p-2"><input type="number" step="0.01" value={r.rate} onChange={e => update(i, { rate: Number(e.target.value) || 0 })} className={`${inputCls} text-right`} /></td>
                        <td className="p-2">
                          <select value={r.supplier_id || ""} onChange={e => setSupplier(i, e.target.value)} className={inputCls}>
                            <option value="">Selecione...</option>
                            {partners.map(p => <option key={p.id} value={p.id}>{p.name}{p.document ? ` (${p.document})` : ""}</option>)}
                          </select>
                        </td>
                        <td className="p-2"><input value={r.supplier_code} onChange={e => update(i, { supplier_code: e.target.value })} placeholder="Ex: 0561" title="Código de recolhimento do imposto (ex.: DARF 0561 — IRRF)" className={inputCls} /></td>
                        <td className="p-2"><input type="number" min="1" max="31" value={r.due_day || ""} onChange={e => update(i, { due_day: Number(e.target.value) || 0 })} className={`${inputCls} text-right`} /></td>
                        <td className="p-2"><ErpCombobox value={r.account_id} options={accountOptions} onValueChange={(id) => setAccount(i, id)} placeholder="Selecione a conta..." clearable /></td>
                        <td className="p-2"><ErpCombobox value={r.history_id} options={historyOptions} onValueChange={(id) => setHistory(i, id)} placeholder="Selecione o histórico..." clearable /></td>
                        <td className="p-2 text-center"><button onClick={() => removeRow(i)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-2 border-t">
                <Button type="button" size="sm" variant="outline" onClick={addRow} className="gap-1"><Plus className="w-3.5 h-3.5" /> Imposto Retido</Button>
              </div>
            </div>
          )}
        </div>
        <div className="p-4 border-t flex gap-2 justify-end sticky bottom-0 bg-white">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave}>Salvar Retenções</Button>
        </div>
      </div>
    </div>
  );
}