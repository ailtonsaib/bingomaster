import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileDown, X, Loader2, FileText } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import jsPDF from "jsPDF";

const fmtMoney = (v) => `R$ ${parseFloat(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

const STATUS_LABELS = {
  aberta: "Aberta",
  em_andamento: "Em Andamento",
  aguardando_pecas: "Aguardando Peças",
  concluida: "Concluída",
  entregue: "Entregue",
  cancelada: "Cancelada",
};

const PRIORITY_LABELS = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

const fmtCnpj = (c) => (c ? c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : "—");
const fmtCpf = (c) => {
  if (!c) return "—";
  if (c.length === 11) return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return fmtCnpj(c);
};

export default function ServiceReportPDF({ order, companyConfig, onClose }) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);

  const reportNumber = `REL-${order.order_number || (order.id || "").slice(-6).toUpperCase()}`;
  const now = new Date();

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
    const pageH = 297;
    const marginL = 15;
    const marginR = pageW - 15;
    let y = 15;

    // === CABEÇALHO DA EMPRESA ===
    if (logoData) {
      try { doc.addImage(logoData, "PNG", marginL, 12, 20, 20); } catch { /* ignore */ }
    }

    const headerX = logoData ? 40 : marginL;

    doc.setFontSize(15);
    doc.setFont(undefined, "bold");
    doc.text(companyConfig?.razao_social || "Oficina", headerX, y);
    y += 6;

    doc.setFontSize(8);
    doc.setFont(undefined, "normal");
    if (companyConfig?.nome_fantasia) {
      doc.text(`Nome Fantasia: ${companyConfig.nome_fantasia}`, headerX, y); y += 4;
    }
    if (companyConfig?.cnpj) {
      doc.text(`CNPJ: ${fmtCnpj(companyConfig.cnpj)}`, headerX, y); y += 4;
    }
    if (companyConfig?.ie) {
      doc.text(`Inscrição Estadual: ${companyConfig.ie}`, headerX, y); y += 4;
    }
    const addrParts = [companyConfig?.address, companyConfig?.number, companyConfig?.district].filter(Boolean);
    if (addrParts.length) {
      doc.text(addrParts.join(", "), headerX, y); y += 4;
    }
    const cityParts = [companyConfig?.city, companyConfig?.uf, companyConfig?.cep && `CEP: ${companyConfig.cep}`].filter(Boolean);
    if (cityParts.length) {
      doc.text(cityParts.join(" - "), headerX, y); y += 4;
    }
    const contactParts = [
      companyConfig?.phone && `Tel: ${companyConfig.phone}`,
      companyConfig?.email,
    ].filter(Boolean);
    if (contactParts.length) {
      doc.text(contactParts.join(" | "), headerX, y); y += 4;
    }

    // Box de identificação do relatório (canto superior direito)
    const boxX = pageW - 70;
    const boxY = 12;
    doc.setFillColor(30, 30, 30);
    doc.rect(boxX, boxY, 55, 24, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.text("RELATÓRIO DE", boxX + 27.5, boxY + 7, { align: "center" });
    doc.text("SERVIÇO", boxX + 27.5, boxY + 13, { align: "center" });
    doc.setFontSize(8);
    doc.setFont(undefined, "normal");
    doc.text(`Nº ${reportNumber}`, boxX + 27.5, boxY + 19, { align: "center" });
    doc.setTextColor(0, 0, 0);

    // Resetar Y para depois do box
    y = Math.max(y, boxY + 24 + 5);

    // Linha separadora
    doc.setDrawColor(200);
    doc.line(marginL, y, marginR, y);
    y += 8;

    // === DADOS DO CLIENTE ===
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.setFillColor(240, 240, 240);
    doc.rect(marginL, y - 4, pageW - 30, 6, "F");
    doc.text("DADOS DO CLIENTE", marginL + 2, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    doc.text(`Nome: ${order.client_name || "—"}`, marginL, y); y += 5;
    if (order.client_cpf_cnpj) {
      doc.text(`CPF/CNPJ: ${fmtCpf(order.client_cpf_cnpj)}`, marginL, y); y += 5;
    }
    if (order.client_phone) {
      doc.text(`Telefone: ${order.client_phone}`, marginL, y); y += 5;
    }
    y += 3;

    // === DADOS DO VEÍCULO ===
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.setFillColor(240, 240, 240);
    doc.rect(marginL, y - 4, pageW - 30, 6, "F");
    doc.text("DADOS DO VEÍCULO", marginL + 2, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    const vehicleLine1 = `Marca: ${order.vehicle_brand || "—"}`;
    const vehicleLine2 = `Ano: ${order.vehicle_year || "—"}`;
    const vehicleLine3 = `Cor: ${order.vehicle_color || "—"}`;
    doc.text(vehicleLine1, marginL, y);
    doc.text(`Modelo: ${order.vehicle_model || "—"}`, 95, y);
    y += 5;
    doc.text(`Placa: ${order.vehicle_plate || "—"}`, marginL, y);
    doc.text(vehicleLine2, 95, y);
    y += 5;
    if (order.vehicle_mileage !== undefined && order.vehicle_mileage !== null) {
      doc.text(`KM: ${Number(order.vehicle_mileage).toLocaleString("pt-BR")}`, marginL, y);
    }
    doc.text(vehicleLine3, 95, y);
    y += 5;
    y += 3;

    // === DADOS DA ORDEM DE SERVIÇO ===
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.setFillColor(240, 240, 240);
    doc.rect(marginL, y - 4, pageW - 30, 6, "F");
    doc.text("DADOS DA ORDEM DE SERVIÇO", marginL + 2, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    doc.text(`Número: ${order.order_number || "—"}`, marginL, y);
    doc.text(`Status: ${STATUS_LABELS[order.status] || order.status || "—"}`, 95, y);
    y += 5;
    doc.text(`Prioridade: ${PRIORITY_LABELS[order.priority] || order.priority || "—"}`, marginL, y);
    if (order.mechanic_name) {
      doc.text(`Mecânico: ${order.mechanic_name}`, 95, y);
    }
    y += 5;
    if (order.start_date) {
      doc.text(`Início: ${fmtDate(order.start_date)}`, marginL, y); y += 5;
    }
    if (order.completion_date) {
      doc.text(`Conclusão: ${fmtDate(order.completion_date)}`, marginL, y); y += 5;
    }
    if (order.scheduled_date) {
      doc.text(`Previsão: ${fmtDate(order.scheduled_date)}`, marginL, y); y += 5;
    }
    if (order.warranty_months) {
      doc.text(`Garantia: ${order.warranty_months} ${order.warranty_months === 1 ? "mês" : "meses"}`, marginL, y); y += 5;
    }
    y += 3;

    // === QUEIXA DO CLIENTE ===
    if (order.client_complaint) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(10);
      doc.setFont(undefined, "bold");
      doc.setFillColor(240, 240, 240);
      doc.rect(marginL, y - 4, pageW - 30, 6, "F");
      doc.text("QUEIXA DO CLIENTE", marginL + 2, y);
      y += 6;
      doc.setFontSize(9);
      doc.setFont(undefined, "normal");
      const complaintLines = doc.splitTextToSize(order.client_complaint, pageW - 30);
      complaintLines.forEach((line) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(line, marginL, y);
        y += 5;
      });
      y += 3;
    }

    // === DIAGNÓSTICO TÉCNICO ===
    if (order.technical_diagnosis) {
      if (y > 230) { doc.addPage(); y = 20; }
      doc.setFontSize(10);
      doc.setFont(undefined, "bold");
      doc.setFillColor(240, 240, 240);
      doc.rect(marginL, y - 4, pageW - 30, 6, "F");
      doc.text("DIAGNÓSTICO TÉCNICO", marginL + 2, y);
      y += 6;
      doc.setFontSize(9);
      doc.setFont(undefined, "normal");
      const diagLines = doc.splitTextToSize(order.technical_diagnosis, pageW - 30);
      diagLines.forEach((line) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(line, marginL, y);
        y += 5;
      });
      y += 3;
    }

    // === TABELA DE ITENS ===
    const items = order.items || [];
    if (items.length > 0) {
      if (y > 230) { doc.addPage(); y = 20; }
      doc.setFontSize(10);
      doc.setFont(undefined, "bold");
      doc.setFillColor(240, 240, 240);
      doc.rect(marginL, y - 4, pageW - 30, 6, "F");
      doc.text("ITENS (PEÇAS E SERVIÇOS)", marginL + 2, y);
      y += 6;

      // Cabeçalho da tabela
      doc.setFontSize(7);
      doc.setFont(undefined, "bold");
      doc.setFillColor(220, 220, 220);
      doc.rect(marginL, y - 4, pageW - 30, 5, "F");
      doc.text("Tipo", marginL + 1, y);
      doc.text("Descrição", marginL + 18, y);
      doc.text("Qtd", 130, y, { align: "right" });
      doc.text("Vl. Unit.", 160, y, { align: "right" });
      doc.text("Vl. Total", marginR, y, { align: "right" });
      y += 4;
      doc.setDrawColor(200);
      doc.line(marginL, y, marginR, y);
      y += 4;

      doc.setFont(undefined, "normal");
      doc.setFontSize(8);
      items.forEach((item) => {
        if (y > 270) { doc.addPage(); y = 20; }
        const typeLabel = item.type === "peca" ? "Peça" : "Serviço";
        doc.text(typeLabel, marginL + 1, y);
        const descLines = doc.splitTextToSize(String(item.description || "").slice(0, 80), 95);
        doc.text(descLines[0] || "", marginL + 18, y);
        doc.text(String(item.quantity || 1), 130, y, { align: "right" });
        doc.text(fmtMoney(item.unit_price || 0), 160, y, { align: "right" });
        doc.text(fmtMoney(item.total || 0), marginR, y, { align: "right" });
        y += 5;
        // Linhas adicionais da descrição
        for (let i = 1; i < descLines.length; i++) {
          if (y > 270) { doc.addPage(); y = 20; }
          doc.text(descLines[i], marginL + 18, y);
          y += 4;
        }
      });
      y += 3;
    }

    // === TOTAIS ===
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setDrawColor(200);
    doc.line(marginL, y, marginR, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    doc.text(`Total de Peças: ${fmtMoney(order.parts_total || 0)}`, marginL, y); y += 5;
    doc.text(`Total de Mão de Obra: ${fmtMoney(order.labor_total || 0)}`, marginL, y); y += 5;
    if (order.discount > 0) {
      doc.text(`Desconto: -${fmtMoney(order.discount)}`, marginL, y); y += 5;
    }
    doc.setFont(undefined, "bold");
    doc.setFontSize(11);
    doc.text(`VALOR TOTAL: ${fmtMoney(order.total || 0)}`, marginR, y, { align: "right" });
    y += 10;

    // === OBSERVAÇÕES ===
    if (order.notes) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(10);
      doc.setFont(undefined, "bold");
      doc.setFillColor(240, 240, 240);
      doc.rect(marginL, y - 4, pageW - 30, 6, "F");
      doc.text("OBSERVAÇÕES", marginL + 2, y);
      y += 6;
      doc.setFontSize(9);
      doc.setFont(undefined, "normal");
      const noteLines = doc.splitTextToSize(order.notes, pageW - 30);
      noteLines.forEach((line) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(line, marginL, y);
        y += 5;
      });
      y += 5;
    }

    // === ASSINATURAS ===
    if (y > 250) { doc.addPage(); y = 20; }
    y += 10;
    doc.setDrawColor(120);
    doc.line(marginL + 10, y, marginL + 80, y);
    doc.line(marginR - 80, y, marginR - 10, y);
    y += 5;
    doc.setFontSize(8);
    doc.setFont(undefined, "normal");
    doc.text(companyConfig?.razao_social || "Oficina", marginL + 45, y, { align: "center" });
    doc.text(order.client_name || "Cliente", marginR - 45, y, { align: "center" });

    // === RODAPÉ ===
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`Relatório gerado em ${fmtDateTime(now.toISOString())} — SoftPremier`, pageW / 2, pageH - 10, { align: "center" });
    doc.setTextColor(0);

    // Numeração de páginas
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(`Página ${i} de ${pageCount}`, marginR, pageH - 10, { align: "right" });
      doc.setTextColor(0);
    }

    return doc;
  };

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const logoData = await loadLogo();
      const doc = generatePDF(logoData);
      doc.save(`relatorio-${order.order_number || order.id}.pdf`);
      toast({ title: "Relatório gerado", description: "O PDF foi baixado." });
    } catch {
      toast({ title: "Erro", description: "Não foi possível gerar o relatório.", variant: "destructive" });
    }
    setGenerating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" />
              <h3 className="text-lg font-bold">Relatório de Serviço</h3>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="p-3 rounded-lg bg-muted border space-y-1 text-sm">
            <p><strong>OS:</strong> {order.order_number}</p>
            <p><strong>Cliente:</strong> {order.client_name}</p>
            <p><strong>Veículo:</strong> {order.vehicle_brand} {order.vehicle_model} — {order.vehicle_plate}</p>
            <p><strong>Valor Total:</strong> {fmtMoney(order.total)}</p>
          </div>

          <p className="text-sm text-muted-foreground text-center">
            Deseja gerar o relatório completo em PDF com todos os detalhes do serviço?
          </p>

          <div className="flex flex-col gap-2">
            <Button onClick={handleDownload} disabled={generating} className="gap-2">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              Baixar Relatório PDF
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