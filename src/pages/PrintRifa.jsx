import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Printer } from "lucide-react";
import moment from "moment";

export default function PrintRifa() {
  const { rifaId } = useParams();
  const [rangeFrom, setRangeFrom] = useState(1);
  const [rangeTo, setRangeTo] = useState(100);
  const [perPage, setPerPage] = useState(10);

  const { data: rifa } = useQuery({
    queryKey: ["rifa", rifaId],
    queryFn: () => base44.entities.Rifa.get(rifaId),
    onSuccess: (r) => {
      setRangeTo(r.total_tickets);
      setPerPage(r.tickets_per_page || 10);
    },
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ["rifa-tickets", rifaId],
    queryFn: () => base44.entities.RifaTicket.filter({ rifa_id: rifaId }, "number"),
    enabled: !!rifaId,
  });

  const ticketMap = useMemo(() => {
    const m = {};
    tickets.forEach(t => { m[t.number] = t; });
    return m;
  }, [tickets]);

  const total = rifa?.total_tickets || 100;
  const pad = (n) => String(n).padStart(String(total).length, "0");

  const selectedNumbers = useMemo(() => {
    const from = Math.max(1, Number(rangeFrom));
    const to = Math.min(total, Number(rangeTo));
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
  }, [rangeFrom, rangeTo, total]);

  // Group into pages
  const pages = useMemo(() => {
    const pp = Math.max(1, Number(perPage));
    const result = [];
    for (let i = 0; i < selectedNumbers.length; i += pp) {
      result.push(selectedNumbers.slice(i, i + pp));
    }
    return result;
  }, [selectedNumbers, perPage]);

  if (!rifa) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background">
      {/* Controls - no-print */}
      <div className="no-print sticky top-0 z-10 bg-card border-b shadow-sm p-3 flex flex-wrap items-center gap-3">
        <Link to={`/rifas/${rifaId}`}>
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <span className="font-semibold text-sm">Impressão: {rifa.name}</span>
        <div className="flex items-center gap-2 ml-4">
          <Label className="text-xs">De:</Label>
          <Input type="number" min={1} max={total} value={rangeFrom} onChange={e => setRangeFrom(e.target.value)} className="h-7 w-20 text-xs" />
          <Label className="text-xs">Até:</Label>
          <Input type="number" min={1} max={total} value={rangeTo} onChange={e => setRangeTo(e.target.value)} className="h-7 w-20 text-xs" />
          <Label className="text-xs">Por página:</Label>
          <Input type="number" min={1} max={20} value={perPage} onChange={e => setPerPage(e.target.value)} className="h-7 w-16 text-xs" />
        </div>
        <Button onClick={() => window.print()} className="gap-2 ml-auto">
          <Printer className="w-4 h-4" /> Imprimir
        </Button>
      </div>

      {/* Print area */}
      <div id="print-area">
        {pages.map((pageNumbers, pi) => (
          <div key={pi} className="print-page p-6 bg-white">
            {pageNumbers.map((num, idx) => {
              const ticket = ticketMap[num] || {};
              return (
                <div key={num} className={`flex border border-dashed border-gray-400 rounded mb-2 overflow-hidden ${idx > 0 ? "mt-2" : ""}`}
                  style={{ minHeight: "70px" }}>
                  {/* Canhoto / Stub */}
                  <div className="w-28 shrink-0 bg-gray-900 text-white flex flex-col items-center justify-center px-2 py-2 border-r-2 border-dashed border-gray-400">
                    <p className="text-xs font-semibold opacity-70 uppercase tracking-wide">Nº</p>
                    <p className="text-3xl font-black font-mono leading-none">{pad(num)}</p>
                    <p className="text-xs opacity-70 mt-1">R$ {Number(rifa.ticket_price || 0).toFixed(2)}</p>
                  </div>

                  {/* Body */}
                  <div className="flex-1 px-4 py-2 flex flex-col justify-center">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-bold text-base leading-tight">{rifa.name}</p>
                        {rifa.prize && <p className="text-sm text-gray-600 mt-0.5">🏆 {rifa.prize}</p>}
                        {rifa.description && <p className="text-xs text-gray-500 mt-0.5">{rifa.description}</p>}
                      </div>
                      <div className="text-right text-xs text-gray-500 shrink-0">
                        {rifa.event_date && <p>📅 {moment(rifa.event_date).format("DD/MM/YYYY")}</p>}
                        {rifa.event_location && <p>📍 {rifa.event_location}</p>}
                        {rifa.organizer_name && <p>👤 {rifa.organizer_name}</p>}
                        {rifa.organizer_phone && <p>📞 {rifa.organizer_phone}</p>}
                      </div>
                    </div>

                    {/* Buyer fields */}
                    <div className="mt-2 flex gap-4 text-xs">
                      <div className="flex-1">
                        <span className="text-gray-400">Nome: </span>
                        <span className="font-medium">{ticket.buyer_name || "_______________________________"}</span>
                      </div>
                      <div className="flex-1">
                        <span className="text-gray-400">Tel: </span>
                        <span className="font-medium">{ticket.buyer_phone || "____________________"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Ticket stub (right side - to keep) */}
                  <div className="w-28 shrink-0 bg-gray-100 border-l-2 border-dashed border-gray-400 flex flex-col items-center justify-center px-2 py-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nº</p>
                    <p className="text-3xl font-black font-mono text-gray-800 leading-none">{pad(num)}</p>
                    <p className="text-xs text-gray-500 mt-1 text-center leading-tight">{rifa.name}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}