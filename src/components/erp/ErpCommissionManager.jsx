import { useState } from "react";
import ErpCommissionRules from "./ErpCommissionRules";
import ErpCommissionCalc from "./ErpCommissionCalc";
import ErpCommissionPayments from "./ErpCommissionPayments";

const TABS = [
  { id: "regras", label: "Regras de Comissão" },
  { id: "apuracao", label: "Apuração" },
  { id: "pagamentos", label: "Pagamentos" },
];

// Comissão de Vendas — regras por faixas de atingimento da meta, apuração por período e pagamento
export default function ErpCommissionManager({ user }) {
  const [tab, setTab] = useState("regras");
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 border-b">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-sm font-medium border-b-2 -mb-px ${tab === t.id ? "border-emerald-600 text-emerald-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "regras" && <ErpCommissionRules user={user} />}
      {tab === "apuracao" && <ErpCommissionCalc user={user} onGenerated={() => { setRefreshKey(k => k + 1); setTab("pagamentos"); }} />}
      {tab === "pagamentos" && <ErpCommissionPayments user={user} refreshKey={refreshKey} />}
    </div>
  );
}