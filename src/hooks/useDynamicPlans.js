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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPlans() {
      try {
        const [bingo, sped, appPlans] = await Promise.all([
          base44.entities.PlanConfig.list(),
          base44.entities.SpedPlanConfig.list(),
          base44.entities.AppPlanConfig.list(),
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
        description: p.description || "",
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

  return {
    bingoPlans: mappedBingoPlans.length ? mappedBingoPlans : null,
    spedPlans: mappedSpedPlans.length ? mappedSpedPlans : null,
    financePlans: mappedFinancePlans.length ? mappedFinancePlans : null,
    loading,
  };
}