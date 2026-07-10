import { useAuth } from "@/lib/AuthContext";

/**
 * Hook que fornece o ID do usuário atual e helpers para filtrar
 * queries por created_by_id, garantindo isolamento de dados entre usuários.
 */
export function useUserScope() {
  const { user, isLoading } = useAuth();
  const userId = user?.id;
  return {
    userId,
    isLoading,
    enabled: !!userId,
    /** Adiciona created_by_id a qualquer filtro de entidade */
    scope: (filter = {}) => ({ ...filter, created_by_id: userId }),
  };
}