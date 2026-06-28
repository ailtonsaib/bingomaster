import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export function useRegulation() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["app-setting-regulation"],
    queryFn: async () => {
      const settings = await base44.entities.Setting.list();
      return settings[0]?.regulation || "";
    },
    staleTime: 60000,
  });

  const setRegulation = async (regulation) => {
    const settings = await base44.entities.Setting.list();
    if (settings.length > 0) {
      await base44.entities.Setting.update(settings[0].id, { regulation });
    } else {
      await base44.entities.Setting.create({ brand_name: "BINGO", regulation });
    }
    queryClient.invalidateQueries({ queryKey: ["app-setting-regulation"] });
  };

  return { regulation: data || "", isLoading, setRegulation };
}