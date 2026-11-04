import { CalendarDays, CircleDot, Clock, Hash, SquareCheck, Type, UserRound, type LucideIcon } from "lucide-react";
import type { ListColumn, ListColumnType } from "@/lib/contentTypes";

/** What each kind of column is called (English, translated where shown) and its icon. */
export const COLUMN_TYPES: { type: ListColumnType; label: string; icon: LucideIcon }[] = [
  { type: "text", label: "Text", icon: Type },
  { type: "member", label: "Member", icon: UserRound },
  { type: "check", label: "Checkbox", icon: SquareCheck },
  { type: "date", label: "Date", icon: CalendarDays },
  { type: "time", label: "Time", icon: Clock },
  { type: "number", label: "Number", icon: Hash },
  { type: "choice", label: "Choice", icon: CircleDot },
];

export const typeIcon = (type: ListColumnType): LucideIcon => COLUMN_TYPES.find((c) => c.type === type)?.icon ?? Type;

/**
 * Ready-made lists to start from (names English, translated where shown). ownRows: whether a filled-in
 * row is its filler's (a sign-up sheet: yes; a shopping list anyone ticks off: no).
 */
export const TEMPLATES: { id: string; label: string; columns: Omit<ListColumn, "id">[]; rows: number; ownRows: boolean }[] = [
  {
    id: "signup",
    label: "Sign-up sheet",
    columns: [
      { name: "Who are you?", type: "member" },
      { name: "What are you bringing?", type: "text" },
    ],
    rows: 11,
    ownRows: true,
  },
  {
    id: "shopping",
    label: "Shopping list",
    columns: [
      { name: "Bought", type: "check" },
      { name: "Item", type: "text" },
      { name: "Quantity", type: "text" },
      { name: "Who's buying?", type: "member" },
    ],
    rows: 15,
    ownRows: false,
  },
  {
    id: "checklist",
    label: "Checklist",
    columns: [
      { name: "Done", type: "check" },
      { name: "What", type: "text" },
      { name: "Who", type: "member" },
    ],
    rows: 8,
    ownRows: false,
  },
  {
    id: "schedule",
    label: "Schedule",
    columns: [
      { name: "Day", type: "date" },
      { name: "Time", type: "time" },
      { name: "What", type: "text" },
      { name: "Who", type: "member" },
    ],
    rows: 6,
    ownRows: true,
  },
  {
    id: "blank",
    label: "Empty",
    columns: [{ name: "Column 1", type: "text" }],
    rows: 5,
    ownRows: true,
  },
];
