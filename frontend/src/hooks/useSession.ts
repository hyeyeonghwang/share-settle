import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { api } from "@/services";
import type { User } from "@/domain/types";

export function useSession() {
  return useQuery<User | null>({
    queryKey: ["session"],
    queryFn: () => api.getCurrentUser(),
    staleTime: Infinity,
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await queryClient.cancelQueries();
    await api.signOut();
    queryClient.clear();
    navigate({ to: "/", replace: true });
  };
}
