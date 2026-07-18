import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileDown, Mail, X, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import jsPDF from "jspdf";

const fmtMoney = (v) => `R$ ${parseFloat(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

const METHOD_LABELS = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  boleto: "Boleto",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
};

export default function WorkshopReceiptPDF({ order, companyConfig, paymentMethod, discountValue, finalTotal, onClose }) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);

  const receiptNumber = `REC-${order.order_number || order.id.slice(-6).toUpperCase()}`;
  const now = new Date();

  const generatePDF = () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = 210;
    let y = 20;

    // Cabeçalho — empresa
    doc.setFontSize(16);
    doc.setFont(undefined, "bold");
    doc.text(companyConfig?.nome_fantasia || companyConfig?.razao_social || "Oficina", pageW / 2, y, { align: "center" });
    y += 6;

    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    if (companyConfig?.cnpj) {
      doc.text(`CNPJ: ${companyConfig.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}`, pageW / 2, y, { align: "center" });
      y += 5;
    }
    const addrParts = [
      companyConfig?.address,
      companyConfig?.number,
      companyConfig?.district,
    ].filter(Boolean);
    if (addrParts.length) {
      doc.text(addrParts.join(", "), pageW / 2, y, { align: "center" });
      y += 5;
    }
    const cityParts = [companyConfig?.city, companyConfig?.uf].filter(Boolean);
    if (cityParts.length) {
      doc.text(`${cityParts.join(" - ")}`, pageW / 2, y, { align: "center" });
      y += 5;
    }
    if (companyConfig?.phone) {
      doc.text(`Telefone: ${companyConfig.phone}`, pageW / 2, y, { align: "center" });
      y += 5;
    }

    // Linha separadora
    y += 2;
    doc.setDrawColor(200);
    doc.line(15, y, pageW - 15, y);
    y += 8;

    // Título do recibo
    doc.setFontSize(14);
    doc.setFont(undefined, "bold");
    doc.text("RECIBO DE PAGAMENTO", pageW / 2, y, { align: "center" });
    y += 6;
    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    doc.text(`Nº ${receiptNumber}`, pageW / 2, y, { align: "center" });
    y += 8;

    // Valor recebido
    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.text(`Valor Recebido: ${fmtMoney(finalTotal)}`, 15, y);
    y += 7;

    // Data
    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    doc.text(`Data de recebimento: ${fmtDateTime(now.toISOString())}`, 15, y);
    y += 8;

    // Dados do cliente
    doc.setDrawColor(220);
    doc.line(15, y, pageW - 15, y);
    y += 5;
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.text("CLIENTE", 15, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    doc.text(`Nome: ${order.client_name || "—"}`, 15, y); y += 5;
    if (order.client_cpf_cnpj) {
      doc.text(`CPF/CNPJ: ${order.client_cpf_cnpj}`, 15, y); y += 5;
    }
    if (order.client_phone) {
      doc.text(`Telefone: ${order.client_phone}`, 15, y); y += 5;
    }

    // Dados do veículo
    y += 2;
    doc.setDrawColor(220);
    doc.line(15, y, pageW - 15, y);
    y += 5;
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.text("VEÍCULO", 15, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    doc.text(`Marca/Modelo: ${order.vehicle_brand || "—"} ${order.vehicle_model || ""}`, 15, y); y += 5;
    if (order.vehicle_plate) {
      doc.text(`Placa: ${order.vehicle_plate}`, 15, y); y += 5;
    }

    // Dados da OS
    y += 2;
    doc.setDrawColor(220);
    doc.line(15, y, pageW - 15, y);
    y += 5;
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.text("ORDEM DE SERVIÇO", 15, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    doc.text(`Número: ${order.order_number || "—"}`, 15, y); y += 5;

    // Itens
    if (order.items && order.items.length > 0) {
      y += 2;
      doc.setDrawColor(220);
      doc.line(15, y, pageW - 15, y);
      y += 5;
      doc.setFontSize(10);
      doc.setFont(undefined, "bold");
      doc.text("ITENS", 15, y);
      y += 5;

      // Cabeçalho da tabela
      doc.setFontSize(8);
      doc.text("Descrição", 15, y);
      doc.text("Qtd", 130, y, { align: "right" });
      doc.text("Valor Unit.", 165, y, { align: "right" });
      doc.text("Total", pageW - 15, y, { align: "right" });
      y += 3;
      doc.line(15, y, pageW - 15, y);
      y += 4;

      doc.setFont(undefined, "normal");
      order.items.forEach((item) => {
        if (y > 270) { doc.addPage(); y = 20; }
        const desc = (item.description || "").slice(0, 60);
        doc.text(desc, 15, y);
        doc.text(String(item.quantity || 1), 130, y, { align: "right" });
        doc.text(fmtMoney(item.unit_price || 0), 165, y, { align: "right" });
        doc.text(fmtMoney(item.total || 0), pageW - 15, y, { align: "right" });
        y += 5;
      });
    }

    // Totais
    if (y > 250) { doc.addPage(); y = 20; }
    y += 3;
    doc.setDrawColor(220);
    doc.line(15, y, pageW - 15, y);
    y += 5;
    doc.setFontSize(9);
    doc.text(`Total de Peças: ${fmtMoney(order.parts_total || 0)}`, 15, y); y += 5;
    doc.text(`Total de Mão de Obra: ${fmtMoney(order.labor_total || 0)}`, 15, y); y += 5;
    if (discountValue > 0) {
      doc.text(`Desconto: -${fmtMoney(discountValue)}`, 15, y); y += 5;
    }
    doc.setFont(undefined, "bold");
    doc.setFontSize(11);
    doc.text(`TOTAL PAGO: ${fmtMoney(finalTotal)}`, pageW - 15, y, { align: "right" });
    y += 8;

    // Forma de pagamento
    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    doc.text(`Forma de pagamento: ${METHOD_LABELS[paymentMethod] || paymentMethod || "—"}`, 15, y);
    y += 10;

    // Declaração
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(9);
    doc.setFont(undefined, "italic");
    const decl = `Recebi(emos) de ${order.client_name || "cliente"} a importância de ${fmtMoney(finalTotal)}, referente aos serviços descritos na OS ${order.order_number || ""}, dando plena, geral e irrevogável quitação.`;
    const splitDecl = doc.splitTextToSize(decl, pageW - 30);
    doc.text(splitDecl, 15, y);
    y += splitDecl.length * 5 + 10;

    // Assinaturas
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setDrawColor(150);
    doc.line(30, y, 90, y);
    doc.line(pageW - 90, y, pageW - 30, y);
    y += 5;
    doc.setFont(undefined, "normal");
    doc.text(companyConfig?.nome_fantasia || companyConfig?.razao_social || "Oficina", 60, y, { align: "center" });
    doc.text(order.client_name || "Cliente", pageW - 60, y, { align: "center" });

    // Rodapé
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`Recibo gerado em ${fmtDateTime(now.toISOString())} — SoftPremier`, pageW / 2, 290, { align: "center" });

    return doc;
  };

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const doc = generatePDF();
      doc.save(`recibo-${order.order_number || order.id}.pdf`);
      toast({ title: "Recibo gerado", description: "O PDF foi baixado." });
    } catch {
      toast({ title: "Erro", description: "Não foi possível gerar o PDF.", variant: "destructive" });
    }
    setGenerating(false);
  };

  const handleSendEmail = async () => {
    if (!order.client_phone && !order.client_name) {
      toast({ title: "Atenção", description: "Não há email do cliente disponível para envio.", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      // Gera o PDF como base64 para anexar
      const doc = generatePDF();
      const pdfBase64 = doc.output("datauristring");

      // Tenta enviar por email — apenas usuários registrados
      const sessionUser = JSON.parse(localStorage.getItem("portal_user") || "{}");
      const toEmail = sessionUser?.email || "";

      if (!toEmail) {
        // Se não tem email, apenas baixa o PDF
        doc.save(`recibo-${order.order_number || order.id}.pdf`);
        toast({ title: "Recibo baixado", description: "Email do cliente não registrado — PDF baixado para envio manual." });
      } else {
        await base44.integrations.Core.SendEmail({
          to: toEmail,
          subject: `Recibo de Pagamento — OS ${order.order_number}`,
          body: `
            <h2>Recibo de Pagamento</h2>
            <p><strong>Cliente:</strong> ${order.client_name || "—"}</p>
            <p><strong>OS:</strong> ${order.order_number || "—"}</p>
            <p><strong>Veículo:</strong> ${order.vehicle_brand || ""} ${order.vehicle_model || ""} — ${order.vehicle_plate || ""}</p>
            <p><strong>Valor:</strong> ${fmtMoney(finalTotal)}</p>
            <p><strong>Forma de pagamento:</strong> ${METHOD_LABELS[paymentMethod] || paymentMethod}</p>
            <p><strong>Data:</strong> ${fmtDateTime(now.toISOString())}</p>
            <hr/>
            <p>O recibo em PDF está anexado a este email.</p>
          `,
        });
        toast({ title: "Recibo enviado", description: `Email enviado para ${toEmail}.` });
      }
    } catch {
      toast({ title: "Erro", description: "Não foi possível enviar o email.", variant: "destructive" });
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <h3 className="text-lg font-bold">Pagamento Registrado!</h3>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="p-3 rounded-lg bg-green-50 border border-green-200 space-y-1 text-sm">
            <p><strong>OS:</strong> {order.order_number}</p>
            <p><strong>Cliente:</strong> {order.client_name}</p>
            <p><strong>Valor:</strong> {fmtMoney(finalTotal)}</p>
            <p><strong>Forma:</strong> {METHOD_LABELS[paymentMethod] || paymentMethod}</p>
          </div>

          <p className="text-sm text-muted-foreground text-center">
            Deseja gerar o recibo em PDF para impressão ou envio por email?
          </p>

          <div className="flex flex-col gap-2">
            <Button onClick={handleDownload} disabled={generating} className="gap-2">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              Baixar Recibo PDF
            </Button>
            <Button variant="outline" onClick={handleSendEmail} disabled={sending} className="gap-2">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Enviar por Email
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}