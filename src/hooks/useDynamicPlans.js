import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

/**
 * Busca planos reais do banco de dados (PlanConfig e SpedPlanConfig)
 * e mapeia para o formato usado pela Landing page.
 */
export function useDynamicPlans() {
  const [bingoPlans, setBingoPlans] = useState([]);
  const [spedPlans, setSpedPlans] = useState([]);
  const [financePlans, setFinancePlans] = useState([]);
  const [diagnosticPlans, setDiagnosticPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPlans() {
      try {
        const [bingo, sped, appPlans, diagPlans] = await Promise.all([
          base44.entities.PlanConfig.list(),
          base44.entities.SpedPlanConfig.list(),
          base44.entities.AppPlanConfig.list(),
          base44.entities.DiagnosticPlanConfig.list(),
        ]);

        // Ordena bingo por max_cards crescente e SPED por order crescente
        const sortedBingo = [...(bingo || [])].sort(
          (a, b) => (a.max_cards ?? 0) - (b.max_cards ?? 0)
        );
        const sortedSped = [...(sped || [])].sort(
          (a, b) => (a.order ?? 0) - (b.order ?? 0)
        );

        setBingoPlans(sortedBingo);
        setSpedPlans(sortedSped);
        setFinancePlans(appPlans || []);
        setDiagnosticPlans(diagPlans || []);
      } catch (_) {
        // fallback: arrays vazios, Landing usa planos do appRegistry
      } finally {
        setLoading(false);
      }
    }
    fetchPlans();
  }, []);

  /** Mapa de flags app_* → labels legíveis */
  const APP_LABELS = {
    app_generator: "Gerador",
    app_seller: "Vendedor",
    app_buyer: "Comprador",
    app_telao: "Telão",
    app_rifa: "Rifas",
  };

  /** Converte planos do banco (PlanConfig) para o formato da Landing */
  const mappedBingoPlans = bingoPlans
    .filter((p) => p.is_active !== false)
    .map((p) => {
      const apps = Object.entries(APP_LABELS)
        .filter(([key]) => p[key])
        .map(([, label]) => label);
      return {
        name: p.plan_name || p.plan_key,
        price: p.price ?? 0,
        max_cards: p.max_cards,
        apps,
        description: p.description || "",
      };
    });

  /** Converte planos do banco (SpedPlanConfig) para o formato da Landing */
  const mappedSpedPlans = spedPlans
    .filter((p) => p.is_active !== false)
    .map((p) => {
      const typeLabels = (p.sped_types || []).map((t) => {
        const map = {
          FISCAL: "Fiscal",
          CONTRIBUICOES: "Contribuições",
          ECD: "ECD",
          ECF: "ECF",
          DIMESC: "DIME-SC",
          REINF: "REINF",
        };
        return map[t] || t;
      });
      return {
        name: p.plan_name || p.plan_key,
        price: p.price ?? 0,
        downloads: p.downloads_limit,
        types: typeLabels,
        description: p.description || (p.plan_key === "free" && p.downloads_limit != null ? `${p.downloads_limit} arquivos` : ""),
      };
    });

  /** Converte planos do banco (AppPlanConfig) para o formato da Landing */
  const mappedFinancePlans = financePlans
    .filter((p) => p.app_module === "finance" && p.is_active !== false)
    .map((p) => ({
      name: p.plan_name || p.plan_key,
      price: p.price ?? 0,
      limit: p.plan_key === "free" ? "10 movimentações" : "Movimentações ilimitadas",
      description: p.description || "",
    }));

  /** Converte planos de Chamados do banco (AppPlanConfig) para o formato da Landing */
  const mappedChamadosPlans = financePlans
    .filter((p) => p.app_module === "chamados" && p.is_active !== false)
    .map((p) => ({
      name: p.plan_name || p.plan_key,
      price: p.price ?? 0,
      limit: p.plan_key === "free" ? "10 chamados" : "Chamados ilimitados",
      description: p.description || "",
    }));

  /** Converte planos do Diagnóstico Automotivo (DiagnosticPlanConfig) para o formato da Landing */
  const mappedDiagnosticPlans = diagnosticPlans
    .filter((p) => p.is_active !== false && p.plan_id !== "teste")
    .map((p) => {
      const specs = [];
      if (p.max_diagnostics < 0) specs.push("Diagnósticos ilimitados");
      else if (p.max_diagnostics > 0) specs.push(`${p.max_diagnostics} diagnósticos`);
      if (p.max_clients < 0) specs.push("Clientes ilimitados");
      else if (p.max_clients > 0) specs.push(`${p.max_clients} clientes`);
      if (p.max_vehicles < 0) specs.push("Veículos ilimitados");
      else if (p.max_vehicles > 0) specs.push(`${p.max_vehicles} veículos`);
      if (p.max_service_orders < 0) specs.push("OS ilimitadas");
      else if (p.max_service_orders > 0) specs.push(`${p.max_service_orders} ordens de serviço`);
      if (p.can_delete) specs.push("Exclusão de registros");
      if (p.acquisition_price > 0) specs.push(`Aquisição: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p.acquisition_price)}`);
      return {
        name: p.plan_name || p.plan_id,
        price: p.price ?? 0,
        acquisition_price: p.acquisition_price ?? 0,
        specs,
        description: p.description || "",
      };
    });

  return {
    bingoPlans: mappedBingoPlans.length ? mappedBingoPlans : null,
    spedPlans: mappedSpedPlans.length ? mappedSpedPlans : null,
    financePlans: mappedFinancePlans.length ? mappedFinancePlans : null,
    chamadosPlans: mappedChamadosPlans.length ? mappedChamadosPlans : null,
    diagnosticPlans: mappedDiagnosticPlans.length ? mappedDiagnosticPlans : null,
    loading,
  };
}