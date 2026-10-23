import Link from "next/link";
import { Compass } from "lucide-react";
import { requestT } from "@/lib/t";
import { Empty } from "@/components/ui/ui";

/** Any address that isn't a page (or something that's gone), in the reader's language. */
export default async function NotFound() {
  const t = await requestT();
  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <span className="eyebrow">404</span>
          <h1 className="display page-title">{t("Not here")}</h1>
        </div>
      </div>
      <Empty icon={<Compass size={24} />} title={t("This page doesn't exist (any more)")}>
        {t("It may have been deleted, or the link is wrong.")}{" "}
        <Link href="/" className="link">
          {t("Back to the front page")}
        </Link>
      </Empty>
    </div>
  );
}
