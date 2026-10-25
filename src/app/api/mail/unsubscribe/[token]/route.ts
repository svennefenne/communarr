import { NextResponse } from "next/server";
import { setAllMail } from "@/lib/accountMail";
import { redirectTo } from "@/lib/url";

/**
 * One-click unsubscribe (RFC 8058): the mail program's own "Unsubscribe" button POSTs here (the
 * List-Unsubscribe header). Opening it in a browser goes to the page with the button instead.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return setAllMail(token, false) ? new NextResponse(null, { status: 204 }) : new NextResponse("No such link", { status: 404 });
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return redirectTo(`/mail/unsubscribe/${encodeURIComponent(token)}`);
}
