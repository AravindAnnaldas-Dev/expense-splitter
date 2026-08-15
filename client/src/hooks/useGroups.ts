"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { Group, MemberBalance, SettlementSuggestion } from "@/lib/types";
import { useToast } from "@/lib/toast";

export function useGroups() {
  return useQuery({
    queryKey: ["groups"],
    queryFn: () => api<{ groups: Group[] }>("/api/groups").then((r) => r.groups),
  });
}

export function useGroup(id: string) {
  return useQuery({
    queryKey: ["groups", id],
    queryFn: () => api<{ group: Group }>(`/api/groups/${id}`).then((r) => r.group),
    enabled: !!id,
  });
}

export function useGroupBalances(id: string) {
  return useQuery({
    queryKey: ["groups", id, "balances"],
    queryFn: () =>
      api<{ balances: MemberBalance[]; settlements: SettlementSuggestion[] }>(`/api/groups/${id}/balances`),
    enabled: !!id,
  });
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

export function useCreateGroup() {
  const qc = useQueryClient();
  const { show } = useToast();
  return useMutation({
    mutationFn: (name: string) => api<{ group: Group }>("/api/groups", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups"] });
      show("Group created");
    },
    onError: (err) => show(errorMessage(err, "Failed to create group"), "error"),
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  const { show } = useToast();
  return useMutation({
    mutationFn: (groupId: string) => api(`/api/groups/${groupId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups"] });
      show("Group deleted");
    },
    onError: (err) => show(errorMessage(err, "Failed to delete group"), "error"),
  });
}

export function useAddMember(groupId: string) {
  const qc = useQueryClient();
  const { show } = useToast();
  return useMutation({
    mutationFn: (email: string) =>
      api(`/api/groups/${groupId}/members`, { method: "POST", body: JSON.stringify({ email }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups", groupId] });
      show("Member added");
    },
    onError: (err) => show(errorMessage(err, "Failed to add member"), "error"),
  });
}

export function useRemoveMember(groupId: string) {
  const qc = useQueryClient();
  const { show } = useToast();
  return useMutation({
    mutationFn: (memberId: string) => api(`/api/groups/${groupId}/members/${memberId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups", groupId] });
      show("Member removed");
    },
    onError: (err) => show(errorMessage(err, "Failed to remove member"), "error"),
  });
}

export function useCreateExpense(groupId: string) {
  const qc = useQueryClient();
  const { show } = useToast();
  return useMutation({
    mutationFn: (input: { description: string; amount: number; paidById: string; memberIds: string[] }) =>
      api("/api/expenses", { method: "POST", body: JSON.stringify({ groupId, ...input }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups", groupId] });
      qc.invalidateQueries({ queryKey: ["groups", groupId, "balances"] });
      show("Expense added");
    },
    onError: (err) => show(errorMessage(err, "Failed to add expense"), "error"),
  });
}

export function useUpdateExpense(groupId: string) {
  const qc = useQueryClient();
  const { show } = useToast();
  return useMutation({
    mutationFn: ({
      expenseId,
      ...input
    }: {
      expenseId: string;
      description: string;
      amount: number;
      paidById: string;
      memberIds: string[];
    }) => api(`/api/expenses/${expenseId}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups", groupId] });
      qc.invalidateQueries({ queryKey: ["groups", groupId, "balances"] });
      show("Expense updated");
    },
    onError: (err) => show(errorMessage(err, "Failed to update expense"), "error"),
  });
}

export function useDeleteExpense(groupId: string) {
  const qc = useQueryClient();
  const { show } = useToast();
  return useMutation({
    mutationFn: (expenseId: string) => api(`/api/expenses/${expenseId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups", groupId] });
      qc.invalidateQueries({ queryKey: ["groups", groupId, "balances"] });
      show("Expense deleted");
    },
    onError: (err) => show(errorMessage(err, "Failed to delete expense"), "error"),
  });
}

export function useCreateSettlement(groupId: string) {
  const qc = useQueryClient();
  const { show } = useToast();
  return useMutation({
    mutationFn: (input: { fromId: string; toId: string; amount: number }) =>
      api(`/api/groups/${groupId}/settlements`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups", groupId, "balances"] });
      show("Marked as settled");
    },
    onError: (err) => show(errorMessage(err, "Failed to record settlement"), "error"),
  });
}
