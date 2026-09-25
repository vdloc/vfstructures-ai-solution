import type { PlayResult } from "./player.ts";

/** MOCK-ONLY status names for GET /v1/conversations/{id}. `aborted` is from 02 §7. */
export type MessageStatus = "completed" | "completed_unverified" | "refused" | "errored" | "aborted";

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  status?: MessageStatus;
  createdAt: string;
  requestId?: string;
}

export interface Conversation {
  id: string;
  owner: string;
  messages: StoredMessage[];
}

export interface FeedbackRecord {
  user: string;
  messageId: string;
  rating: "up" | "down";
  comment?: string;
}

export class MockState {
  readonly conversations = new Map<string, Conversation>();
  readonly activeTurns = new Set<string>();
  readonly approvals = new Map<string, string>();
  readonly feedback: FeedbackRecord[] = [];
  killSwitch = false;
  fallbackActive = false;

  /** Server-side guard of AD-23: one running turn per user. */
  tryBeginTurn(user: string): boolean {
    if (this.activeTurns.has(user)) return false;
    this.activeTurns.add(user);
    return true;
  }

  endTurn(user: string): void {
    this.activeTurns.delete(user);
  }

  canWrite(conversationId: string, user: string): boolean {
    const c = this.conversations.get(conversationId);
    return !c || c.owner === user;
  }

  append(conversationId: string, user: string, message: StoredMessage): void {
    let c = this.conversations.get(conversationId);
    if (!c) {
      c = { id: conversationId, owner: user, messages: [] };
      this.conversations.set(conversationId, c);
    }
    if (c.owner !== user) throw new Error(`conversation ${conversationId} belongs to another user`);
    c.messages.push(message);
  }

  read(conversationId: string, user: string): Conversation | undefined {
    const c = this.conversations.get(conversationId);
    return c && c.owner === user ? c : undefined;
  }

  findMessage(messageId: string): StoredMessage | undefined {
    for (const c of this.conversations.values()) {
      const m = c.messages.find((x) => x.id === messageId);
      if (m) return m;
    }
    return undefined;
  }

  reset(): void {
    this.conversations.clear();
    this.activeTurns.clear();
    this.approvals.clear();
    this.feedback.length = 0;
    this.killSwitch = false;
    this.fallbackActive = false;
  }
}

export function statusFor(result: PlayResult): MessageStatus {
  if (result.outcome === "aborted") return "aborted";
  if (result.emitted.includes("error")) return "errored";
  if (result.emitted.includes("refusal")) return "refused";
  if (result.emitted.includes("warning")) return "completed_unverified";
  return "completed";
}
