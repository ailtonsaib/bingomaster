import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import jsPDF from 'npm:jspdf@4.2.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all sellers
    const sellers = await base44.entities.Seller.list();
    
    // Fetch all cards
    const allCards = await base44.entities.BingoCard.filter({});

    // Calculate distributed cards per seller (by phone or city match)
    const sellerStats = sellers.map((seller) => {
      const distributedCards = allCards.filter(
        (c) => c.player_phone === seller.phone || c.player_city === seller.city
      );
      const soldCards = distributedCards.filter(
        (c) => c.player_name && c.player_name.trim() !== ''
      );
      return {
        seller,
        distributedCount: distributedCards.length,
        soldCount: soldCards.length,
      };
    });

    // Calculate totals
    const totalDistributed = allCards.filter((c) => c.player_phone || c.player_city).length;
    const totalSold = allCards.filter((c) => c.player_name && c.player_name.trim() !== '').length;
    const totalCards = allCards.length;

    // Create PDF
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.setTextColor(40);
    doc.text('Relatório de Distribuição de Cartelas', 20, 20);
    
    // Date
    doc.setFontSize(10);
    doc.setTextColor(100);
    const currentDate = new Date().toLocaleDateString('pt-BR');
    doc.text(`Gerado em: ${currentDate}`, 20, 30);
    
    // Summary section
    doc.setFontSize(12);
    doc.setTextColor(40);
    doc.text('Resumo Geral', 20, 45);
    
    doc.setFontSize(10);
    doc.text(`Total de Cartelas no Sistema: ${totalCards}`, 25, 55);
    doc.text(`Total de Cartelas Distribuídas/Vendidas: ${totalDistributed}`, 25, 62);
    doc.text(`Total de Cartelas Validadas (com nome): ${totalSold}`, 25, 69);
    
    // Seller details section
    doc.setFontSize(12);
    doc.text('Detalhes por Vendedor', 20, 85);
    
    let yPos = 95;
    const pageHeight = doc.internal.pageSize.height;
    const bottomMargin = 20;
    
    sellerStats.forEach((stat, index) => {
      // Check if we need a new page
      if (yPos > pageHeight - bottomMargin - 30) {
        doc.addPage();
        yPos = 30;
        doc.setFontSize(12);
        doc.text('Detalhes por Vendedor (continuação)', 20, 20);
        yPos = 35;
      }
      
      // Seller info
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`${index + 1}. ${stat.seller.name}`, 25, yPos);
      yPos += 6;
      
      doc.setFont('helvetica', 'normal');
      doc.text(`Telefone: ${stat.seller.phone || 'N/A'}`, 30, yPos);
      yPos += 5;
      
      if (stat.seller.city) {
        doc.text(`Cidade: ${stat.seller.city} - ${stat.seller.state || 'N/A'}`, 30, yPos);
        yPos += 5;
      }
      
      // Stats
      doc.setFont('helvetica', 'bold');
      doc.text(`Cartelas Distribuídas: ${stat.distributedCount}`, 30, yPos);
      yPos += 5;
      
      doc.text(`Cartelas Vendidas: ${stat.soldCount}`, 30, yPos);
      yPos += 10;
    });
    
    // Footer
    const finalPageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= finalPageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Página ${i} de ${finalPageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    }

    // Convert to base64 for JSON response
    const pdfBytes = doc.output('arraybuffer');
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

    return Response.json({ pdf: pdfBase64 });
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});