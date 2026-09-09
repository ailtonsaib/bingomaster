import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { fmtMoney } from "@/lib/erpUtils";
import { ScrollText, ArrowRightLeft } from "lucide-react";

export default function ErpFiscalPanel({ user }) {
  const [operations, setOperations] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [ops, r] = await Promise.all([
          base44.entities.ErpOperation.filter({ user_email: user.email }, "-created_date", 500),
          base44.entities.ErpTaxRule.filter({ user_email: user.email }, "-created_date", 500),
        ]);
        setOperations(ops); setRules(r);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [user.email]);

  const rulesForOp = (opId) => rules.filter(r => r.operation_id === opId);

  const entradas = operations.filter(o => o.type === "entrada");
  const saidas = operations.filter(o => o.type === "saida");

  const Row = ({ op }) => {
    const opRules = rulesForOp(op.id);
    return (
      <div className="border rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className={`text-xs px-2 py-0.5 rounded-full mr-2 ${op.type === "entrada" ? "text-blue-700 bg-blue-100" : "text-emerald-700 bg-emerald-100"}`}>{op.type}</span>
            <span className="font-medium text-sm">{op.name}</span>
            <span className="text-xs text-gray-400 ml-2 font-mono">{op.cfop}</span>
          </div>
          <span className="text-xs text-gray-500">{opRules.length} regra(s)</span>
        </div>
        {opRules.length === 0 ? (
          <p className="text-xs text-gray-400">Nenhuma regra fiscal configurada.</p>
        ) : (
          <div className="space-y-1">
            {opRules.map(r => (
              <div key={r.id} className="text-xs flex flex-wrap gap-x-3 gap-y-1 bg-gray-50 rounded p-1.5">
                <span className="text-gray-500">{r.ncm ? `NCM ${r.ncm}` : "Geral"}{r.uf ? ` • UF ${r.uf}` : ""}</span>
                <span>ICMS {r.cst_icms}/{r.icms_rate}%</span>
                <span>PIS {r.cst_pis}/{r.pis_rate}%</span>
                <span>COFINS {r.cst_cofins}/{r.cofins_rate}%</span>
                <span>IPI {r.cst_ipi}/{r.ipi_rate}%</span>
                <span className="text-purple-700">CBS {r.cbs_rate}%</span>
                <span className="text-fuchsia-700">IBS {r.ibs_rate}%</span>
                {r.difal_enabled && <span className="text-blue-700">DIFAL (dest {r.aliq_interna_destino}% − inter {r.aliq_interestadual}%)</span>}
                {r.st_enabled && <span className="text-amber-700">ST {r.st_base_method === "pauta" ? "Pauta" : r.st_base_method === "agregada" ? "Agregada" : `MVA ${r.mva_rate}%`} • alíq {r.icms_st_rate}%</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div><h2 className="font-semibold text-base">Fiscal — Operações e Regras Configuradas</h2>
        <p className="text-xs text-gray-500">Visualização consolidada. A edição fica nas abas "Operações" e "Regras Fiscais" deste módulo.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Operações</p><p className="text-xl font-bold">{operations.length}</p></div>
        <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Regras fiscais</p><p className="text-xl font-bold">{rules.length}</p></div>
        <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Operações de entrada</p><p className="text-xl font-bold text-blue-600">{entradas.length}</p></div>
        <div className="bg-white rounded-xl border p-3"><p className="text-xs text-gray-500">Operações de saída</p><p className="text-xl font-bold text-emerald-600">{saidas.length}</p></div>
      </div>

      {loading ? <p className="text-center text-gray-400 py-8">Carregando...</p> : operations.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
          <ScrollText className="w-10 h-10 mx-auto mb-2 opacity-30" /> Nenhuma operação cadastrada.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {operations.map(op => <Row key={op.id} op={op} />)}
        </div>
      )}
    </div>
  );
}