import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, Info } from "lucide-react";
import ErpCombobox from "@/components/erp/ErpCombobox";

// Estrutura fixa do lançamento da entrada fiscal (uma linha por conta parametrizada).
// O valor de cada linha é calculado no lançamento: fornecedores = total da nota (C),
// impostos a recuperar = valores acreditados (D), e o valor líquido sempre vai ao
// débito das contas do rateio da própria entrada.
const ROWS = [
  { key: "fornecedores", type: "C", label: "FORNECEDORES", required: true, hint: "Crédito pelo total da nota" },
  { key: "icms", type: "D", label: "ICMS A RECUP", required: true, hint: "Débito pelo ICMS a creditar" },
  { key: "pis", type: "D", label: "PIS A RECUP", required: true, hint: "Débito pelo PIS a creditar" },
  { key: "cofins", type: "D", label: "COFINS A RECUP", required: true, hint: "Débito pelo COFINS a creditar" },
  { key: "ipi", type: "D", label: "IPI A RECUP", required: false, hint: "Débito pelo IPI a creditar (opcional)" },
  { key: "icms_frete", type: "D", label: "ICMS FRETE", required: false, hint: "Débito pelo ICMS do frete a creditar (opcional)" },
  { key: "pis_frete", type: "D", label: "PIS S/ FRETE", required: false, hint: "Débito pelo PIS do frete a creditar (opcional)" },
  { key: "cofins_frete", type: "D", label: "COFINS S/ FRETE", required: false, hint: "Débito pelo COFINS do frete a creditar (opcional)" },
  { key: "dif_aliquota", type: "C", label: "DIF. ALIQUOTA", required: false, hint: "Crédito pela diferença de alíquota a recolher (opcional)" },
  { key: "frete", type: "C", label: "FORN. FRET", required: false, hint: "Crédito pelo frete do fornecedor (opcional)" },
  { key: "despesas", type: "D", label: "DESPESAS", required: false, hint: "Débito pelas despesas acessórias da nota — saem do rateio (opcional)" },
  { key: "descontos", type: "C", label: "DESCONTOS", required: false, hint: "Crédito pelos descontos obtidos — custo gravado bruto (opcional)" },
  { key: "ciap_curto_prazo", type: "D", label: "CIAP CURTO PRAZO", required: false, hint: "Débito pelo ICMS do ativo imobilizado — CIAP curto prazo (opcional)" },
  { key: "ciap_longo_prazo", type: "D", label: "CIAP LONGO PRAZO", required: false, hint: "Débito pelo ICMS do ativo imobilizado — CIAP longo prazo (opcional)" },
];

