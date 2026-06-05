import { motion } from "motion/react";

const methods = [
  {
    label: "Teléfono / WhatsApp",
    value: "+57 310 537 6773",
    href: "tel:+573105376773",
    sub: "Disponible para consultas estratégicas",
  },
  {
    label: "LinkedIn",
    value: "linkedin.com/in/jejomoan",
    href: "https://www.linkedin.com/in/jejomoan/",
    sub: "Conecta y agenda una conversación",
  },
];

export function Contact() {
  return (
    <section id="contacto" className="mx-auto max-w-6xl px-6 py-24">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-xs uppercase tracking-[0.25em] text-accent">Contacto</p>
          <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">
            Solicitar Consultoría Estratégica
          </h2>
          <p className="mt-4 max-w-md text-muted-foreground">
            Acceso directo y confidencial. Escríbeme con el problema principal a resolver y
            diseñaremos la arquitectura legal adecuada.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="space-y-4"
        >
          {methods.map((m) => (
            <a
              key={m.label}
              href={m.href}
              target={m.href.startsWith("http") ? "_blank" : undefined}
              rel={m.href.startsWith("http") ? "noopener noreferrer" : undefined}
              className="group flex items-center justify-between rounded-xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-[var(--shadow-bunker)]"
            >
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {m.label}
                </p>
                <p className="mt-1.5 font-display text-lg font-bold">{m.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{m.sub}</p>
              </div>
              <span className="text-2xl text-muted-foreground transition-colors group-hover:text-primary">
                →
              </span>
            </a>
          ))}

          <a
            href="https://wa.me/573105376773"
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-md bg-primary px-6 py-3.5 text-center text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-transform hover:-translate-y-0.5"
          >
            Escribir por WhatsApp
          </a>
        </motion.div>
      </div>
    </section>
  );
}