import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const formatCurrency = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

export default function CommissionReceipt({ payment, orders, userEmail, onClose }) {
  const [company, setCompany] = useState(null);
  const [mechanic, setMechanic] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [companies, mechs] = await Promise.all([
          base44.entities.DiagnosticCompanyConfig.filter({ user_email: userEmail }),
          payment?.mechanic_id
            ? base44.entities.DiagnosticMechanic.filter({ user_email: userEmail })
            : Promise.resolve([])
        ]);
        setCompany(companies[0] || null);
        setMechanic(mechs.find(m => m.id === payment?.mechanic_id) || null);
      } catch {
        /* ignore */
      }
    };
    load();
  }, [payment, userEmail]);

  if (!payment) return null;

  const handlePrint = () => {
    const printArea = document.getElementById("commission-receipt-print");
    if (!printArea) return;
    const win = window.open("", "_blank", "width=800,height=900");
    win.document.write(`
      <html>
        <head>
          <title>Recibo de Comissão - ${payment.mechanic_name}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; color: #1e293b; padding: 40px; }
            .header { text-align: center; border-bottom: 2px solid #2563EB; padding-bottom: 16px; margin-bottom: 24px; }
            .company-name { font-size: 20px; font-weight: bold; }
            .company-sub { font-size: 12px; color: #64748b; margin-top: 4px; }
            .title { font-size: 18px; font-weight: bold; text-align: center; margin: 16px 0; }
            .receipt-num { text-align: center; font-size: 12px; color: #64748b; margin-bottom: 24px; }
            .section { margin-bottom: 20px; }
            .section-title { font-size: 13px; font-weight: bold; text-transform: uppercase; color: #2563EB; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px; }
            .info-row { display: flex; justify-content: space-between; font-size: 13px; padding: 3px 0; }
            .info-label { color: #64748b; }
            .info-value { font-weight: 600; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
            th { background: #f1f5f9; text-align: left; padding: 8px; border: 1px solid #e2e8f0; }
            td { padding: 8px; border: 1px solid #e2e8f0; }
            .totals { margin-left: auto; width: 300px; }
            .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
            .grand-total { border-top: 2px solid #2563EB; margin-top: 8px; padding-top: 8px; font-size: 16px; font-weight: bold; }
            .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
            .sig-block { text-align: center; width: 45%; }
            .sig-line { border-top: 1px solid #1e293b; margin-bottom: 4px; }
            .sig-label { font-size: 12px; color: #64748b; }
            .footer { text-align: center; font-size: 11px; color: #94a3b8; margin-top: 32px; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>${printArea.innerHTML}</body>
      </html>
    `);
    win.document.close();
    setTimeout(() => { win.print(); }, 300);
  };

  const mechanicOrders = (orders || []).filter(o =>
    payment.order_ids?.includes(o.id)
  );

  return (
    <Dialog open={!!payment} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-700">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            Recibo de Pagamento de Comissão
          </DialogTitle>
        </DialogHeader>

        <div id="commission-receipt-print">
          {/* Cabeçalho */}
          <div className="header text-center border-b-2 border-blue-600 pb-4 mb-6">
            {company?.logo_url && (
              <img src={company.logo_url} alt="Logo" className="mx-auto h-16 mb-2 object-contain" />
            )}
            <p className="company-name text-xl font-bold">{company?.razao_social || "Oficina"}</p>
            {company?.nome_fantasia && (
              <p className="company-sub text-xs text-slate-500 mt-1">{company.nome_fantasia}</p>
            )}
            {company?.cnpj && (
              <p className="company-sub text-xs text-slate-500">CNPJ: {company.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}</p>
            )}
            {company?.phone && (
              <p className="company-sub text-xs text-slate-500">Tel: {company.phone}</p>
            )}
          </div>

          <p className="title text-lg font-bold text-center my-4">RECIBO DE COMISSÃO</p>
          <p className="receipt-num text-center text-xs text-slate-500 mb-6">
            Nº {payment.id?.slice(-8).toUpperCase()}
          </p>

          {/* Dados do mecânico */}
          <div className="section mb-5">
            <p className="section-title text-sm font-bold uppercase text-blue-600 border-b border-slate-200 pb-1 mb-2">Mecânico</p>
            <div className="info-row flex justify-between text-sm py-0.5">
              <span className="info-label text-slate-500">Nome</span>
              <span className="info-value font-semibold">{payment.mechanic_name}</span>
            </div>
            {mechanic?.cpf && (
              <div className="info-row flex justify-between text-sm py-0.5">
                <span className="info-label text-slate-500">CPF</span>
                <span className="info-value font-semibold">{mechanic.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</span>
              </div>
            )}
            {mechanic?.phone && (
              <div className="info-row flex justify-between text-sm py-0.5">
                <span className="info-label text-slate-500">Telefone</span>
                <span className="info-value font-semibold">{mechanic.phone}</span>
              </div>
            )}
            {mechanic?.specialty && (
              <div className="info-row flex justify-between text-sm py-0.5">
                <span className="info-label text-slate-500">Especialidade</span>
                <span className="info-value font-semibold capitalize">{mechanic.specialty.replace("_", " ")}</span>
              </div>
            )}
          </div>

          {/* Período */}
          <div className="section mb-5">
            <p className="section-title text-sm font-bold uppercase text-blue-600 border-b border-slate-200 pb-1 mb-2">Período de Referência</p>
            <div className="info-row flex justify-between text-sm py-0.5">
              <span className="info-label text-slate-500">Data Início</span>
              <span className="info-value font-semibold">{formatDate(payment.period_start)}</span>
            </div>
            <div className="info-row flex justify-between text-sm py-0.5">
              <span className="info-label text-slate-500">Data Fim</span>
              <span className="info-value font-semibold">{formatDate(payment.period_end)}</span>
            </div>
            <div className="info-row flex justify-between text-sm py-0.5">
              <span className="info-label text-slate-500">Data do Pagamento</span>
              <span className="info-value font-semibold">{formatDate(payment.paid_date)}</span>
            </div>
            <div className="info-row flex justify-between text-sm py-0.5">
              <span className="info-label text-slate-500">Quantidade de OS</span>
              <span className="info-value font-semibold">{payment.order_count}</span>
            </div>
          </div>

          {/* Ordens de serviço */}
          {mechanicOrders.length > 0 && (
            <div className="section mb-5">
              <p className="section-title text-sm font-bold uppercase text-blue-600 border-b border-slate-200 pb-1 mb-2">Ordens de Serviço</p>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="border border-slate-200 bg-slate-100 p-2 text-left">Nº OS</th>
                    <th className="border border-slate-200 bg-slate-100 p-2 text-left">Cliente</th>
                    <th className="border border-slate-200 bg-slate-100 p-2 text-left">Veículo</th>
                    <th className="border border-slate-200 bg-slate-100 p-2 text-right">Mão de Obra</th>
                    <th className="border border-slate-200 bg-slate-100 p-2 text-right">Peças</th>
                  </tr>
                </thead>
                <tbody>
                  {mechanicOrders.map(o => (
                    <tr key={o.id}>
                      <td className="border border-slate-200 p-2">{o.order_number}</td>
                      <td className="border border-slate-200 p-2">{o.client_name}</td>
                      <td className="border border-slate-200 p-2">{o.vehicle_brand} {o.vehicle_model}</td>
                      <td className="border border-slate-200 p-2 text-right">{formatCurrency(o.labor_total)}</td>
                      <td className="border border-slate-200 p-2 text-right">{formatCurrency(o.parts_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Totais */}
          <div className="totals ml-auto w-72 mb-6">
            <div className="total-row flex justify-between py-1.5 text-sm">
              <span className="text-slate-500">Total Mão de Obra</span>
              <span className="font-semibold">{formatCurrency(payment.total_labor)}</span>
            </div>
            <div className="total-row flex justify-between py-1.5 text-sm">
              <span className="text-slate-500">Comissão M.O. ({payment.commission_rate}%)</span>
              <span className="font-semibold">{formatCurrency((payment.total_labor * (payment.commission_rate || 0)) / 100)}</span>
            </div>
            {payment.total_parts > 0 && (
              <>
                <div className="total-row flex justify-between py-1.5 text-sm">
                  <span className="text-slate-500">Total Peças</span>
                  <span className="font-semibold">{formatCurrency(payment.total_parts)}</span>
                </div>
                <div className="total-row flex justify-between py-1.5 text-sm">
                  <span className="text-slate-500">Comissão Peças ({payment.parts_commission_rate || 0}%)</span>
                  <span className="font-semibold">{formatCurrency((payment.total_parts * (payment.parts_commission_rate || 0)) / 100)}</span>
                </div>
              </>
            )}
            <div className="grand-total flex justify-between border-t-2 border-blue-600 mt-2 pt-2 text-base font-bold">
              <span>VALOR TOTAL PAGO</span>
              <span className="text-green-600">{formatCurrency(payment.commission_amount)}</span>
            </div>
          </div>

          {/* Assinaturas */}
          <div className="signatures flex justify-between mt-16">
            <div className="sig-block text-center w-[45%]">
              <div className="sig-line border-t border-slate-800 mb-1"></div>
              <p className="sig-label text-xs text-slate-500">{payment.mechanic_name}</p>
              <p className="sig-label text-xs text-slate-400">Mecânico</p>
            </div>
            <div className="sig-block text-center w-[45%]">
              <div className="sig-line border-t border-slate-800 mb-1"></div>
              <p className="sig-label text-xs text-slate-500">{company?.razao_social || "Responsável"}</p>
              <p className="sig-label text-xs text-slate-400">Pagador</p>
            </div>
          </div>

          <p className="footer text-center text-[11px] text-slate-400 mt-8">
            Recibo gerado em {formatDate(new Date().toISOString())} via SoftPremier
          </p>
        </div>

        <div className="flex gap-2 mt-4">
          <Button onClick={handlePrint} className="flex-1 gap-1.5 text-white" style={{ backgroundColor: "#2563EB" }}>
            <Printer className="w-4 h-4" /> Imprimir Recibo
          </Button>
          <Button variant="outline" onClick={onClose} className="flex-1">Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}