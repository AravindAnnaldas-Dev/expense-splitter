"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
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
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const router = useRouter();

  // Next.js's client-side route transition can take a visible beat (first
  // compile of the route's chunk, plus whatever the destination page fetches
  // before it can render anything). Without this, a click just sits there
  // looking unresponsive until the new page finally shows up. We flip a
  // per-card "navigating" flag immediately on click so the card itself
  // gives instant feedback, then let the actual navigation catch up.
  function goToGroup(groupId: string) {
    setNavigatingTo(groupId);
    router.push(`/groups/${groupId}`);
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Your groups</h1>
          <p className="mt-1 text-sm text-muted">Create a group to start splitting expenses.</p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="w-full sm:w-auto">
          New group
        </Button>
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

        {groups?.map((group) => {
          const isNavigating = navigatingTo === group.id;
          return (
            <button
              key={group.id}
              onClick={() => goToGroup(group.id)}
              disabled={!!navigatingTo}
              className="text-left disabled:cursor-wait"
            >
              <Card className="flex items-start justify-between p-5 transition-shadow duration-150 hover:shadow-elevated">
                <div>
                  <h2 className="font-medium text-foreground">{group.name}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {group.members.length} member{group.members.length !== 1 ? "s" : ""}
                  </p>
                </div>
                {isNavigating && (
                  <span
                    className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-accent border-t-transparent"
                    aria-label="Loading"
                  />
                )}
              </Card>
            </button>
          );
        })}
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
