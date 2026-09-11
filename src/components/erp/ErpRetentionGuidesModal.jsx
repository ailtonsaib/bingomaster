import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { X, Printer, Landmark } from "lucide-react";
import { printElements } from "@/lib/printUtils";
import { fmtMoney } from "@/lib/erpUtils";

const fmtBR = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
const periodOf = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

const Field = ({ label, value, className = "" }) => (
  <div className={`border border-gray-500 px-2 py-1 ${className}`}>
    <p className="text-[8px] uppercase tracking-wide text-gray-700 leading-tight">{label}</p>
    <p className="text-[11px] font-medium text-black leading-snug break-words">{value || "—"}</p>
  </div>
);

// Uma guia por imposto retido — documento para o Financeiro efetuar o pagamento
const GuiaImposto = ({ company, entry, r, index }) => (
  <div id={`ret-guia-${index}`} className="bg-white border border-gray-400 rounded p-3 max-w-3xl mx-auto text-black">
    <div className="flex justify-between items-end border-b-2 border-black pb-1 mb-2">
      <div className="flex items-center gap-2">
        <Landmark className="w-5 h-5 text-black" />
        <div>
          <p className="text-sm font-bold uppercase">Guia de Recolhimento — Retenção de {r.type}</p>
          <p className="text-[9px] text-gray-700">Documento auxiliar para pagamento pelo Financeiro</p>
        </div>
      </div>
      <div className="text-right text-[9px] text-gray-700">
        <p>Emissão: {new Date().toLocaleDateString("pt-BR")}</p>
        <p>Guia {String(index + 1).padStart(2, "0")}</p>
      </div>
    </div>
    <div className="grid grid-cols-3 gap-1">
      <Field label="Nome / Razão Social (Recorrente)" value={company?.razao_social} className="col-span-2" />
      <Field label="CNPJ" value={company?.cnpj} />
      <Field label="Fornecedor da Nota" value={entry.supplier_name} />
      <Field label="CNPJ/CPF do Fornecedor" value={entry.supplier_cnpj} />
      <Field label="Nota Fiscal / Emissão" value={`NF ${entry.nota_number} — ${fmtBR(entry.issue_date)}`} />
      <Field label="Código de Recolhimento" value={r.supplier_code} />
      <Field label="Período de Apuração" value={periodOf(r.due_date || entry.issue_date)} />
      <Field label="Vencimento" value={fmtBR(r.due_date)} />
      <Field label="Destinatário (Órgão/Fornecedor)" value={r.partner_name} className="col-span-2" />
      <Field label="Conta Contábil" value={r.account_code ? `${r.account_code} — ${r.account_name || ""}` : r.account_name} />
      <Field label="Histórico" value={r.history_text || `Retenção ${r.type} NF ${entry.nota_number}`} className="col-span-2" />
      <div className="border border-gray-500 px-2 py-1 bg-gray-50 text-right">
        <p className="text-[8px] uppercase tracking-wide text-gray-700">Valor a Recolher (R$)</p>
        <p className="text-base font-bold text-black">{fmtMoney(r.value)}</p>
      </div>
    </div>
    <p className="text-[9px] text-gray-600 mt-2 border-t border-gray-300 pt-1">
      Guia gerada automaticamente na atualização da nota — entregue ao Financeiro para pagamento na data de vencimento.
    </p>
  </div>
);

// Exibe as guias de todos os impostos retidos da nota, uma por folha na impressão
export default function ErpRetentionGuidesModal({ user, entry, retentions, onClose }) {
  const [company, setCompany] = useState(null);

  useEffect(() => {
    base44.entities.ErpCompany.filter({ user_email: user.email, is_active: true }, "-created_date", 1)
      .then((list) => setCompany(list[0] || null))
      .catch(() => {});
  }, [user.email]);

  const handlePrint = () => {
    printElements(retentions.map((_, i) => `ret-guia-${i}`));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h3 className="font-bold flex items-center gap-2">
            <Landmark className="w-5 h-5 text-indigo-600" /> Guias de Recolhimento — NF {entry.nota_number}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-6">
          <p className="text-xs text-gray-500">Nota atualizada com {retentions.length} retenção(ões). Imprima as guias abaixo e envie ao Financeiro para pagamento de cada imposto no vencimento.</p>
          {retentions.map((r, i) => (
            <GuiaImposto key={`${r.type}-${i}`} company={company} entry={entry} r={r} index={i} />
          ))}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t sticky bottom-0 bg-white">
          <Button variant="outline" onClick={onClose}>Concluir</Button>
          <Button onClick={handlePrint} className="bg-indigo-600 hover:bg-indigo-700 gap-1.5">
            <Printer className="w-4 h-4" /> Imprimir Guias
          </Button>
        </div>
      </div>
    </div>
  );
}