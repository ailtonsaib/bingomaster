import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Car,
  ChevronDown,
  AlertTriangle,
  AlertCircle,
  Info,
  Wrench,
  Calendar,
  TrendingUp,
  ClipboardList,
  ArrowLeft,
  Search,
} from "lucide-react";

const URGENCY_CONFIG = {
  alta: { label: "Alta", color: "#EF4444", bg: "#FEE2E2", icon: AlertTriangle },
  media: { label: "Média", color: "#F59E0B", bg: "#FEF3C7", icon: AlertCircle },
  baixa: { label: "Baixa", color: "#22C55E", bg: "#DCFCE7", icon: Info },
};

const PROBABILITY_CONFIG = {
  alta: { label: "Alta", color: "#EF4444", bg: "#FEE2E2" },
  media: { label: "Média", color: "#F59E0B", bg: "#FEF3C7" },
  baixa: { label: "Baixa", color: "#22C55E", bg: "#DCFCE7" },
};

function vehicleKey(rec) {
  const plate = rec.vehicle_plate || "";
  return `${rec.vehicle_brand}|${rec.vehicle_model}|${rec.vehicle_year || ""}|${plate}`.toLowerCase();
}

function vehicleLabel(rec) {
  return `${rec.vehicle_brand} ${rec.vehicle_model}`.trim();
}

function vehicleSubInfo(rec) {
  const parts = [];
  if (rec.vehicle_year) parts.push(rec.vehicle_year);
  if (rec.vehicle_engine) parts.push(rec.vehicle_engine);
  if (rec.vehicle_plate) parts.push(rec.vehicle_plate);
  return parts.join(" • ");
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateShort(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function groupByVehicle(records) {
  const map = new Map();
  for (const rec of records) {
    const key = vehicleKey(rec);
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: vehicleLabel(rec),
        subInfo: vehicleSubInfo(rec),
        brand: rec.vehicle_brand,
        model: rec.vehicle_model,
        year: rec.vehicle_year,
        engine: rec.vehicle_engine,
        plate: rec.vehicle_plate || "",
        fuel: rec.vehicle_fuel,
        diagnostics: [],
      });
    }
    map.get(key).diagnostics.push(rec);
  }
  // Sort diagnostics within each vehicle by date desc
  for (const v of map.values()) {
    v.diagnostics.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  }
  // Sort vehicles by most recent diagnostic
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.diagnostics[0].created_date) - new Date(a.diagnostics[0].created_date)
  );
}

