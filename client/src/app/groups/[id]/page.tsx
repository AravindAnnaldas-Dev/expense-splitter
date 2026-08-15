"use client";

import { useState, FormEvent, useMemo } from "react";
import { useParams } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { Skeleton } from "@/components/Skeleton";
import { formatMoney, toPaise } from "@/lib/money";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { Expense } from "@/lib/types";
import {
  useGroup,
  useGroupBalances,
  useAddMember,
  useCreateExpense,
  useDeleteExpense,
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
  const { data: group, isLoading } = useGroup(id);
  const { data: balanceData, isLoading: balancesLoading } = useGroupBalances(id);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);

  if (isLoading || !group) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{group.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {group.members.length} member{group.members.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setMemberModalOpen(true)}>
            Add member
          </Button>
          <Button onClick={() => setExpenseModalOpen(true)}>Add expense</Button>
        </div>
      </div>

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
                    <li key={i} className="text-sm text-foreground">
                      <span className="font-medium">{s.from.name}</span> owes{" "}
                      <span className="font-medium">{s.to.name}</span>{" "}
                      <span className="text-accent">{formatMoney(s.amount)}</span>
                    </li>
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
              <ExpenseRow key={expense.id} groupId={id} expense={expense} />
            ))}
          </ul>
        )}
      </section>

      <AddMemberModal groupId={id} open={memberModalOpen} onClose={() => setMemberModalOpen(false)} />
      <AddExpenseModal groupId={id} open={expenseModalOpen} onClose={() => setExpenseModalOpen(false)} />
    </div>
  );
}

function ExpenseRow({ groupId, expense }: { groupId: string; expense: Expense }) {
  const deleteExpense = useDeleteExpense(groupId);
  return (
    <Card className="flex items-center justify-between p-4">
      <div>
        <p className="font-medium text-foreground">{expense.description}</p>
        <p className="text-sm text-muted">Paid by {expense.paidBy.user.name}</p>
      </div>
      <div className="flex items-center gap-4">
        <span className="font-medium text-foreground">{formatMoney(expense.amount)}</span>
        <button
          onClick={() => deleteExpense.mutate(expense.id)}
          aria-label={`Delete expense ${expense.description}`}
          className="text-sm text-muted transition-colors duration-150 hover:text-danger focus-visible:outline-2"
        >
          Delete
        </button>
      </div>
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

function AddExpenseModal({ groupId, open, onClose }: { groupId: string; open: boolean; onClose: () => void }) {
  const { data: group } = useGroup(groupId);
  const { user } = useAuth();
  const createExpense = useCreateExpense(groupId);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidById, setPaidById] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const myMemberId = useMemo(
    () => group?.members.find((m) => m.user.id === user?.id)?.id,
    [group, user]
  );

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
      await createExpense.mutateAsync({
        description,
        amount: amountPaise,
        paidById: paidById || myMemberId || "",
        memberIds,
      });
      setDescription("");
      setAmount("");
      setMemberIds([]);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add expense">
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
            className="rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground focus-visible:outline-2"
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
          <Button type="submit" loading={createExpense.isPending}>
            Add expense
          </Button>
        </div>
      </form>
    </Modal>
  );
}
