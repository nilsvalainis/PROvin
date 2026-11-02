import { PublicTopicLinks, type PublicTopicLink } from "@/components/seo/PublicTopicLinks";

export type VinCheckSection = {
  title: string;
  body: string;
};

export function VinCheckArticle({
  h1,
  lead,
  sections,
  links,
}: {
  h1: string;
  lead: string;
  sections: readonly VinCheckSection[];
  links: readonly PublicTopicLink[];
}) {
  return (
    <article className="mx-auto w-full max-w-[42.5rem] px-4 pb-16 pt-6 sm:px-6 sm:pb-20 sm:pt-8">
      <h1 className="text-balance text-3xl font-semibold tracking-tight text-white/[0.96] sm:text-4xl">{h1}</h1>
      <p className="mt-4 text-base leading-relaxed text-white/70">{lead}</p>
      {sections.map((section, index) => (
        <section key={section.title} className={index === 0 ? "mt-10" : "mt-8"}>
          <h2 className="text-lg font-semibold text-white/[0.96]">{section.title}</h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-white/70">{section.body}</p>
        </section>
      ))}
      <PublicTopicLinks links={links} />
    </article>
  );
}
