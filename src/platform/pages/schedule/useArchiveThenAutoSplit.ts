import { useRef, useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import {
  isClassHasNoStudents,
  isGroupSetNotEmpty,
  isSubgroupsInUse,
} from '@/lib/schedule2bApi';
import type { SubgroupInUse } from '@/lib/schedule2bTypes';
import { parseSubgroupsInUseDetails } from './subgroupHelpers';

type ArchiveMutate = (vars: {
  subgroupId: number;
  confirmImpact?: boolean;
}) => Promise<unknown>;

type AutoSplitMutate = (names: {
  firstName: string;
  secondName: string;
}) => Promise<unknown>;

/**
 * Archive → auto-split flow with resume after SUBGROUPS_IN_USE confirmImpact.
 * Keeps a queue of subgroup ids so one "Архивировать всё равно" continues the loop.
 */
export function useArchiveThenAutoSplit({
  archiveSubgroup,
  autoSplit,
  isArchivePending,
  isAutoSplitPending,
}: {
  archiveSubgroup: { mutateAsync: ArchiveMutate; isPending: boolean };
  autoSplit: { mutateAsync: AutoSplitMutate; isPending: boolean };
  isArchivePending?: boolean;
  isAutoSplitPending?: boolean;
}) {
  const toast = useToast();
  const [autoSplitOpen, setAutoSplitOpen] = useState(false);
  const [notEmptyOpen, setNotEmptyOpen] = useState(false);
  const [inUseRows, setInUseRows] = useState<SubgroupInUse[]>([]);
  const [pendingArchiveSubgroupId, setPendingArchiveSubgroupId] = useState<number | null>(null);
  /** Remaining ids including the one paused on IN_USE. */
  const [resumeQueue, setResumeQueue] = useState<number[] | null>(null);
  const resumeSplitAfterArchive = useRef(false);

  const archivePending = isArchivePending ?? archiveSubgroup.isPending;
  const splitPending = isAutoSplitPending ?? autoSplit.isPending;

  async function drainArchiveQueue(ids: number[]) {
    let remaining = [...ids];
    while (remaining.length > 0) {
      const id = remaining[0]!;
      try {
        await archiveSubgroup.mutateAsync({ subgroupId: id, confirmImpact: false });
        remaining = remaining.slice(1);
      } catch (err) {
        if (isSubgroupsInUse(err)) {
          setInUseRows(parseSubgroupsInUseDetails(err.details));
          setPendingArchiveSubgroupId(id);
          setResumeQueue(remaining);
          return;
        }
        throw err;
      }
    }
    resumeSplitAfterArchive.current = false;
    setResumeQueue(null);
    setNotEmptyOpen(false);
    setAutoSplitOpen(true);
  }

  async function runAutoSplit(names: { firstName: string; secondName: string }) {
    try {
      await autoSplit.mutateAsync(names);
      toast.success('Класс разделён на две группы');
      setAutoSplitOpen(false);
      setNotEmptyOpen(false);
    } catch (err) {
      if (isGroupSetNotEmpty(err)) {
        setAutoSplitOpen(false);
        setNotEmptyOpen(true);
        return;
      }
      if (isClassHasNoStudents(err)) {
        toast.error('В классе нет активных учеников для деления');
        return;
      }
      toast.error(err instanceof ApiError ? err.message : 'Не удалось разделить');
    }
  }

  async function archiveAllThenSplit(activeSubgroupIds: number[]) {
    resumeSplitAfterArchive.current = true;
    try {
      await drainArchiveQueue(activeSubgroupIds);
    } catch (err) {
      resumeSplitAfterArchive.current = false;
      setResumeQueue(null);
      toast.error(err instanceof ApiError ? err.message : 'Не удалось заархивировать группы');
    }
  }

  async function archiveOne(subgroupId: number) {
    resumeSplitAfterArchive.current = false;
    setResumeQueue(null);
    try {
      await archiveSubgroup.mutateAsync({ subgroupId, confirmImpact: false });
      toast.success('Подгруппа заархивирована');
    } catch (err) {
      if (isSubgroupsInUse(err)) {
        setInUseRows(parseSubgroupsInUseDetails(err.details));
        setPendingArchiveSubgroupId(subgroupId);
        return;
      }
      toast.error(err instanceof ApiError ? err.message : 'Не удалось заархивировать');
    }
  }

  async function confirmArchiveImpact() {
    if (pendingArchiveSubgroupId == null) return;
    const id = pendingArchiveSubgroupId;
    try {
      await archiveSubgroup.mutateAsync({ subgroupId: id, confirmImpact: true });
      setInUseRows([]);
      setPendingArchiveSubgroupId(null);
      toast.success('Подгруппа заархивирована');

      if (resumeSplitAfterArchive.current) {
        const rest = (resumeQueue ?? []).filter((x) => x !== id);
        setResumeQueue(null);
        try {
          await drainArchiveQueue(rest);
        } catch (err) {
          resumeSplitAfterArchive.current = false;
          toast.error(err instanceof ApiError ? err.message : 'Не удалось заархивировать группы');
        }
      } else {
        setResumeQueue(null);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось заархивировать');
    }
  }

  function cancelInUse() {
    setInUseRows([]);
    setPendingArchiveSubgroupId(null);
    setResumeQueue(null);
    resumeSplitAfterArchive.current = false;
  }

  function cancelNotEmpty() {
    setNotEmptyOpen(false);
    resumeSplitAfterArchive.current = false;
    setResumeQueue(null);
  }

  return {
    autoSplitOpen,
    setAutoSplitOpen,
    notEmptyOpen,
    inUseRows,
    pendingArchiveSubgroupId,
    archivePending,
    splitPending,
    runAutoSplit,
    archiveAllThenSplit,
    archiveOne,
    confirmArchiveImpact,
    cancelInUse,
    cancelNotEmpty,
  };
}