function aggregateCauses(diagnostics) {
  const causeMap = new Map();
  for (const diag of diagnostics) {
    for (const c of diag.possible_causes || []) {
      const text = c.cause || "—";
      const entry = causeMap.get(text) || { text, count: 0, probabilities: [] };
      entry.count++;
      if (c.probability) entry.probabilities.push(c.probability);
      causeMap.set(text, entry);
    }
  }
  return Array.from(causeMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function aggregateSymptoms(diagnostics) {
  const symMap = new Map();
  for (const diag of diagnostics) {
    for (const s of diag.symptoms || []) {
      symMap.set(s, (symMap.get(s) || 0) + 1);
    }
  }
  return Array.from(symMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([text, count]) => ({ text, count }));
}

function UrgencyBar({ diagnostics }) {
  const counts = { alta: 0, media: 0, baixa: 0 };
  for (const d of diagnostics) {
    if (counts[d.urgency] !== undefined) counts[d.urgency]++;
  }
  const total = diagnostics.length || 1;

  return (
    <div className="flex items-center gap-1.5">
      {Object.entries(counts).map(([level, count]) => {
        const cfg = URGENCY_CONFIG[level];
        const pct = (count / total) * 100;
        return (
          <div key={level} className="flex items-center gap-1" title={`${cfg.label}: ${count}`}>
            <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, backgroundColor: cfg.color }}
              />
            </div>
            <span className="text-[10px] font-semibold" style={{ color: cfg.color }}>
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function VehicleCard({ vehicle, onOpen }) {
  const diags = vehicle.diagnostics;
  const lastDiag = diags[0];
  const recurringCauses = aggregateCauses(diags).filter((c) => c.count > 1);
  const topSymptoms = aggregateSymptoms(diags);
  const cfg = lastDiag?.urgency ? URGENCY_CONFIG[lastDiag.urgency] : URGENCY_CONFIG.baixa;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-gray-100 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)] transition-shadow cursor-pointer group"
      onClick={() => onOpen(vehicle)}
    >
      {/* Header */}
      <div className="p-5 border-b border-gray-50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-[#DBEAFE] flex items-center justify-center shrink-0">
              <Car className="w-5 h-5 text-[#2563EB]" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-[#1B1C21] text-sm truncate">
                {vehicle.label}
              </h3>
              <p className="text-xs text-[#71717A] truncate">{vehicle.subInfo || "Sem detalhes"}</p>
            </div>
          </div>
          <div
            className="shrink-0 px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1"
            style={{ backgroundColor: cfg.bg, color: cfg.color }}
          >
            <cfg.icon className="w-3 h-3" />
            {diags.length} {diags.length === 1 ? "diagnóstico" : "diagnósticos"}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[#A1A1AA] flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Último
          </span>
          <span className="text-xs font-medium text-[#1B1C21]">
            {formatDate(lastDiag?.created_date)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[#A1A1AA] flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Urgência
          </span>
          <UrgencyBar diagnostics={diags} />
        </div>

        {topSymptoms.length > 0 && (
          <div>
            <span className="text-[11px] text-[#A1A1AA] flex items-center gap-1 mb-1.5">
              <ClipboardList className="w-3 h-3" /> Sintomas frequentes
            </span>
            <div className="flex flex-wrap gap-1">
              {topSymptoms.slice(0, 3).map((s) => (
                <span
                  key={s.text}
                  className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-[#52525B]"
                >
                  {s.text} {s.count > 1 && `(${s.count})`}
                </span>
              ))}
            </div>
          </div>
        )}

        {recurringCauses.length > 0 && (
          <div className="flex items-start gap-1.5 p-2 rounded-lg bg-amber-50 border border-amber-100">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
            <span className="text-[11px] text-amber-700">
              <strong>{recurringCauses.length}</strong> defeito{recurringCauses.length > 1 ? "s" : ""} recorrente{recurringCauses.length > 1 ? "s" : ""} detectado{recurringCauses.length > 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 bg-gray-50/50 flex items-center justify-between">
        <span className="text-[11px] text-[#A1A1AA]">Ver histórico completo</span>
        <ChevronDown className="w-4 h-4 text-[#2563EB] group-hover:translate-y-0.5 transition-transform" />
      </div>
    </motion.div>
  );
}

function DiagnosticTimelineItem({ diag, onSelect }) {
  const cfg = URGENCY_CONFIG[diag.urgency] || URGENCY_CONFIG.baixa;
  const causes = (diag.possible_causes || []).slice(0, 3);

  return (
    <div className="relative pl-8 pb-6 last:pb-0">
      {/* Timeline dot */}
      <div
        className="absolute left-0 top-1 w-4 h-4 rounded-full border-2 border-white shadow-sm"
        style={{ backgroundColor: cfg.color }}
      />
      {/* Vertical line */}
      <div className="absolute left-[7px] top-5 bottom-0 w-px bg-gray-100" />

      <div className="rounded-xl border border-gray-100 bg-white p-4 hover:border-gray-200 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[#A1A1AA]">
            {formatDate(diag.created_date)}
          </span>
          <span
            className="px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1"
            style={{ backgroundColor: cfg.bg, color: cfg.color }}
          >
            <cfg.icon className="w-3 h-3" /> {cfg.label}
          </span>
        </div>

        {diag.summary && (
          <p className="text-sm text-[#1B1C21] mb-2 leading-relaxed">{diag.summary}</p>
        )}

        {diag.symptoms?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {diag.symptoms.slice(0, 4).map((s, i) => (
              <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-[#52525B]">
                {s}
              </span>
            ))}
            {diag.symptoms.length > 4 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-[#A1A1AA]">
                +{diag.symptoms.length - 4}
              </span>
            )}
          </div>
        )}

        {causes.length > 0 && (
          <div className="space-y-1 mt-2">
            {causes.map((c, i) => {
              const pCfg = PROBABILITY_CONFIG[c.probability] || PROBABILITY_CONFIG.baixa;
              return (
                <div key={i} className="flex items-start gap-2">
                  <Wrench className="w-3 h-3 text-[#A1A1AA] shrink-0 mt-0.5" />
                  <span className="text-xs text-[#52525B] flex-1">{c.cause}</span>
                  <span
                    className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                    style={{ backgroundColor: pCfg.bg, color: pCfg.color }}
                  >
                    {pCfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {diag.general_recommendation && (
          <p className="text-xs text-[#71717A] mt-2 italic border-l-2 border-gray-100 pl-2">
            {diag.general_recommendation}
          </p>
        )}

        {onSelect && (
          <button
            onClick={() => onSelect(diag)}
            className="mt-3 text-xs text-[#2563EB] hover:underline font-medium"
          >
            Carregar no painel →
          </button>
        )}
      </div>
    </div>
  );
}

function VehicleDetail({ vehicle, onBack, onSelectDiagnostic }) {
  const recurringCauses = aggregateCauses(vehicle.diagnostics).filter((c) => c.count > 1);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-5"
    >
      {/* Back + vehicle header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-[#52525B]">
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#DBEAFE] flex items-center justify-center shrink-0">
            <Car className="w-7 h-7 text-[#2563EB]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-[#1B1C21] text-lg">{vehicle.label}</h2>
            <p className="text-sm text-[#71717A]">{vehicle.subInfo}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-[#A1A1AA]">
                <strong className="text-[#1B1C21]">{vehicle.diagnostics.length}</strong> diagnósticos
              </span>
              <span className="text-xs text-[#A1A1AA]">
                Desde <strong className="text-[#1B1C21]">{formatDateShort(vehicle.diagnostics[vehicle.diagnostics.length - 1]?.created_date)}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Recurring causes alert */}
        {recurringCauses.length > 0 && (
          <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-bold text-amber-700">Defeitos recorrentes</span>
            </div>
            <div className="space-y-1.5">
              {recurringCauses.map((c, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-xs text-amber-700">{c.text}</span>
                  <span className="text-xs font-bold text-amber-700">
                    {c.count}x
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-[#1B1C21] mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#2563EB]" /> Linha do tempo
        </h3>
        <div>
          {vehicle.diagnostics.map((diag) => (
            <DiagnosticTimelineItem
              key={diag.id}
              diag={diag}
              onSelect={onSelectDiagnostic}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export default function VehicleHistoryPanel({ records, onSelectDiagnostic, onBack }) {
  const [search, setSearch] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [filterUrgency, setFilterUrgency] = useState("all");

  const vehicles = useMemo(() => groupByVehicle(records), [records]);

  const filteredVehicles = useMemo(() => {
    let result = vehicles;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (v) =>
          v.label.toLowerCase().includes(q) ||
          v.plate.toLowerCase().includes(q) ||
          v.subInfo.toLowerCase().includes(q)
      );
    }
    if (filterUrgency !== "all") {
      result = result.filter((v) =>
        v.diagnostics.some((d) => d.urgency === filterUrgency)
      );
    }
    return result;
  }, [vehicles, search, filterUrgency]);

  const totalDiagnostics = records.length;
  const urgentCount = records.filter((r) => r.urgency === "alta").length;

  if (selectedVehicle) {
    return (
      <div className="min-h-screen bg-[#FAFAFB]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          <VehicleDetail
            vehicle={selectedVehicle}
            onBack={() => setSelectedVehicle(null)}
            onSelectDiagnostic={(diag) => {
              onSelectDiagnostic?.(diag);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFB]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack} className="text-[#52525B]">
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-2xl font-bold text-[#1B1C21]">{vehicles.length}</div>
              <div className="text-[10px] text-[#A1A1AA] uppercase tracking-wide">veículos</div>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="text-right">
              <div className="text-2xl font-bold text-[#1B1C21]">{totalDiagnostics}</div>
              <div className="text-[10px] text-[#A1A1AA] uppercase tracking-wide">diagnósticos</div>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="text-right">
              <div className="text-2xl font-bold text-red-500">{urgentCount}</div>
              <div className="text-[10px] text-[#A1A1AA] uppercase tracking-wide">urgentes</div>
            </div>
          </div>
        </div>

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A1A1AA]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por marca, modelo ou placa..."
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-gray-200 bg-white text-sm text-[#1B1C21] placeholder:text-[#A1A1AA] focus:outline-none focus:border-[#2563EB]/40 focus:ring-2 focus:ring-[#2563EB]/10"
            />
          </div>
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
            {[
              { val: "all", label: "Todos" },
              { val: "alta", label: "Alta" },
              { val: "media", label: "Média" },
              { val: "baixa", label: "Baixa" },
            ].map((f) => (
              <button
                key={f.val}
                onClick={() => setFilterUrgency(f.val)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filterUrgency === f.val
                    ? "bg-white text-[#2563EB] shadow-sm"
                    : "text-[#71717A] hover:text-[#52525B]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Vehicle grid */}
        {filteredVehicles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence>
              {filteredVehicles.map((v) => (
                <VehicleCard key={v.key} vehicle={v} onOpen={setSelectedVehicle} />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Car className="w-8 h-8 text-[#A1A1AA]" />
            </div>
            <h3 className="font-bold text-[#1B1C21] mb-1">
              {search || filterUrgency !== "all" ? "Nenhum veículo encontrado" : "Nenhum diagnóstico ainda"}
            </h3>
            <p className="text-sm text-[#71717A] max-w-xs">
              {search || filterUrgency !== "all"
                ? "Tente ajustar a busca ou os filtros."
                : "Realize o primeiro diagnóstico para visualizar o histórico por veículo."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}