// Parametrização contábil das operações de entrada: define as contas contábeis
// que serão usadas no lançamento da NF de entrada, respeitando as regras
// fiscais da operação (impostos calculados e creditados nas contas abaixo).
export default function ErpOperationAccountingManager({ user }) {
  const [operations, setOperations] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [histories, setHistories] = useState([]);
  const [params, setParams] = useState([]);
  const [opSel, setOpSel] = useState("");
  const [lines, setLines] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.entities.ErpOperation.filter({ user_email: user.email, type: "entrada", is_active: true }, "name", 500),
      base44.entities.ErpChartAccount.filter({ user_email: user.email, accepts_entries: true, is_active: true }, "code", 500),
      base44.entities.ErpStandardHistory.filter({ user_email: user.email, is_active: true }, "code", 500),
      base44.entities.ErpOperationAccounting.filter({ user_email: user.email }, "-created_date", 500),
    ]).then(([ops, accs, hist, prs]) => {
      setOperations(ops); setAccounts(accs); setHistories(hist); setParams(prs);
    }).catch(() => {});
    setLoading(false);
  }, [user.email]);

  const current = params.find(p => p.operation_id === opSel);

  // Ao selecionar a operação, carrega as contas já parametrizadas
  const selectOp = (id) => {
    setOpSel(id);
    const st = {};
    const p = params.find(x => x.operation_id === id);
    (p?.lines || []).forEach(l => { st[l.key] = l; });
    setLines(st);
  };

  const setAccount = (key, accId) => {
    const acc = accounts.find(a => a.id === accId);
    setLines(prev => ({ ...prev, [key]: { ...(prev[key] || {}), key, account_id: acc?.id || "", account_code: acc?.code || "", account_name: acc?.name || "" } }));
  };

  const setHistory = (key, hId) => {
    const h = histories.find(x => x.id === hId);
    setLines(prev => ({ ...prev, [key]: { ...(prev[key] || {}), key, history_id: h?.id || "", history_code: h?.code || "", history_text: h?.description || "" } }));
  };

  const handleSave = async () => {
    for (const r of ROWS.filter(r => r.required)) {
      if (!lines[r.key]?.account_id) { alert(`Informe a conta contábil de ${r.label}.`); return; }
    }
    setSaving(true);
    const payload = {
      user_email: user.email,
      operation_id: opSel,
      operation_name: operations.find(o => o.id === opSel)?.name || "",
      lines: ROWS.filter(r => lines[r.key]?.account_id).map(r => ({
        key: r.key, type: r.type, label: r.label,
        account_id: lines[r.key].account_id || "",
        account_code: lines[r.key].account_code || "",
        account_name: lines[r.key].account_name || "",
        history_id: lines[r.key].history_id || "",
        history_code: lines[r.key].history_code || "",
        history_text: lines[r.key].history_text || "",
      })),
    };
    try {
      if (current) {
        const upd = await base44.entities.ErpOperationAccounting.update(current.id, payload);
        setParams(prev => prev.map(p => p.id === current.id ? upd : p));
      } else {
        const created = await base44.entities.ErpOperationAccounting.create(payload);
        setParams(prev => [...prev, created]);
      }
      alert("Parametrização contábil salva.");
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const compareChartCode = (a, b) => String(a.code || "").localeCompare(String(b.code || ""), "pt-BR", { numeric: true });
  const accountOptions = useMemo(() => [...accounts].sort(compareChartCode).map(a => ({ id: a.id, label: `${a.code ? `${a.code} — ` : ""}${a.name}` })), [accounts]);

  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-base flex items-center gap-2"><BookOpen className="w-4 h-4 text-indigo-600" /> Contabilização da NF de Entrada por Operação</h2>
      <p className="text-xs text-gray-500">Define as contas contábeis do lançamento gerado no cadastro da NF de entrada. Os valores dos impostos são jogados nas contas abaixo conforme as regras fiscais da operação. O valor líquido vai ao débito da conta de estoque do produto (entrada de estoque) e o restante, quando houver, ao rateio da entrada.</p>

      <div className="flex items-center gap-2 flex-wrap">
        <select value={opSel} onChange={e => selectOp(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm min-w-[280px]">
          <option value="">Selecione a operação de entrada...</option>
          {operations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="p-6 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin inline" /></div>
      ) : !opSel ? (
        <div className="bg-white rounded-xl border p-8 text-center text-sm text-gray-400">Selecione uma operação de entrada para parametrizar as contas contábeis.</div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-gray-500 text-xs">
                <tr>
                  <th className="p-2 text-left w-14">Tipo</th>
                  <th className="p-2 text-left">Descrição</th>
                  <th className="p-2 text-left">Conta Contábil</th>
                  <th className="p-2 text-left w-52">Histórico Padrão</th>
                  <th className="p-2 text-left w-56">Valor no Lançamento</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map(r => (
                  <tr key={r.key} className="border-t hover:bg-gray-50">
                    <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full font-bold ${r.type === "D" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>{r.type}</span></td>
                    <td className="p-2">
                      <span className="font-medium">{r.label}</span>
                      {!r.required && <span className="text-[10px] text-gray-400 block">opcional</span>}
                    </td>
                    <td className="p-2">
                      <ErpCombobox
                        value={lines[r.key]?.account_id || ""}
                        onValueChange={(id) => setAccount(r.key, id)}
                        options={accountOptions}
                        placeholder="Digite o código ou a descrição da conta..."
                        clearable
                      />
                    </td>
                    <td className="p-2">
                      <select value={lines[r.key]?.history_id || ""} onChange={e => setHistory(r.key, e.target.value)} className="w-full h-8 rounded-md border border-input bg-transparent px-2 text-xs">
                        <option value="">Sem histórico padrão</option>
                        {histories.map(h => <option key={h.id} value={h.id}>{h.code ? `${h.code} — ` : ""}{h.description}</option>)}
                      </select>
                    </td>
                    <td className="p-2 text-xs text-gray-500">{r.hint}</td>
                  </tr>
                ))}
                <tr className="border-t bg-gray-50">
                  <td className="p-2"><span className="text-xs px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-700">D</span></td>
                  <td className="p-2 font-medium">CONTA DO RATEIO</td>
                  <td className="p-2 text-xs text-gray-500" colSpan={2}><span className="flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> Sempre serão as contas do rateio da própria entrada (setor/conta)</span></td>
                  <td className="p-2 text-xs text-gray-500">Valor líquido (total − impostos a creditar)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t flex justify-end">
            <Button size="sm" onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Salvar Parametrização
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}