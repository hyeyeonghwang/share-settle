import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/services";
import { AppShell } from "@/components/AppShell";
import { ClientOnly } from "@/components/ClientOnly";
import { EmptyNote, PageHeader } from "@/components/ui-bits";
import { ExpenseForm } from "@/components/ExpenseForm";
import { useRequiredSession } from "@/hooks/useSession";
import type { ExpenseInput } from "@/domain/types";

export const Route = createFileRoute("/events/$eventId/expenses/new")({
  head: () => ({
    meta: [
      { title: "Add an expense — Split Table" },
      {
        name: "description",
        content:
          "Record what was spent, who paid, and how the cost is shared between participants.",
      },
      { property: "og:title", content: "Add an expense — Split Table" },
      {
        property: "og:description",
        content: "Fast expense entry with equal or fixed-plus-equal splitting.",
      },
    ],
  }),
  component: () => (
    <AppShell subtitle="Add expense">
      <ClientOnly>
        <NewExpenseBody />
      </ClientOnly>
    </AppShell>
  ),
});

function NewExpenseBody() {
  const { eventId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user } = useRequiredSession();

  const detail = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => api.getEvent(eventId),
    enabled: Boolean(user),
  });

  const create = useMutation({
    mutationFn: (input: ExpenseInput) => api.createExpense(eventId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Expense saved.");
      navigate({ to: "/events/$eventId", params: { eventId } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!user) return null;
  if (detail.isLoading) return <EmptyNote>Loading event…</EmptyNote>;
  if (detail.error) return <EmptyNote>{(detail.error as Error).message}</EmptyNote>;
  if (!detail.data) return null;
  if (detail.data.event.status === "COMPLETED")
    return <EmptyNote>This event is completed and locked.</EmptyNote>;

  return (
    <div className="ledger-enter space-y-12">
      <PageHeader
        eyebrow={detail.data.event.name}
        title="Add expense"
        backTo="/events/$eventId"
        backLabel="Back to event"
        backParams={{ eventId }}
      />
      <ExpenseForm
        event={detail.data.event}
        members={detail.data.members}
        currentUserId={detail.data.currentUserId}
        submitting={create.isPending}
        onSubmit={(input) => create.mutate(input)}
      />
    </div>
  );
}
