import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export function useBrandName() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["app-setting-brand"],
    queryFn: async () => {
      const settings = await base44.entities.Setting.list();
      return settings[0]?.brand_name || "BINGO";
    },
    staleTime: 60000,
  });

  const setBrandName = async (brandName) => {
    const settings = await base44.entities.Setting.list();
    if (settings.length > 0) {
      await base44.entities.Setting.update(settings[0].id, { brand_name: brandName });
    } else {
      await base44.entities.Setting.create({ brand_name: brandName });
    }
    queryClient.invalidateQueries({ queryKey: ["app-setting-brand"] });
  };

  return { brandName: data || "BINGO", isLoading, setBrandName };
}