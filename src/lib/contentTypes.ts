import type { Repeat, RepeatRule } from "./repeat";
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
  repeat: Repeat;
  /** repeat: 'custom': how */
  repeatRule: RepeatRule | null;
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
  /** a countdown on the front page: from how many days before, 0 the whole time (null: none) */
  countdown: number | null;
  /** its countdown goes before the others' (an admin pinned it) */
  countdownPinned: boolean;
  /** for a repeating event shown in a calendar: this occurrence's start */
  occurrence?: number;
}

/** A list's column: what it holds decides how it's filled in. */
export type ListColumnType = "text" | "number" | "check" | "member" | "date" | "time" | "choice";
export interface ListColumn {
  id: string;
  name: string;
  type: ListColumnType;
  /** a choice's choices */
  options?: string[];
}
/** a cell: text, a number, true (checked), a member's id, "2026-11-06", "18:30", or a choice */
export type ListCell = string | number | boolean;

export interface ListRowView {
  id: number;
  cells: Record<string, ListCell>;
  /** whose row it is (the first to fill it in) */
  filledBy: UserSummary | null;
  /** this member may change it */
  canEdit: boolean;
}

/** A list in the Lists overview and the feed. */
export interface ListCard {
  id: number;
  title: string;
  text: string;
  author: UserSummary;
  group: GroupRef | null;
  private: boolean;
  columns: ListColumn[];
  rows: number;
  /** automatic rows: it grows as it's filled in (an empty row stays last), so it has no set size */
  autoRows: boolean;
  /** shown whole (its table, filled in right there) on its card in Lists */
  showAll: boolean;
  /** rows with something in them */
  filled: number;
  /** rows this member has filled in */
  mine: number;
  canFill: boolean;
  comments: number;
  reactions: Reaction[];
  createdAt: number;
  updatedAt: number;
}

export interface ListView extends ListCard {
  html: string;
  /** who can fill it in: everyone who sees it, or only its author */
  fill: "members" | "owner";
  addRows: boolean;
  /** a filled row is its filler's: only they (and the list's author) can change it */
  ownRows: boolean;
  rowList: ListRowView[];
  /** the members named in member columns */
  people: Record<number, UserSummary>;
  /** may change the columns, rows and settings */
  canEdit: boolean;
  canAddRows: boolean;
}

export type FeedItem =
  | { type: "post"; at: number; post: PostView }
  | { type: "thread"; at: number; thread: ThreadCard }
  | { type: "poll"; at: number; poll: PollView }
  | { type: "event"; at: number; event: EventView }
  | { type: "list"; at: number; list: ListCard };

export type FeedFilter = "all" | "posts" | "news" | "forum" | "polls" | "events" | "lists";
