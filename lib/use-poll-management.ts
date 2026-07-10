"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useAdminCrud } from "./use-admin-crud";
import { useSuccessTimer } from "./use-success-timer";
import { useConfirmDialog } from "@/components/confirm-dialog";

export interface PollOption {
  id?: string;
  text: string;
  position: number;
  _count?: { votes: number };
}

export interface Poll {
  id: string;
  title: string;
  description: string | null;
  type: "TERMIN" | "SONSTIGES";
  status: "DRAFT" | "LIVE" | "CLOSED";
  multipleChoice: boolean;
  shortCode: string | null;
  eventId: string | null;
  createdAt: string;
  updatedAt: string;
  options: PollOption[];
  _count?: { votes: number };
  event?: { id: string; date: string; description: string } | null;
}

export interface NewPollData {
  title: string;
  description: string;
  type: "TERMIN" | "SONSTIGES";
  multipleChoice: boolean;
  eventId: string;
  options: { text: string; position: number }[];
}

const DEFAULT_POLL_DATA: NewPollData = {
  title: "",
  description: "",
  type: "SONSTIGES",
  multipleChoice: false,
  eventId: "",
  options: [
    { text: "", position: 0 },
    { text: "", position: 1 },
  ],
};

export function usePollManagement() {
  const { data: session, status } = useSession();
  const { createFetchHandler } = useAdminCrud();
  const confirm = useConfirmDialog();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalPollData, setModalPollData] = useState<NewPollData>({ ...DEFAULT_POLL_DATA });
  const [modalInitialPollData, setModalInitialPollData] = useState<NewPollData>({ ...DEFAULT_POLL_DATA });
  const [editingPoll, setEditingPoll] = useState<Poll | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [publishingPollId, setPublishingPollId] = useState<string | null>(null);
  const [closingPollId, setClosingPollId] = useState<string | null>(null);
  const [reopeningPollId, setReopeningPollId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useSuccessTimer(success, setSuccess);

  const fetchPolls = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setIsLoading(true);
      const response = await fetch("/api/admin/polls?limit=100", { signal: controller.signal });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Fehler beim Laden der Umfragen");
      }
      const data = await response.json();
      setPolls(data.polls);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      void fetchPolls();
    }
    return () => abortRef.current?.abort();
  }, [status, fetchPolls]);

  const openCreateModal = useCallback(() => {
    setEditingPoll(null);
    const initial = { ...DEFAULT_POLL_DATA };
    setModalPollData(initial);
    setModalInitialPollData(initial);
    setIsModalOpen(true);
    setError("");
  }, []);

  const openEditModal = useCallback((poll: Poll) => {
    setEditingPoll(poll);
    const initial: NewPollData = {
      title: poll.title,
      description: poll.description || "",
      type: poll.type,
      multipleChoice: poll.multipleChoice,
      eventId: poll.eventId || "",
      options: poll.options.map((o) => ({ text: o.text, position: o.position })),
    };
    setModalPollData(initial);
    setModalInitialPollData(initial);
    setIsModalOpen(true);
    setError("");
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingPoll(null);
    setError("");
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    const url = editingPoll ? `/api/admin/polls/${editingPoll.id}` : "/api/admin/polls";
    const method = editingPoll ? "PATCH" as const : "POST" as const;

    const fetchHandler = createFetchHandler<NewPollData>(url, method, setError, setIsSubmitting, modalPollData);
    const result = await fetchHandler();

    if (result.success) {
      setSuccess(editingPoll ? "Umfrage aktualisiert" : "Umfrage erstellt");
      setIsModalOpen(false);
      setEditingPoll(null);
      setError("");
      await fetchPolls();
    }
  }, [editingPoll, createFetchHandler, modalPollData, fetchPolls]);

  const handleDelete = useCallback(async (pollId: string) => {
    const poll = polls.find((p) => p.id === pollId);
    if (!await confirm({
      message: `Umfrage "${poll?.title}" wirklich löschen?`,
      confirmLabel: "Löschen",
      variant: "danger",
    })) return;

    const fetchHandler = createFetchHandler("/api/admin/polls", "DELETE", setError, setIsSubmitting);
    const result = await fetchHandler(pollId);

    if (result.success) {
      setSuccess("Umfrage gelöscht");
      await fetchPolls();
    }
  }, [polls, confirm, createFetchHandler, fetchPolls]);

  const handlePublish = useCallback(async (pollId: string) => {
    const poll = polls.find((p) => p.id === pollId);
    if (!await confirm({
      message: `Umfrage "${poll?.title}" veröffentlichen? Alle Mitglieder werden per E-Mail benachrichtigt.`,
      confirmLabel: "Veröffentlichen",
      variant: "warning",
    })) return;

    setPublishingPollId(pollId);
    const fetchHandler = createFetchHandler(`/api/admin/polls/${pollId}/publish`, "POST", setError, setIsSubmitting);
    const result = await fetchHandler();

    if (result.success) {
      const data = result.data as { pollUrl?: string } | undefined;
      if (data?.pollUrl) {
        try { await navigator.clipboard.writeText(data.pollUrl); } catch { /* ignore */ }
        setSuccess(`Umfrage veröffentlicht. Kurzlink wurde in die Zwischenablage kopiert: ${data.pollUrl}`);
      } else {
        setSuccess("Umfrage veröffentlicht");
      }
      await fetchPolls();
    }
    setPublishingPollId(null);
  }, [polls, confirm, createFetchHandler, fetchPolls]);

  const handleClose = useCallback(async (pollId: string) => {
    const poll = polls.find((p) => p.id === pollId);
    if (!await confirm({
      message: `Umfrage "${poll?.title}" schließen? Es können keine weiteren Stimmen abgegeben werden.`,
      confirmLabel: "Schließen",
      variant: "warning",
    })) return;

    setClosingPollId(pollId);
    const fetchHandler = createFetchHandler(`/api/admin/polls/${pollId}/close`, "POST", setError, setIsSubmitting);
    const result = await fetchHandler();

    if (result.success) {
      setSuccess("Umfrage geschlossen");
      await fetchPolls();
    }
    setClosingPollId(null);
  }, [polls, confirm, createFetchHandler, fetchPolls]);

  const handleReopen = useCallback(async (pollId: string) => {
    const poll = polls.find((p) => p.id === pollId);
    if (!await confirm({
      message: `Umfrage "${poll?.title}" wieder öffnen? Weitere Stimmen können abgegeben werden.`,
      confirmLabel: "Wieder öffnen",
      variant: "warning",
    })) return;

    setReopeningPollId(pollId);
    const fetchHandler = createFetchHandler(`/api/admin/polls/${pollId}/reopen`, "POST", setError, setIsSubmitting);
    const result = await fetchHandler();

    if (result.success) {
      setSuccess("Umfrage wieder geöffnet");
      await fetchPolls();
    }
    setReopeningPollId(null);
  }, [polls, confirm, createFetchHandler, fetchPolls]);

  return {
    polls,
    isLoading,
    error,
    success,
    setError,
    setSuccess,
    isModalOpen,
    modalPollData,
    setModalPollData,
    modalInitialPollData,
    editingPoll,
    isSubmitting,
    publishingPollId,
    closingPollId,
    reopeningPollId,
    session,
    status,
    openCreateModal,
    openEditModal,
    closeModal,
    handleSubmit,
    handleDelete,
    handlePublish,
    handleClose,
    handleReopen,
  };
}
