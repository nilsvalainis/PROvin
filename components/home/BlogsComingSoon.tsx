import { getTranslations } from "next-intl/server";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import { getIrissSocialUrls, IrissSocialIcons } from "@/components/IrissSocialIcons";
import {
  homeEditorialSectionBodyLeadClass,
  homeEditorialSectionTitleClass,
} from "@/lib/home-layout";

/** Centrēts „Drīzumā” + IRISS lead / sociālie — kā Par mums bloks. */
export async function BlogsComingSoon() {
  const tBlogs = await getTranslations("Blogs");
  const tIriss = await getTranslations("Iriss");
  const social = getIrissSocialUrls();

  return (
    <section
      id="blogs"
      className="home-body-ink relative flex min-h-[min(72dvh,40rem)] flex-1 scroll-mt-16 items-center justify-center bg-transparent px-4 py-16 sm:min-h-[min(78dvh,44rem)] sm:py-20"
    >
      <div className="demo-design-dir__shell relative mx-auto w-full max-w-[min(100%,80rem)] px-1 sm:px-2">
        <header className="text-center">
          <h1 className={homeEditorialSectionTitleClass}>{tBlogs("comingSoon")}</h1>
          <div className="mx-auto mt-3 w-full max-w-[min(100%,42rem)] px-1 sm:px-2">
            <DiagnosticScanLine variant="rail" motion="alongPingPong" className="w-full" />
          </div>
          <p className={homeEditorialSectionBodyLeadClass}>{tIriss("pageLead")}</p>
        </header>

        <div className="mt-6 flex justify-center sm:mt-7">
          <IrissSocialIcons
            tiktok={social.tiktok}
            youtube={social.youtube}
            instagram={social.instagram}
            socialLabel={tIriss("socialLabel")}
            socialSoon={tIriss("socialSoon")}
          />
        </div>
      </div>
    </section>
  );
}
