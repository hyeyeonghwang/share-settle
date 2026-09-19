import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/services";
import { AppShell } from "@/components/AppShell";
import { ClientOnly } from "@/components/ClientOnly";
import { EmptyNote, Eyebrow, PageHeader } from "@/components/ui-bits";
import { useRequiredSession } from "@/hooks/useSession";

export const Route = createFileRoute("/join/$code")({
  head: () => ({
    meta: [
      { title: "Join an event — Split Table" },
      {
        name: "description",
        content: "Review the event behind this invitation and join it with one tap.",
      },
      { property: "og:title", content: "Join an event — Split Table" },
      {
        property: "og:description",
        content: "An invitation to share expenses for a group event.",
      },
    ],
  }),
  component: () => (
    <AppShell subtitle="Invitation">
      <ClientOnly>
        <JoinBody />
      </ClientOnly>
    </AppShell>
  ),
});

function JoinBody() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user } = useRequiredSession();

  const preview = useQuery({
    queryKey: ["invite", code],
    queryFn: () => api.previewInvite(code),
    enabled: Boolean(user),
  });

  const join = useMutation({
    mutationFn: () => api.joinEvent(code),
    onSuccess: async (event) => {
      await queryClient.invalidateQueries();
      navigate({ to: "/events/$eventId", params: { eventId: event.id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!user) return null;
  if (preview.isLoading) return <EmptyNote>Checking invitation…</EmptyNote>;
  if (preview.error) return <EmptyNote>{(preview.error as Error).message}</EmptyNote>;
  if (!preview.data) return null;

  const { event, memberCount, alreadyMember } = preview.data;

  return (
    <div className="ledger-enter max-w-xl space-y-10">
      <PageHeader eyebrow="Invitation" title={event.name} backTo="/events" backLabel="My events" />
      <div className="rounded-2xl border border-line p-6">
        <Eyebrow>Event</Eyebrow>
        <p className="mt-3 font-mono text-sm text-muted-foreground">
          {memberCount} participants • {event.currency} •{" "}
          {event.status === "ACTIVE" ? "active" : "completed"}
        </p>
        <p className="num mt-4 text-2xl tracking-[0.3em]">{event.inviteCode}</p>
        <button
          onClick={() => join.mutate()}
          disabled={join.isPending}
          className="mt-6 h-12 w-full rounded-xl bg-ink font-semibold text-paper transition-all hover:bg-ink/90 active:scale-[0.98] disabled:opacity-60"
        >
          {alreadyMember ? "Open event" : "Join event"}
        </button>
      </div>
    </div>
  );
}
