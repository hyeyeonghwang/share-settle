import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { api } from "@/services";
import type { User } from "@/domain/types";

export function useSession() {
  return useQuery<User | null>({
    queryKey: ["session"],
    queryFn: () => api.getCurrentUser(),
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useRequiredSession() {
  const session = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!session.isFetching && !session.data) {
      navigate({ to: "/", replace: true });
    }
  }, [navigate, session.data, session.isFetching]);

  return session;
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
