"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Group, MemberBalance, SettlementSuggestion } from "@/lib/types";

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

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api<{ group: Group }>("/api/groups", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
  });
}

export function useAddMember(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (email: string) =>
      api(`/api/groups/${groupId}/members`, { method: "POST", body: JSON.stringify({ email }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups", groupId] }),
  });
}

export function useCreateExpense(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { description: string; amount: number; paidById: string; memberIds: string[] }) =>
      api("/api/expenses", { method: "POST", body: JSON.stringify({ groupId, ...input }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups", groupId] });
      qc.invalidateQueries({ queryKey: ["groups", groupId, "balances"] });
    },
  });
}

export function useDeleteExpense(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) => api(`/api/expenses/${expenseId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups", groupId] });
      qc.invalidateQueries({ queryKey: ["groups", groupId, "balances"] });
    },
  });
}
