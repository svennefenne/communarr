import type { Reaction, UserSummary } from "./types";

export interface GroupRef {
  id: number;
  slug: string;
  name: string;
  color: string;
}

export interface PostView {
  id: number;
  kind: "post" | "news";
  title: string;
  html: string;
  author: UserSummary;
  group: GroupRef | null;
  visibility: "members" | "private";
  pinned: boolean;
  commentsLocked: boolean;
  cover: string | null;
  createdAt: number;
  editedAt: number | null;
  comments: number;
  reactions: Reaction[];
  saved: boolean;
  canEdit: boolean;
  canModerate: boolean;
}

export interface CommentView {
  id: number;
  parentId: number | null;
  author: UserSummary;
  html: string;
  createdAt: number;
  editedAt: number | null;
  reactions: Reaction[];
  canEdit: boolean;
  canDelete: boolean;
  replies: CommentView[];
}

export interface CategoryView {
  id: number;
  slug: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  locked: boolean;
  group: GroupRef | null;
  threads: number;
  posts: number;
  last: { threadId: number; title: string; at: number; by: UserSummary | null } | null;
  unread: number;
}

export interface ThreadCard {
  id: number;
  title: string;
  excerpt: string;
  category: { id: number; slug: string; name: string; color: string; icon: string };
  author: UserSummary;
  replies: number;
  views: number;
  lastPostAt: number;
  lastBy: UserSummary | null;
  pinned: boolean;
  locked: boolean;
  unread: boolean;
  createdAt: number;
  reactions: Reaction[];
  group: GroupRef | null;
}

export interface PollOptionView {
  id: number;
  label: string;
  votes: number;
  mine: boolean;
  voters: UserSummary[];
}

export interface PollView {
  id: number;
  question: string;
  html: string;
  author: UserSummary;
  group: GroupRef | null;
  multiple: boolean;
  maxChoices: number | null;
  anonymous: boolean;
  allowChange: boolean;
  allowAdd: boolean;
  results: "always" | "after_vote" | "after_close";
  closesAt: number | null;
  closed: boolean;
  createdAt: number;
  options: PollOptionView[];
  totalVoters: number;
  voted: boolean;
  /** results can be shown to you now */
  showResults: boolean;
  comments: number;
  reactions: Reaction[];
  canEdit: boolean;
}

export type RsvpStatus = "going" | "maybe" | "no";

export interface EventView {
  id: number;
  title: string;
  html: string;
  location: string;
  startAt: number;
  endAt: number;
  allDay: boolean;
  color: string;
  cover: string | null;
  group: GroupRef | null;
  /** only the one who planned it sees it ("Only me") */
  private: boolean;
  author: UserSummary;
  repeat: "none" | "daily" | "weekly" | "monthly" | "yearly";
  repeatUntil: number | null;
  capacity: number | null;
  cancelled: boolean;
  createdAt: number;
  going: UserSummary[];
  maybe: UserSummary[];
  no: UserSummary[];
  mine: RsvpStatus | null;
  comments: number;
  reactions: Reaction[];
  canEdit: boolean;
  /** for a repeating event shown in a calendar: this occurrence's start */
  occurrence?: number;
}

export type FeedItem =
  | { type: "post"; at: number; post: PostView }
  | { type: "thread"; at: number; thread: ThreadCard }
  | { type: "poll"; at: number; poll: PollView }
  | { type: "event"; at: number; event: EventView };

export type FeedFilter = "all" | "posts" | "news" | "forum" | "polls" | "events";
