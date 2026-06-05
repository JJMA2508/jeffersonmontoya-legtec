import { motion } from "motion/react";

const cards = [
  {
    no: "01",
    title: "Transformación LegalTech",
    desc: "Rediseño de operaciones jurídicas con tecnología: desde la digitalización documental hasta arquitecturas de datos que blindan la toma de decisiones.",
    tags: ["Legal Operations", "Data", "Compliance"],
  },
  {
    no: "02",
    title: "Automatización con LLMs",
    desc: "Implementación de inteligencia artificial y modelos de lenguaje para revisar, redactar y orquestar procesos legales con precisión y trazabilidad.",
    tags: ["AI Law", "LLMs", "Workflows"],
  },
  {
    no: "03",
    title: "Consultoría CBO",
    desc: "Visión de Chief Business Officer aplicada al derecho: alineación entre estrategia de negocio, eficiencia operativa y rentabilidad sostenible.",
    tags: ["Estrategia", "Operaciones", "Crecimiento"],
  },
];

export function Specialization() {
  return (
    <section id="especializacion" className="mx-auto max-w-6xl px-6 py-24">
      <div className="max-w-2xl">
        <p className="text-xs uppercase tracking-[0.25em] text-accent">Especialización</p>
        <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">
          Tres frentes de impacto para el derecho moderno
        </h2>
        <p className="mt-4 text-muted-foreground">
          Cada intervención combina criterio jurídico, ingeniería de procesos y tecnología
          de frontera para generar autoridad operativa.
        </p>
      </div>

      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {cards.map((c, i) => (
          <motion.article
            key={c.no}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="group relative overflow-hidden rounded-xl border border-border bg-card p-7 transition-all duration-300 hover:-translate-y-1 hover:border-primary/60 hover:shadow-[var(--shadow-bunker)]"
          >
            <div className="absolute right-6 top-6 font-display text-5xl font-black text-secondary transition-colors group-hover:text-primary/30">
              {c.no}
            </div>
            <h3 className="mt-10 text-xl font-bold">{c.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.desc}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {c.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
}