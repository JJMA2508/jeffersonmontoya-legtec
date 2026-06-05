import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { Hero } from "@/components/Hero";
import { Specialization } from "@/components/Specialization";
import { Philosophy } from "@/components/Philosophy";
import { Contact } from "@/components/Contact";
import { SiteFooter } from "@/components/SiteFooter";

const TITLE = "Jefferson Montoya | LegalTech Strategist & AI Law Consultant";
const DESCRIPTION =
  "Abogado y CBO especializado en LegalTech, automatización de procesos legales e inteligencia artificial aplicada. Estrategia y eficiencia operativa para el derecho moderno.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      {
        name: "keywords",
        content:
          "LegalTech Strategist, Legal Process Automation, AI Law Consultant, CBO, Legal Operations, automatización legal, inteligencia artificial jurídica",
      },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Person",
          name: "Jefferson Montoya",
          jobTitle: "LegalTech Strategist & CBO",
          description: DESCRIPTION,
          knowsAbout: [
            "LegalTech",
            "Legal Process Automation",
            "AI Law",
            "Legal Operations",
            "Chief Business Officer",
          ],
        }),
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <Hero />
        <Specialization />
        <Philosophy />
        <Contact />
      </main>
      <SiteFooter />
    </div>
  );
}
