"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { Skeleton } from "@/components/Skeleton";
import { useGroups, useCreateGroup } from "@/hooks/useGroups";

export default function GroupsPage() {
  return (
    <ProtectedRoute>
      <GroupsDashboard />
    </ProtectedRoute>
  );
}

function GroupsDashboard() {
  const { data: groups, isLoading } = useGroups();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Your groups</h1>
          <p className="mt-1 text-sm text-muted">Create a group to start splitting expenses.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>New group</Button>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {isLoading &&
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}

        {!isLoading && groups?.length === 0 && (
          <Card className="col-span-full flex flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="font-medium text-foreground">No groups yet</p>
            <p className="text-sm text-muted">Create your first group to get started.</p>
          </Card>
        )}

        {groups?.map((group) => (
          <Link key={group.id} href={`/groups/${group.id}`}>
            <Card className="p-5 transition-shadow duration-150 hover:shadow-elevated">
              <h2 className="font-medium text-foreground">{group.name}</h2>
              <p className="mt-1 text-sm text-muted">
                {group.members.length} member{group.members.length !== 1 ? "s" : ""}
              </p>
            </Card>
          </Link>
        ))}
      </div>

      <CreateGroupModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

function CreateGroupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const createGroup = useCreateGroup();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await createGroup.mutateAsync(name);
    setName("");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="New group">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input
          label="Group name"
          placeholder="e.g. Goa Trip"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={createGroup.isPending}>
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
}
