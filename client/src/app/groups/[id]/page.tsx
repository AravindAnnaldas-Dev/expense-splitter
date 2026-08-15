"use client";

import { useState, FormEvent, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Skeleton } from "@/components/Skeleton";
import { formatMoney, toPaise } from "@/lib/money";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { Expense, Member, SettlementSuggestion } from "@/lib/types";
import {
  useGroup,
  useGroupBalances,
  useAddMember,
  useRemoveMember,
  useCreateExpense,
  useUpdateExpense,
  useDeleteExpense,
  useDeleteGroup,
  useCreateSettlement,
} from "@/hooks/useGroups";

export default function GroupDetailPage() {
  return (
    <ProtectedRoute>
      <GroupDetail />
    </ProtectedRoute>
  );
}

function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: group, isLoading } = useGroup(id);
  const { data: balanceData, isLoading: balancesLoading } = useGroupBalances(id);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteGroupOpen, setDeleteGroupOpen] = useState(false);
  const deleteGroup = useDeleteGroup();
  const createSettlement = useCreateSettlement(id);

  if (isLoading || !group) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  async function onConfirmDeleteGroup() {
    await deleteGroup.mutateAsync(id);
    router.push("/groups");
  }

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/groups"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted transition-colors duration-150 hover:text-foreground focus-visible:outline-2"
      >
        <BackIcon />
        Back to groups
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{group.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {group.members.length} member{group.members.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="flex-1 sm:flex-none" onClick={() => setMemberModalOpen(true)}>
            Add member
          </Button>
          <Button className="flex-1 sm:flex-none" onClick={() => setExpenseModalOpen(true)}>
            Add expense
          </Button>
          <button
            onClick={() => setDeleteGroupOpen(true)}
            aria-label="Delete group"
            title="Delete group"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm text-danger/80 transition-colors duration-150 hover:bg-danger/10 hover:text-danger focus-visible:outline-2"
          >
            <TrashIcon />
            <span className="hidden sm:inline">Delete group</span>
          </button>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-foreground">Members</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {group.members.map((m) => (
            <MemberChip key={m.id} groupId={id} member={m} />
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground">Balances</h2>
        {balancesLoading && <Skeleton className="mt-3 h-32" />}
        {balanceData && (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Card className="p-5">
              <h3 className="text-sm font-medium text-muted">Net balances</h3>
              <ul className="mt-3 flex flex-col gap-2">
                {balanceData.balances.map((b) => (
                  <li key={b.memberId} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{b.name}</span>
                    <span className={b.net >= 0 ? "text-success" : "text-danger"}>
                      {b.net >= 0 ? "+" : ""}
                      {formatMoney(b.net)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-5">
              <h3 className="text-sm font-medium text-muted">Suggested settlements</h3>
              {balanceData.settlements.length === 0 ? (
                <p className="mt-3 text-sm text-muted">Everyone is settled up.</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {balanceData.settlements.map((s, i) => (
                    <SettlementRow
                      key={i}
                      settlement={s}
                      onMarkSettled={() =>
                        createSettlement.mutate({ fromId: s.from.memberId, toId: s.to.memberId, amount: s.amount })
                      }
                      loading={createSettlement.isPending}
                    />
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground">Expenses</h2>
        {group.expenses?.length === 0 ? (
          <Card className="mt-3 flex flex-col items-center gap-1 py-12 text-center">
            <p className="font-medium text-foreground">No expenses yet</p>
            <p className="text-sm text-muted">Add your first shared expense.</p>
          </Card>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {group.expenses?.map((expense) => (
              <ExpenseRow
                key={expense.id}
                groupId={id}
                expense={expense}
                onEdit={() => setEditingExpense(expense)}
              />
            ))}
          </ul>
        )}
      </section>

      <AddMemberModal groupId={id} open={memberModalOpen} onClose={() => setMemberModalOpen(false)} />
      <ExpenseFormModal groupId={id} open={expenseModalOpen} onClose={() => setExpenseModalOpen(false)} />
      {editingExpense && (
        <ExpenseFormModal
          groupId={id}
          open={!!editingExpense}
          onClose={() => setEditingExpense(null)}
          expense={editingExpense}
        />
      )}
      <ConfirmDialog
        open={deleteGroupOpen}
        onClose={() => setDeleteGroupOpen(false)}
        onConfirm={onConfirmDeleteGroup}
        title="Delete this group?"
        description={`This permanently deletes "${group.name}" and all of its expenses for every member. This can't be undone.`}
        loading={deleteGroup.isPending}
      />
    </div>
  );
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function SettlementRow({
  settlement,
  onMarkSettled,
  loading,
}: {
  settlement: SettlementSuggestion;
  onMarkSettled: () => void;
  loading: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-2 text-sm text-foreground">
      <span className="min-w-0">
        <span className="font-medium">{settlement.from.name}</span> owes{" "}
        <span className="font-medium">{settlement.to.name}</span>{" "}
        <span className="text-accent">{formatMoney(settlement.amount)}</span>
      </span>
      <button
        onClick={onMarkSettled}
        disabled={loading}
        className="shrink-0 text-xs font-medium text-muted transition-colors duration-150 hover:text-success focus-visible:outline-2 disabled:opacity-50"
      >
        Mark as paid
      </button>
    </li>
  );
}

function MemberChip({ groupId, member }: { groupId: string; member: Member }) {
  const removeMember = useRemoveMember(groupId);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <li className="flex items-center gap-1.5 rounded-full border border-border bg-surface py-1 pl-3 pr-1.5 text-sm text-foreground">
      {member.user.name}
      <button
        onClick={() => setConfirmOpen(true)}
        aria-label={`Remove ${member.user.name} from group`}
        className="rounded-full p-0.5 text-muted transition-colors duration-150 hover:bg-border/60 hover:text-danger focus-visible:outline-2"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          removeMember.mutate(member.id);
          setConfirmOpen(false);
        }}
        title="Remove member?"
        description={`Remove ${member.user.name} from this group? This only works if they have no expenses recorded yet.`}
        loading={removeMember.isPending}
      />
    </li>
  );
}

function ExpenseRow({ groupId, expense, onEdit }: { groupId: string; expense: Expense; onEdit: () => void }) {
  const deleteExpense = useDeleteExpense(groupId);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{expense.description}</p>
        <p className="text-sm text-muted">Paid by {expense.paidBy.user.name}</p>
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <span className="font-medium text-foreground">{formatMoney(expense.amount)}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            aria-label={`Edit expense ${expense.description}`}
            title="Edit"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted transition-colors duration-150 hover:bg-border/40 hover:text-foreground focus-visible:outline-2"
          >
            <EditIcon />
            <span className="hidden sm:inline">Edit</span>
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            aria-label={`Delete expense ${expense.description}`}
            title="Delete"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-danger/80 transition-colors duration-150 hover:bg-danger/10 hover:text-danger focus-visible:outline-2"
          >
            <TrashIcon />
            <span className="hidden sm:inline">Delete</span>
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          deleteExpense.mutate(expense.id);
          setConfirmOpen(false);
        }}
        title="Delete this expense?"
        description={`Delete "${expense.description}"? Balances will be recalculated immediately. This can't be undone.`}
        loading={deleteExpense.isPending}
      />
    </Card>
  );
}

function AddMemberModal({ groupId, open, onClose }: { groupId: string; open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const addMember = useAddMember(groupId);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await addMember.mutateAsync(email);
      setEmail("");
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add member">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          placeholder="friend@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={addMember.isPending}>
            Add
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// Shared by both "Add expense" and "Edit expense" — passing `expense`
// switches it into edit mode, pre-filling the form and calling the update
// mutation instead of create.
function ExpenseFormModal({
  groupId,
  open,
  onClose,
  expense,
}: {
  groupId: string;
  open: boolean;
  onClose: () => void;
  expense?: Expense;
}) {
  const { data: group } = useGroup(groupId);
  const { user } = useAuth();
  const createExpense = useCreateExpense(groupId);
  const updateExpense = useUpdateExpense(groupId);
  const isEditing = !!expense;

  const myMemberId = useMemo(
    () => group?.members.find((m) => m.user.id === user?.id)?.id,
    [group, user]
  );

  const [description, setDescription] = useState(expense?.description ?? "");
  const [amount, setAmount] = useState(expense ? String(expense.amount / 100) : "");
  const [paidById, setPaidById] = useState(expense?.paidById ?? "");
  const [memberIds, setMemberIds] = useState<string[]>(expense?.shares.map((s) => s.memberId) ?? []);
  const [error, setError] = useState<string | null>(null);

  function toggleMember(id: string) {
    setMemberIds((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const amountPaise = toPaise(Number(amount));
    if (!amountPaise || amountPaise <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (memberIds.length === 0) {
      setError("Select at least one member to split with");
      return;
    }
    try {
      const input = { description, amount: amountPaise, paidById: paidById || myMemberId || "", memberIds };
      if (isEditing) {
        await updateExpense.mutateAsync({ expenseId: expense.id, ...input });
      } else {
        await createExpense.mutateAsync(input);
        setDescription("");
        setAmount("");
        setMemberIds([]);
      }
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  const pending = isEditing ? updateExpense.isPending : createExpense.isPending;

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? "Edit expense" : "Add expense"}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input
          label="Description"
          placeholder="e.g. Dinner"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          autoFocus
        />
        <Input
          label="Amount (₹)"
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="paidBy">
            Paid by
          </label>
          <select
            id="paidBy"
            value={paidById || myMemberId || ""}
            onChange={(e) => setPaidById(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground focus-visible:outline-2"
          >
            {group?.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.user.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Split equally between</span>
          <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            {group?.members.map((m) => (
              <label key={m.id} className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={memberIds.includes(m.id)}
                  onChange={() => toggleMember(m.id)}
                  className="h-4 w-4 accent-accent"
                />
                {m.user.name}
              </label>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending}>
            {isEditing ? "Save changes" : "Add expense"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
