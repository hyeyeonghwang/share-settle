import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { api } from "@/services";
import { AppShell } from "@/components/AppShell";
import { ClientOnly } from "@/components/ClientOnly";
import { EmptyNote, Initial, PageHeader } from "@/components/ui-bits";
import { useSession } from "@/hooks/useSession";
import type { MemberStatus } from "@/domain/types";

export const Route = createFileRoute("/events/$eventId/members")({
  head: () => ({
    meta: [
      { title: "Participants — Split Table" },
      {
        name: "description",
        content:
          "Everyone taking part in this event, with active and inactive status kept for history.",
      },
      { property: "og:title", content: "Participants — Split Table" },
      {
        property: "og:description",
        content: "Manage who is active in this shared event without losing past records.",
      },
    ],
  }),
  component: () => (
    <AppShell subtitle="Participants">
      <ClientOnly>
        <MembersBody />
      </ClientOnly>
    </AppShell>
  ),
});

function MembersBody() {
  const { eventId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user, isLoading: sessionLoading } = useSession();

  useEffect(() => {
    if (!sessionLoading && !user) navigate({ to: "/", replace: true });
  }, [user, sessionLoading, navigate]);

  const detail = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => api.getEvent(eventId),
    enabled: Boolean(user),
  });

  const setStatus = useMutation({
    mutationFn: (vars: { userId: string; status: MemberStatus }) =>
      api.setMemberStatus(eventId, vars.userId, vars.status),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Participant updated.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!user) return null;
  if (detail.isLoading) return <EmptyNote>Loading participants…</EmptyNote>;
  if (detail.error) return <EmptyNote>{(detail.error as Error).message}</EmptyNote>;
  if (!detail.data) return null;

  const { event, members, isCreator } = detail.data;

  return (
    <div className="ledger-enter space-y-12">
      <PageHeader
        eyebrow={event.name}
        title="Participants"
        backTo="/events/$eventId"
        backLabel="Back to event"
        backParams={{ eventId }}
      />

      <div className="max-w-3xl divide-y divide-line overflow-hidden rounded-2xl border border-line">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between gap-4 px-6 py-5"
          >
            <span className="flex items-center gap-3">
              <Initial user={member.user} />
              <span>
                <span className="block font-semibold">
                  {member.user.displayName}
                  {member.isCreator ? (
                    <span className="ml-2 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                      Creator
                    </span>
                  ) : null}
                </span>
                <span className="block font-mono text-[11px] text-muted-foreground">
                  {member.user.email}
                </span>
              </span>
            </span>
            <span className="flex items-center gap-4">
              <span className="font-mono text-[10px] tracking-widest uppercase">
                {member.status === "ACTIVE" ? (
                  <span className="text-receive">Active</span>
                ) : (
                  <span className="text-muted-foreground">Inactive</span>
                )}
              </span>
              {isCreator && !member.isCreator ? (
                <button
                  onClick={() =>
                    setStatus.mutate({
                      userId: member.userId,
                      status: member.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                    })
                  }
                  disabled={setStatus.isPending}
                  className="h-10 rounded-lg border border-line px-4 text-sm font-medium transition-colors hover:bg-fill disabled:opacity-60"
                >
                  {member.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
                </button>
              ) : null}
            </span>
          </div>
        ))}
      </div>

      <p className="max-w-3xl font-mono text-[11px] text-muted-foreground">
        Inactive participants keep every past expense and settlement entry. They are
        simply left out of the default list when a new expense is added.
      </p>
    </div>
  );
}
