"use server";

import { revalidatePath } from "next/cache";
import { act } from "@/lib/act";
import { UserError } from "@/lib/errors";
import { createPost, deletePost, getPost, lockComments, pinPost, toggleBookmark, updatePost, type BookmarkType, type PostInput } from "@/lib/posts";
import { addComment, deleteComment, editComment, listComments, type CommentTarget } from "@/lib/comments";
import { toggleReaction, type ReactTarget } from "@/lib/reactions";
import { addOption, closePoll, createPoll, deletePoll, getPoll, updatePoll, vote, type PollInput } from "@/lib/polls";
import { cancelEvent, createEvent, deleteEvent, eventsBetween, getEvent, rsvp, updateEvent, type EventInput } from "@/lib/events";
import { createThread, deleteReply, deleteThread, editReply, editThread, follow, moderateThread, quoteFor, reply } from "@/lib/forum";
import { feed } from "@/lib/feed";
import { report, type ReportTarget } from "@/lib/reports";
import { canSeeTarget } from "@/lib/visibility";
import { getSettings, type SiteSettings } from "@/lib/settings";
import type { User } from "@/lib/users";
import type { FeedFilter, RsvpStatus } from "@/lib/contentTypes";

// ── posts ──

export async function createPostAction(input: PostInput) {
  return act((u) => {
    if (input.kind === "news") allowed(u, "news");
    const id = createPost(u, input);
    revalidatePath("/");
    return id;
  });
}

export async function updatePostAction(id: number, input: PostInput) {
  return act((u) => {
    updatePost(u, id, input);
    revalidatePath(`/posts/${id}`);
    return getPost(u, id);
  });
}

export async function deletePostAction(id: number) {
  return act((u) => {
    deletePost(u, id);
    revalidatePath("/");
    return true;
  });
}

export async function pinPostAction(id: number, on: boolean) {
  return act((u) => {
    pinPost(u, id, on);
    revalidatePath("/");
    return on;
  });
}

export async function lockCommentsAction(id: number, on: boolean) {
  return act((u) => {
    lockComments(u, id, on);
    return on;
  });
}

export async function saveAction(type: BookmarkType, id: number) {
  return act((u) => toggleBookmark(u, type, id));
}

export async function reactAction(type: ReactTarget, id: number, emoji: string) {
  return act((u) => {
    if (!["post", "comment", "thread", "reply", "poll", "event"].includes(type)) throw new UserError("Can't react to that.");
    if (!canSeeTarget(u, type, id)) throw new UserError("That's gone.");
    return toggleReaction(u.id, type, id, emoji).reactions;
  });
}

/** The admin's switches (Admin → Features & permissions), checked here too, not only on the pages. */
function allowed(u: User, feature: keyof SiteSettings["features"], who?: keyof SiteSettings["canCreate"]) {
  const s = getSettings();
  if (!s.features[feature]) throw new UserError("That's switched off on this site.");
  if (who && s.canCreate[who] === "mods" && !u.isMod) throw new UserError("Only moderators can start that.");
}

export async function feedAction(filter: FeedFilter, before?: number, groupId?: number, authorId?: number) {
  return act((u) => feed(u, { filter, before, groupId, authorId }));
}

// ── comments ──

export async function commentsAction(type: CommentTarget, id: number) {
  return act((u) => listComments(u, type, id));
}

export async function addCommentAction(type: CommentTarget, id: number, html: string, parentId?: number | null) {
  return act((u) => addComment(u, type, id, html, parentId));
}

export async function editCommentAction(cid: number, html: string) {
  return act((u) => {
    editComment(u, cid, html);
    return true;
  });
}

export async function deleteCommentAction(cid: number) {
  return act((u) => {
    deleteComment(u, cid);
    return true;
  });
}

// ── polls ──

export async function createPollAction(input: PollInput) {
  return act((u) => {
    allowed(u, "polls", "polls");
    return createPoll(u, input);
  });
}

export async function updatePollAction(id: number, input: Partial<PollInput>) {
  return act((u) => {
    updatePoll(u, id, input);
    return getPoll(u, id);
  });
}

export async function voteAction(id: number, options: number[]) {
  return act((u) => {
    vote(u, id, options);
    return getPoll(u, id);
  });
}

export async function addOptionAction(id: number, label: string) {
  return act((u) => {
    addOption(u, id, label);
    return getPoll(u, id);
  });
}

export async function closePollAction(id: number, closed: boolean) {
  return act((u) => {
    closePoll(u, id, closed);
    return getPoll(u, id);
  });
}

export async function deletePollAction(id: number) {
  return act((u) => {
    deletePoll(u, id);
    revalidatePath("/polls");
    return true;
  });
}

export async function pollAction(id: number) {
  return act((u) => getPoll(u, id));
}

// ── events ──

export async function createEventAction(input: EventInput) {
  return act((u) => {
    allowed(u, "calendar", "events");
    return createEvent(u, input);
  });
}

export async function updateEventAction(id: number, input: EventInput) {
  return act((u) => {
    updateEvent(u, id, input);
    return getEvent(u, id);
  });
}

export async function rsvpAction(id: number, status: RsvpStatus | null) {
  return act((u) => {
    rsvp(u, id, status);
    return getEvent(u, id);
  });
}

export async function cancelEventAction(id: number, cancelled: boolean) {
  return act((u) => {
    cancelEvent(u, id, cancelled);
    return getEvent(u, id);
  });
}

export async function deleteEventAction(id: number) {
  return act((u) => {
    deleteEvent(u, id);
    revalidatePath("/calendar");
    return true;
  });
}

export async function eventsAction(from: number, to: number, o: { groupId?: number; mineOnly?: boolean } = {}) {
  return act((u) => eventsBetween(u, from, to, o));
}

// ── forum ──

export async function createThreadAction(input: { categoryId: number; title: string; html: string }) {
  return act((u) => {
    allowed(u, "forum");
    return createThread(u, input);
  });
}

export async function replyAction(threadId: number, html: string) {
  return act((u) => {
    const id = reply(u, threadId, html);
    revalidatePath(`/forum/t/${threadId}`);
    return id;
  });
}

export async function editThreadAction(id: number, input: { title: string; html: string }) {
  return act((u) => {
    editThread(u, id, input);
    revalidatePath(`/forum/t/${id}`);
    return true;
  });
}

export async function editReplyAction(id: number, threadId: number, html: string) {
  return act((u) => {
    editReply(u, id, html);
    revalidatePath(`/forum/t/${threadId}`);
    return true;
  });
}

export async function deleteReplyAction(id: number, threadId: number) {
  return act((u) => {
    deleteReply(u, id);
    revalidatePath(`/forum/t/${threadId}`);
    return true;
  });
}

export async function deleteThreadAction(id: number) {
  return act((u) => {
    deleteThread(u, id);
    revalidatePath("/forum");
    return true;
  });
}

export async function moderateThreadAction(id: number, o: { pinned?: boolean; locked?: boolean; categoryId?: number }) {
  return act((u) => {
    moderateThread(u, id, o);
    revalidatePath(`/forum/t/${id}`);
    return true;
  });
}

export async function followAction(id: number, on: boolean) {
  return act((u) => {
    follow(u, id, on);
    return on;
  });
}

export async function quoteAction(threadId: number, replyId: number) {
  return act((u) => quoteFor(u, threadId, replyId));
}

// ── reports ──

export async function reportAction(type: ReportTarget, id: number, reason: string) {
  return act((u) => {
    report(u, type, id, reason);
    return true;
  });
}
