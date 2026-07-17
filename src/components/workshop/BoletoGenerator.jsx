import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Printer, X, FileText } from "lucide-react";
import {
  gerarCodigoBarras,
  gerarLinhaDigitavel,
  formatarLinhaDigitavel,
  renderITFSVG,
} from "@/lib/boletoUtils";

const fmtMoney = (v) =>
  parseFloat(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR");
};

export default function BoletoGenerator({ bank, order, companyConfig, dueDate, onClose }) {
  const nossoNumero = String(order.order_number || "1").replace(/\D/g, "");

  const { codigoBarras, linhaDigitavel, linhaFormatada, barcodeSVG } = useMemo(() => {
    const cb = gerarCodigoBarras({
      bankCode: bank.bank_code,
      valor: order.total || 0,
      dataVencimento: dueDate,
      agencia: bank.agency,
      conta: bank.account,
      nossoNumero,
    });
    const ld = gerarLinhaDigitavel(cb);
    return {
      codigoBarras: cb,
      linhaDigitavel: ld,
      linhaFormatada: formatarLinhaDigitavel(ld),
      barcodeSVG: renderITFSVG(cb, { narrowWidth: 2, height: 60 }),
    };
  }, [bank, order, dueDate, nossoNumero]);

  const agenciaConta = `${bank.agency || "0001"} / ${bank.account || "00001-0"}`;

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=820,height=700");
    if (!printWindow) return;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Boleto - ${order.order_number}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: 'Inter', Arial, sans-serif; font-size: 11px; color:#000; padding: 20px; }
.boleto { max-width: 720px; margin: 0 auto; }
.header { display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:12px; }
.bank-info { display:flex; align-items:center; gap:12px; }
.bank-code { font-size:28px; font-weight:bold; border:2px solid #000; padding:4px 12px; line-height:1; }
.bank-name { font-size:13px; font-weight:bold; }
.section { border:1px solid #000; margin-bottom:4px; }
.section-header { background:#f0f0f0; border-bottom:1px solid #000; padding:3px 8px; font-size:9px; font-weight:bold; text-transform:uppercase; }
.section-body { padding:6px 8px; display:flex; flex-wrap:wrap; gap:4px 24px; }
.field { display:flex; flex-direction:column; }
.field-label { font-size:8px; color:#555; text-transform:uppercase; }
.field-value { font-size:11px; font-weight:bold; }
.linha-digitavel { text-align:center; font-size:16px; font-weight:bold; letter-spacing:1px; padding:8px; border:1px solid #000; margin:8px 0; }
.barcode { text-align:center; margin:12px 0; }
.barcode svg { max-width:100%; height:auto; }
.footer { margin-top:20px; font-size:9px; color:#666; text-align:center; }
@media print { body { padding:0; } }
</style></head><body>
<div class="boleto">
  <div class="header">
    <div class="bank-info">
      <div class="bank-code">${bank.bank_code || "000"}</div>
      <div class="bank-name">${bank.bank_name || "Banco"}</div>
    </div>
    <div style="text-align:right; font-size:10px;">
      <div><strong>RECIBO DO SACADO</strong></div>
    </div>
  </div>

  <div class="section">
    <div class="section-header">Dados do Documento</div>
    <div class="section-body">
      <div class="field"><span class="field-label">Local de Pagamento</span><span class="field-value">PAGÁVEL EM QUALQUER BANCO ATÉ O VENCIMENTO</span></div>
      <div class="field"><span class="field-label">Vencimento</span><span class="field-value">${fmtDate(dueDate)}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-header">Cedente</div>
    <div class="section-body">
      <div class="field"><span class="field-label">Cedente</span><span class="field-value">${companyConfig.razao_social || "Oficina"}</span></div>
      <div class="field"><span class="field-label">CNPJ / CPF</span><span class="field-value">${companyConfig.cnpj || "-"}</span></div>
      <div class="field"><span class="field-label">Agência / Código do Cedente</span><span class="field-value">${agenciaConta}</span></div>
      <div class="field"><span class="field-label">Nosso Número</span><span class="field-value">${nossoNumero.padStart(11, "0")}</span></div>
      <div class="field"><span class="field-label">Data do Documento</span><span class="field-value">${fmtDate(new Date().toISOString())}</span></div>
      <div class="field"><span class="field-label">Nº do Documento</span><span class="field-value">${order.order_number}</span></div>
      <div class="field"><span class="field-label">Valor do Documento</span><span class="field-value">${fmtMoney(order.total)}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-header">Sacado</div>
    <div class="section-body">
      <div class="field"><span class="field-label">Nome do Sacado</span><span class="field-value">${order.client_name || "-"}</span></div>
      <div class="field"><span class="field-label">CPF / CNPJ</span><span class="field-value">${order.client_cpf_cnpj || "-"}</span></div>
      <div class="field"><span class="field-label">Veículo</span><span class="field-value">${order.vehicle_brand || ""} ${order.vehicle_model || ""} ${order.vehicle_plate ? "- " + order.vehicle_plate : ""}</span></div>
    </div>
  </div>

  <div class="linha-digitavel">${linhaFormatada}</div>

  <div class="barcode">${barcodeSVG}</div>

  <div class="footer">
    Boleto gerado automaticamente pelo SoftPremier — Workshop. Este documento não possui validade fiscal.
    Código de barras: ${codigoBarras}
  </div>
</div>
<script>window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); };</script>
</body></html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold">Boleto Bancário</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4" /> Imprimir
            </Button>
            <Button size="icon" variant="ghost" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Boleto preview */}
        <div className="p-5 space-y-3 text-xs">
          {/* Bank header */}
          <div className="flex items-center justify-between border-2 border-black rounded px-3 py-2">
            <div className="flex items-center gap-3">
              <div className="text-2xl font-bold border-2 border-black px-3 py-1 leading-none">
                {bank.bank_code || "000"}
              </div>
              <div className="font-semibold text-sm">{bank.bank_name}</div>
            </div>
            <div className="text-right">
              <div className="text-[9px] text-gray-500 uppercase">RECIBO DO SACADO</div>
            </div>
          </div>

          {/* Payment location + due date */}
          <div className="border border-black rounded grid grid-cols-3">
            <div className="col-span-2 border-r border-black p-2">
              <div className="text-[9px] text-gray-500 uppercase">Local de Pagamento</div>
              <div className="font-semibold">PAGÁVEL EM QUALQUER BANCO ATÉ O VENCIMENTO</div>
            </div>
            <div className="p-2">
              <div className="text-[9px] text-gray-500 uppercase">Vencimento</div>
              <div className="font-semibold">{fmtDate(dueDate)}</div>
            </div>
          </div>

          {/* Cedente */}
          <div className="border border-black rounded">
            <div className="bg-gray-100 border-b border-black px-2 py-1 text-[9px] font-bold uppercase">Cedente</div>
            <div className="p-2 grid grid-cols-3 gap-2">
              <div>
                <div className="text-[9px] text-gray-500 uppercase">Cedente</div>
                <div className="font-semibold truncate">{companyConfig.razao_social || "Oficina"}</div>
              </div>
              <div>
                <div className="text-[9px] text-gray-500 uppercase">CNPJ / CPF</div>
                <div className="font-semibold">{companyConfig.cnpj || "-"}</div>
              </div>
              <div>
                <div className="text-[9px] text-gray-500 uppercase">Agência / Conta</div>
                <div className="font-semibold">{agenciaConta}</div>
              </div>
              <div>
                <div className="text-[9px] text-gray-500 uppercase">Nosso Número</div>
                <div className="font-semibold">{nossoNumero.padStart(11, "0")}</div>
              </div>
              <div>
                <div className="text-[9px] text-gray-500 uppercase">Nº do Documento</div>
                <div className="font-semibold">{order.order_number}</div>
              </div>
              <div>
                <div className="text-[9px] text-gray-500 uppercase">Valor do Documento</div>
                <div className="font-semibold text-blue-600">{fmtMoney(order.total)}</div>
              </div>
            </div>
          </div>

          {/* Sacado */}
          <div className="border border-black rounded">
            <div className="bg-gray-100 border-b border-black px-2 py-1 text-[9px] font-bold uppercase">Sacado</div>
            <div className="p-2 grid grid-cols-3 gap-2">
              <div>
                <div className="text-[9px] text-gray-500 uppercase">Nome do Sacado</div>
                <div className="font-semibold truncate">{order.client_name || "-"}</div>
              </div>
              <div>
                <div className="text-[9px] text-gray-500 uppercase">CPF / CNPJ</div>
                <div className="font-semibold">{order.client_cpf_cnpj || "-"}</div>
              </div>
              <div>
                <div className="text-[9px] text-gray-500 uppercase">Veículo</div>
                <div className="font-semibold truncate">
                  {order.vehicle_brand || ""} {order.vehicle_model || ""} {order.vehicle_plate ? "- " + order.vehicle_plate : ""}
                </div>
              </div>
            </div>
          </div>

          {/* Linha digitável */}
          <div className="border border-black rounded text-center py-2 px-3">
            <div className="text-[9px] text-gray-500 uppercase mb-1">Linha Digitável</div>
            <div className="font-bold text-sm tracking-wide break-all">{linhaFormatada}</div>
          </div>

          {/* Barcode */}
          <div className="border border-black rounded p-3 flex justify-center overflow-x-auto">
            <div dangerouslySetInnerHTML={{ __html: barcodeSVG }} />
          </div>

          <p className="text-center text-[10px] text-gray-400 mt-2">
            Boleto gerado pelo SoftPremier — Workshop. Documento sem validade fiscal.
          </p>
        </div>
      </div>
    </div>
  );
}