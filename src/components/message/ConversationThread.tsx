"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Message = {
  id: string;
  senderId: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
};

// Polling chat thread (Phase 1.10). WebSockets are deferred; we poll GET
// /api/messages every few seconds using the `after` cursor so we only fetch new
// messages. Flagged interim — replace with a socket transport in a later phase.
const POLL_MS = 4000;

export function ConversationThread({ orderId }: { orderId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastAtRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const poll = useCallback(async () => {
    const qs = new URLSearchParams({ orderId });
    if (lastAtRef.current) qs.set("after", lastAtRef.current);
    const res = await fetch(`/api/messages?${qs.toString()}`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.currentUserId) setCurrentUserId(data.currentUserId);
    if (Array.isArray(data.messages) && data.messages.length > 0) {
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const fresh = data.messages.filter((m: Message) => !seen.has(m.id));
        return fresh.length ? [...prev, ...fresh] : prev;
      });
      lastAtRef.current = data.messages[data.messages.length - 1].createdAt;
    }
  }, [orderId]);

  useEffect(() => {
    poll();
    const t = setInterval(poll, POLL_MS);
    return () => clearInterval(t);
  }, [poll]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const content = draft.trim();
    if (!content) return;
    setSending(true);
    setError(null);
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, content }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not send");
      setSending(false);
      return;
    }
    setMessages((prev) => [...prev, data.message]);
    lastAtRef.current = data.message.createdAt;
    setDraft("");
    setSending(false);
  }

  return (
    <div className="flex h-[70vh] flex-col rounded-2xl border border-brand-100 bg-white">
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-ink-soft">
            No messages yet. Say hello.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === currentUserId;
            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                    mine
                      ? "bg-brand-600 text-white"
                      : "bg-brand-50 text-ink"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-brand-100 p-3">
        {error && <p className="mb-2 text-xs text-rose-600">{error}</p>}
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Type a message…"
            className="w-full rounded-xl border border-brand-200 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
          />
          <button
            onClick={send}
            disabled={sending}
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
