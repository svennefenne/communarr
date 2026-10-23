import { getUser } from "@/lib/auth";
import { allMembers } from "@/lib/users";

export const dynamic = "force-dynamic";

/** GET /api/users: every member (for @mentions and pickers). A friends' site is small enough. */
export async function GET() {
  if (!(await getUser())) return Response.json([], { status: 401 });
  return Response.json(allMembers(), { headers: { "Cache-Control": "private, max-age=60" } });
}
