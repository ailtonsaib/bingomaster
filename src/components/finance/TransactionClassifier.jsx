import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { TrendingUp, TrendingDown, Building2, Landmark, CheckCircle2, Loader2 } from "lucide-react";

export default function TransactionClassifier({ userEmail, onClassified }) {
  const [transactions, setTransactions] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [bulkCostCenter, setBulkCostCenter] = useState("");
  const [bulkBankAccount, setBulkBankAccount] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("unclassified");

  const loadData = useCallback(async () => {
    if (!userEmail) return;
    setLoading(true);
    try {
      const [txRes, ccRes, baRes] = await Promise.all([
        base44.functions.invoke('portalAuth', { operation: 'getTransactions', email: userEmail }),
        base44.functions.invoke('portalAuth', { operation: 'getCostCenters', email: userEmail }),
        base44.functions.invoke('portalAuth', { operation: 'getBankAccounts', email: userEmail }),
      ]);
      setTransactions(txRes.data.transactions || []);
      setCostCenters(ccRes.data.costCenters || []);
      setBankAccounts(baRes.data.bankAccounts || []);
    } catch (e) {
      console.error("Erro ao carregar dados:", e);
    }
    setLoading(false);
  }, [userEmail]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const isUnclassified = (tx) => !tx.cost_center_id && !tx.bank_account_id;
  const isMissingCostCenter = (tx) => !tx.cost_center_id;
  const isMissingBank = (tx) => !tx.bank_account_id;

  const filtered = transactions.filter((tx) => {
    if (filter === "unclassified") return isUnclassified(tx);
    if (filter === "no_cost_center") return isMissingCostCenter(tx);
    if (filter === "no_bank") return isMissingBank(tx);
    return true;
  });

  const unclassifiedCount = transactions.filter(isUnclassified).length;
  const noCostCenterCount = transactions.filter(isMissingCostCenter).length;
  const noBankCount = transactions.filter(isMissingBank).length;

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((t) => t.id)));
    }
  };

  const handleBulkClassify = async () => {
    if (selected.size === 0) return;
    if (!bulkCostCenter && !bulkBankAccount) {
      alert("Selecione ao menos um centro de custo ou conta bancária.");
      return;
    }
    setSaving(true);
    try {
      const cc = costCenters.find((c) => c.id === bulkCostCenter);
      const ba = bankAccounts.find((b) => b.id === bulkBankAccount);
      await base44.functions.invoke('portalAuth', {
        operation: 'bulkClassifyTransactions',
        email: userEmail,
        transaction_ids: Array.from(selected),
        cost_center_id: bulkCostCenter || undefined,
        cost_center_name: cc?.name || undefined,
        bank_account_id: bulkBankAccount || undefined,
        bank_name: ba?.bank_name || undefined,
      });
      setSelected(new Set());
      setBulkCostCenter("");
      setBulkBankAccount("");
      await loadData();
      if (onClassified) onClassified();
    } catch (e) {
      alert("Erro ao classificar movimentações");
    }
    setSaving(false);
  };

  const handleSingleClassify = async (txId, field, value, name) => {
    try {
      const payload = { operation: 'classifyTransaction', email: userEmail, transaction_id: txId };
      if (field === 'cost_center') {
        payload.cost_center_id = value || undefined;
        payload.cost_center_name = name || undefined;
      } else {
        payload.bank_account_id = value || undefined;
        payload.bank_name = name || undefined;
      }
      await base44.functions.invoke('portalAuth', payload);
      await loadData();
      if (onClassified) onClassified();
    } catch (e) {
      alert("Erro ao classificar movimentação");
    }
  };

  const fmtCurrency = (v) => `R$ ${parseFloat(v || 0).toFixed(2)}`;
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Building2 className="w-5 h-5 mx-auto mb-1 text-amber-500" />
            <p className="text-2xl font-bold">{noCostCenterCount}</p>
            <p className="text-xs text-muted-foreground">Sem Centro de Custo</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Landmark className="w-5 h-5 mx-auto mb-1 text-blue-500" />
            <p className="text-2xl font-bold">{noBankCount}</p>
            <p className="text-xs text-muted-foreground">Sem Conta Bancária</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-emerald-500" />
            <p className="text-2xl font-bold">{unclassifiedCount}</p>
            <p className="text-xs text-muted-foreground">Total Não Classificado</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "unclassified", label: "Não classificadas" },
          { key: "no_cost_center", label: "Sem centro de custo" },
          { key: "no_bank", label: "Sem conta bancária" },
          { key: "all", label: "Todas" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => { setFilter(f.key); setSelected(new Set()); }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === f.key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Classificação em lote */}
      {selected.size > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">{selected.size} movimentação(ões) selecionada(s)</p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[180px]">
                <label className="text-xs text-muted-foreground mb-1 block">Centro de Custo</label>
                <select
                  value={bulkCostCenter}
                  onChange={(e) => setBulkCostCenter(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="">— Manter atual —</option>
                  {costCenters.map((cc) => (
                    <option key={cc.id} value={cc.id}>
                      {cc.level === 'departamento' ? '📁' : cc.level === 'setor' ? '📂' : '📄'} {cc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="text-xs text-muted-foreground mb-1 block">Conta Bancária</label>
                <select
                  value={bulkBankAccount}
                  onChange={(e) => setBulkBankAccount(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="">— Manter atual —</option>
                  {bankAccounts.map((ba) => (
                    <option key={ba.id} value={ba.id}>
                      {ba.bank_name} — Ag {ba.agency} / CC {ba.account_number}
                    </option>
                  ))}
                </select>
              </div>
              <Button onClick={handleBulkClassify} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Classificar Selecionadas
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de transações */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Classificar Movimentações</CardTitle>
            {filtered.length > 0 && (
              <Button variant="ghost" size="sm" onClick={selectAll}>
                {selected.size === filtered.length ? "Desmarcar todas" : "Selecionar todas"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-10">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500" />
              <p className="text-sm text-muted-foreground">
                {filter === "all" ? "Nenhuma movimentação encontrada." : "Todas as movimentações já estão classificadas!"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((tx) => (
                <div key={tx.id} className="border rounded-lg p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selected.has(tx.id)}
                      onCheckedChange={() => toggleSelect(tx.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {tx.type === 'income' ? (
                          <TrendingUp className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-600" />
                        )}
                        <p className="text-sm font-medium truncate">{tx.description}</p>
                        <span className={`text-sm font-bold ${tx.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {tx.type === 'income' ? '+' : '-'} {fmtCurrency(tx.amount)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {tx.contact_name ? `${tx.contact_name} · ` : ''}
                        {tx.category ? `${tx.category} · ` : ''}
                        Venc: {fmtDate(tx.due_date || tx.launch_date || tx.date)}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {tx.cost_center_name ? (
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <Building2 className="w-3 h-3" /> {tx.cost_center_name}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-xs text-amber-600 border-amber-300">
                            <Building2 className="w-3 h-3" /> Sem centro de custo
                          </Badge>
                        )}
                        {tx.bank_name ? (
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <Landmark className="w-3 h-3" /> {tx.bank_name}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-xs text-blue-600 border-blue-300">
                            <Landmark className="w-3 h-3" /> Sem conta bancária
                          </Badge>
                        )}
                      </div>
                      {/* Seletores inline */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        <select
                          value={tx.cost_center_id || ""}
                          onChange={(e) => {
                            const cc = costCenters.find((c) => c.id === e.target.value);
                            handleSingleClassify(tx.id, 'cost_center', e.target.value, cc?.name);
                          }}
                          className="h-8 rounded-md border border-input bg-transparent px-2 text-xs flex-1 min-w-[140px]"
                        >
                          <option value="">📁 Centro de custo...</option>
                          {costCenters.map((cc) => (
                            <option key={cc.id} value={cc.id}>
                              {cc.level === 'departamento' ? '📁' : cc.level === 'setor' ? '📂' : '📄'} {cc.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={tx.bank_account_id || ""}
                          onChange={(e) => {
                            const ba = bankAccounts.find((b) => b.id === e.target.value);
                            handleSingleClassify(tx.id, 'bank_account', e.target.value, ba?.bank_name);
                          }}
                          className="h-8 rounded-md border border-input bg-transparent px-2 text-xs flex-1 min-w-[140px]"
                        >
                          <option value="">🏦 Conta bancária...</option>
                          {bankAccounts.map((ba) => (
                            <option key={ba.id} value={ba.id}>
                              {ba.bank_name} — Ag {ba.agency}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}