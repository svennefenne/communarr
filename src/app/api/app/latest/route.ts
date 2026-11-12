import { getUser } from "@/lib/auth";
import { GENERIC, githubAppNow, latestApps } from "@/lib/apps";
import { requestT } from "@/lib/t";

export const dynamic = "force-dynamic";

/**
 * GET /api/app/latest?name=… → { apps }: each app's newest version, looked at now (Check for updates in
 * the Android app's menu). For the app under its own name GitHub is asked now too.
 */
export async function GET(req: Request) {
  if (!(await getUser())) return Response.json({ error: (await requestT())("Log in first.") }, { status: 401 });
  const name = new URL(req.url).searchParams.get("name")?.toLowerCase();
  if (name === GENERIC && (await githubAppNow()) === false)
    return Response.json({ error: (await requestT())("GitHub couldn't be reached to check for updates. Try again in a while.") }, { status: 502 });
  return Response.json({ apps: latestApps() });
}
