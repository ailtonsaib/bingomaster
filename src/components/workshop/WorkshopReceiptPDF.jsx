import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileDown, Mail, X, CheckCircle2, Loader2, FileText, Wrench } from "lucide-react";
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
  const [generatingNFe, setGeneratingNFe] = useState(false);
  const [generatingNFSe, setGeneratingNFSe] = useState(false);

  const receiptNumber = `REC-${order.order_number || order.id.slice(-6).toUpperCase()}`;
  const now = new Date();

  // Carrega a logo da empresa como dataURL para inserir no PDF
  const loadLogo = () => new Promise((resolve) => {
    const url = companyConfig?.logo_url;
    if (!url) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });

  const generatePDF = (logoData) => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = 210;
    let y = 20;

    // Logo da empresa (se disponível)
    if (logoData) {
      try {
        doc.addImage(logoData, "PNG", 15, 12, 22, 22);
      } catch { /* ignore */ }
    }

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

  // ─── GERAR NF-e (Nota Fiscal de Produto — peças) ───
  const generateNFePDF = (logoData) => {
    const parts = (order.items || []).filter(i => i.type === "peca");
    if (parts.length === 0) return null;

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = 210;
    let y = 15;

    // Logo da empresa (se disponível)
    if (logoData) {
      try { doc.addImage(logoData, "PNG", 15, 8, 18, 18); } catch { /* ignore */ }
    }

    // Cabeçalho
    doc.setFontSize(14);
    doc.setFont(undefined, "bold");
    doc.text(companyConfig?.razao_social || "Oficina", logoData ? 38 : 15, y);
    y += 6;
    doc.setFontSize(8);
    doc.setFont(undefined, "normal");
    if (companyConfig?.cnpj) {
      doc.text(`CNPJ: ${companyConfig.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}`, logoData ? 38 : 15, y);
      y += 4;
    }
    if (companyConfig?.ie) {
      doc.text(`IE: ${companyConfig.ie}`, logoData ? 38 : 15, y);
      y += 4;
    }
    const addrParts = [companyConfig?.address, companyConfig?.number, companyConfig?.district].filter(Boolean);
    if (addrParts.length) { doc.text(addrParts.join(", "), logoData ? 38 : 15, y); y += 4; }
    const cityParts = [companyConfig?.city, companyConfig?.uf].filter(Boolean);
    if (cityParts.length) { doc.text(cityParts.join(" - "), logoData ? 38 : 15, y); y += 4; }

    // Box NF-e
    doc.setFillColor(245, 245, 245);
    doc.rect(130, 15, 65, 20, "F");
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.text("NF-e", 162.5, 22, { align: "center" });
    doc.setFontSize(8);
    doc.setFont(undefined, "normal");
    doc.text(`Nº ${order.order_number || "—"}`, 162.5, 27, { align: "center" });
    doc.text(`Emissão: ${now.toLocaleDateString("pt-BR")}`, 162.5, 32, { align: "center" });

    y = 42;
    doc.setDrawColor(200);
    doc.line(15, y, pageW - 15, y);
    y += 6;

    // Destinatário
    doc.setFontSize(9);
    doc.setFont(undefined, "bold");
    doc.text("DESTINATÁRIO / REMETENTE", 15, y);
    y += 5;
    doc.setFont(undefined, "normal");
    doc.setFontSize(8);
    doc.text(`Nome: ${order.client_name || "—"}`, 15, y); y += 4;
    if (order.client_cpf_cnpj) {
      doc.text(`CPF/CNPJ: ${order.client_cpf_cnpj}`, 15, y); y += 4;
    }
    if (order.client_phone) {
      doc.text(`Telefone: ${order.client_phone}`, 15, y); y += 4;
    }

    y += 3;
    doc.setDrawColor(220);
    doc.line(15, y, pageW - 15, y);
    y += 5;

    // Tabela de itens
    doc.setFontSize(9);
    doc.setFont(undefined, "bold");
    doc.text("ITENS (PEÇAS)", 15, y);
    y += 5;

    doc.setFontSize(7);
    doc.text("Cód.", 15, y);
    doc.text("Descrição", 35, y);
    doc.text("NCM", 110, y);
    doc.text("Qtd", 130, y, { align: "right" });
    doc.text("Vl. Unit.", 155, y, { align: "right" });
    doc.text("Vl. Total", pageW - 15, y, { align: "right" });
    y += 3;
    doc.setDrawColor(200);
    doc.line(15, y, pageW - 15, y);
    y += 4;

    doc.setFont(undefined, "normal");
    parts.forEach(item => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(String(item.part_code || "—").slice(0, 15), 15, y);
      doc.text(String(item.description || "").slice(0, 55), 35, y);
      doc.text("—", 110, y);
      doc.text(String(item.quantity || 1), 130, y, { align: "right" });
      doc.text(fmtMoney(item.unit_price || 0), 155, y, { align: "right" });
      doc.text(fmtMoney(item.total || 0), pageW - 15, y, { align: "right" });
      y += 5;
    });

    // Totais
    if (y > 260) { doc.addPage(); y = 20; }
    y += 2;
    doc.setDrawColor(200);
    doc.line(15, y, pageW - 15, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont(undefined, "bold");
    doc.text(`TOTAL DE PEÇAS: ${fmtMoney(order.parts_total || 0)}`, pageW - 15, y, { align: "right" });
    y += 8;

    // Observação
    doc.setFontSize(7);
    doc.setFont(undefined, "italic");
    doc.setTextColor(120);
    doc.text("Documento gerado para fins de controle interno. Não substitui a NF-e autorizada pela SEFAZ.", 15, y);
    doc.setTextColor(0);

    return doc;
  };

  // ─── GERAR NFS-e (Nota Fiscal de Serviço — mão de obra) ───
  const generateNFSePDF = (logoData) => {
    const services = (order.items || []).filter(i => i.type === "servico");
    const laborTotal = order.labor_total || services.reduce((s, i) => s + (i.total || 0), 0);
    if (services.length === 0 && laborTotal === 0) return null;

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = 210;
    let y = 15;

    // Logo da empresa (se disponível)
    if (logoData) {
      try { doc.addImage(logoData, "PNG", 15, 8, 18, 18); } catch { /* ignore */ }
    }

    // Cabeçalho
    doc.setFontSize(14);
    doc.setFont(undefined, "bold");
    doc.text(companyConfig?.razao_social || "Oficina", logoData ? 38 : 15, y);
    y += 6;
    doc.setFontSize(8);
    doc.setFont(undefined, "normal");
    if (companyConfig?.cnpj) {
      doc.text(`CNPJ: ${companyConfig.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}`, logoData ? 38 : 15, y);
      y += 4;
    }
    const addrParts = [companyConfig?.address, companyConfig?.number, companyConfig?.district].filter(Boolean);
    if (addrParts.length) { doc.text(addrParts.join(", "), logoData ? 38 : 15, y); y += 4; }
    const cityParts = [companyConfig?.city, companyConfig?.uf].filter(Boolean);
    if (cityParts.length) { doc.text(cityParts.join(" - "), logoData ? 38 : 15, y); y += 4; }
    if (companyConfig?.phone) { doc.text(`Telefone: ${companyConfig.phone}`, logoData ? 38 : 15, y); y += 4; }

    // Box NFS-e
    doc.setFillColor(239, 246, 255);
    doc.rect(130, 15, 65, 20, "F");
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.text("NFS-e", 162.5, 22, { align: "center" });
    doc.setFontSize(8);
    doc.setFont(undefined, "normal");
    doc.text(`Nº ${order.order_number || "—"}`, 162.5, 27, { align: "center" });
    doc.text(`Emissão: ${now.toLocaleDateString("pt-BR")}`, 162.5, 32, { align: "center" });

    y = 42;
    doc.setDrawColor(200);
    doc.line(15, y, pageW - 15, y);
    y += 6;

    // Tomador do serviço
    doc.setFontSize(9);
    doc.setFont(undefined, "bold");
    doc.text("TOMADOR DO SERVIÇO", 15, y);
    y += 5;
    doc.setFont(undefined, "normal");
    doc.setFontSize(8);
    doc.text(`Nome: ${order.client_name || "—"}`, 15, y); y += 4;
    if (order.client_cpf_cnpj) {
      doc.text(`CPF/CNPJ: ${order.client_cpf_cnpj}`, 15, y); y += 4;
    }
    if (order.client_phone) {
      doc.text(`Telefone: ${order.client_phone}`, 15, y); y += 4;
    }

    y += 3;
    doc.setDrawColor(220);
    doc.line(15, y, pageW - 15, y);
    y += 5;

    // Discriminação dos serviços
    doc.setFontSize(9);
    doc.setFont(undefined, "bold");
    doc.text("DISCRIMINAÇÃO DOS SERVIÇOS", 15, y);
    y += 5;

    doc.setFontSize(8);
    doc.setFont(undefined, "normal");
    if (services.length > 0) {
      services.forEach(item => {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.text(`• ${item.description || "Serviço"}`, 15, y);
        doc.text(fmtMoney(item.total || 0), pageW - 15, y, { align: "right" });
        y += 5;
      });
    } else {
      doc.text("• Serviços de oficina mecânica", 15, y);
      doc.text(fmtMoney(laborTotal), pageW - 15, y, { align: "right" });
      y += 5;
    }

    // Veículo
    if (y > 250) { doc.addPage(); y = 20; }
    y += 3;
    doc.setDrawColor(220);
    doc.line(15, y, pageW - 15, y);
    y += 5;
    doc.setFontSize(8);
    doc.setFont(undefined, "bold");
    doc.text("DADOS DO VEÍCULO", 15, y);
    y += 4;
    doc.setFont(undefined, "normal");
    doc.text(`Veículo: ${order.vehicle_brand || ""} ${order.vehicle_model || ""}`, 15, y); y += 4;
    if (order.vehicle_plate) {
      doc.text(`Placa: ${order.vehicle_plate}`, 15, y); y += 4;
    }

    // Total
    if (y > 260) { doc.addPage(); y = 20; }
    y += 3;
    doc.setDrawColor(200);
    doc.line(15, y, pageW - 15, y);
    y += 5;
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.text(`VALOR TOTAL DO SERVIÇO: ${fmtMoney(laborTotal)}`, pageW - 15, y, { align: "right" });
    y += 8;

    // Observação
    doc.setFontSize(7);
    doc.setFont(undefined, "italic");
    doc.setTextColor(120);
    doc.text("Documento gerado para fins de controle interno. Não substitui a NFS-e autorizada pela Prefeitura.", 15, y);
    doc.setTextColor(0);

    return doc;
  };

  const handleDownloadNFe = async () => {
    setGeneratingNFe(true);
    try {
      const logoData = await loadLogo();
      const doc = generateNFePDF(logoData);
      if (!doc) {
        toast({ title: "Sem peças", description: "Esta OS não possui peças para gerar NF-e.", variant: "destructive" });
        setGeneratingNFe(false);
        return;
      }
      doc.save(`nfe-${order.order_number || order.id}.pdf`);
      toast({ title: "NF-e gerada", description: "PDF da NF-e baixado." });
    } catch {
      toast({ title: "Erro", description: "Não foi possível gerar a NF-e.", variant: "destructive" });
    }
    setGeneratingNFe(false);
  };

  const handleDownloadNFSe = async () => {
    setGeneratingNFSe(true);
    try {
      const logoData = await loadLogo();
      const doc = generateNFSePDF(logoData);
      if (!doc) {
        toast({ title: "Sem serviços", description: "Esta OS não possui mão de obra para gerar NFS-e.", variant: "destructive" });
        setGeneratingNFSe(false);
        return;
      }
      doc.save(`nfse-${order.order_number || order.id}.pdf`);
      toast({ title: "NFS-e gerada", description: "PDF da NFS-e baixado." });
    } catch {
      toast({ title: "Erro", description: "Não foi possível gerar a NFS-e.", variant: "destructive" });
    }
    setGeneratingNFSe(false);
  };

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const logoData = await loadLogo();
      const doc = generatePDF(logoData);
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
      const logoData = await loadLogo();
      const doc = generatePDF(logoData);
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

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleDownloadNFe} disabled={generatingNFe} className="flex-1 gap-1.5">
                {generatingNFe ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                NF-e (Peças)
              </Button>
              <Button variant="outline" onClick={handleDownloadNFSe} disabled={generatingNFSe} className="flex-1 gap-1.5">
                {generatingNFSe ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wrench className="w-3.5 h-3.5" />}
                NFS-e (Serviço)
              </Button>
            </div>

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