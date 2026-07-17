import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Clock, Gift, Candy, Sparkles, FileDown, Printer, Mail } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function BingoInvitationCard({ game }) {
  const eventDate = game.event_date ? new Date(game.event_date) : null;
  const prizes = (game.prizes || []).slice(0, 5);

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-primary/10 flex flex-col">
      {/* Header */}
      <div className="relative px-5 py-6 text-center text-white overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1530023367847-a683933f4172?w=800&q=80"
          alt="Bingo"
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/85 via-primary/80 to-purple-900/85" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.2),transparent_50%)]" />
        <div className="relative">
          <p className="text-[10px] font-medium uppercase tracking-widest opacity-90">Vocês estão convidados a participar da</p>
          <h3 className="text-xl font-bold font-heading mt-1">{game.name}</h3>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4 flex-1 flex flex-col">
        {/* Date & Time */}
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Calendar className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">Data e Hora</p>
            {eventDate ? (
              <>
                <p className="text-sm font-bold text-foreground capitalize">
                  {format(eventDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {format(eventDate, "HH:mm", { locale: ptBR })}h
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground italic">Data a definir</p>
            )}
          </div>
        </div>

        {/* Location */}
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <MapPin className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">Local</p>
            <p className="text-sm font-bold text-foreground">{game.event_location || "A definir"}</p>
            {game.event_address && (
              <p className="text-xs text-muted-foreground">{game.event_address}</p>
            )}
          </div>
        </div>

        {/* Prizes */}
        <div className="rounded-xl bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 p-3 flex-1">
          <div className="flex items-center gap-1.5 mb-2">
            <Gift className="w-4 h-4 text-amber-600" />
            <p className="text-[10px] font-bold uppercase text-amber-800 tracking-wide">Prêmios</p>
          </div>
          {prizes.length > 0 ? (
            <ul className="space-y-1.5">
              {prizes.map((prize, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-amber-900 text-xs leading-tight">{prize.name}</p>
                    {prize.description && (
                      <p className="text-[10px] text-amber-700 leading-tight">{prize.description}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-amber-600 italic">Prêmios a definir</p>
          )}
        </div>

        {/* Treats (if any) */}
        {game.event_treats && game.event_treats.length > 0 && (
          <div className="rounded-xl bg-gradient-to-br from-pink-50 to-rose-50 border border-pink-200 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Candy className="w-4 h-4 text-pink-600" />
              <p className="text-[10px] font-bold uppercase text-pink-800 tracking-wide">Guloseimas</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {game.event_treats.map((treat, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-white border border-pink-200 text-[10px] text-pink-700 font-medium">
                  {treat}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Price */}
        {game.event_price && (
          <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/10 p-2.5">
            <Sparkles className="w-4 h-4 text-primary" />
            <div>
              <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">Cartela</p>
              <p className="text-base font-bold text-primary">{game.event_price}</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer action */}
      <div className="px-5 py-3 border-t border-muted bg-muted/30">
        <Link to="/convite">
          <Button size="sm" variant="outline" className="w-full gap-1.5">
            <Mail className="w-3.5 h-3.5" /> Editar / Imprimir Convite
          </Button>
        </Link>
      </div>
    </div>
  );
}