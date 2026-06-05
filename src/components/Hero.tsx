import { motion } from "motion/react";
import heroBg from "@/assets/hero-bunker.jpg";

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <img
        src={heroBg}
        alt="Arquitectura tipo búnker que representa la estrategia legal blindada"
        width={1920}
        height={1080}
        className="absolute inset-0 h-full w-full object-cover opacity-50"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/60 to-background" />

      <div className="relative mx-auto flex min-h-[92vh] max-w-6xl flex-col justify-center px-6 pb-20 pt-36">
        <motion.span
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-muted-foreground"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Abogado · LegalTech Strategist
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05 }}
          className="max-w-3xl text-4xl font-extrabold leading-[1.05] sm:text-6xl lg:text-7xl"
        >
          Arquitectura Legal para la{" "}
          <span className="text-gradient">Era de la IA</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="mt-6 max-w-xl text-lg text-muted-foreground"
        >
          Estrategia, automatización y eficiencia operativa para el derecho moderno.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="mt-10 flex flex-wrap items-center gap-4"
        >
          <a
            href="#contacto"
            className="rounded-md bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-transform hover:-translate-y-0.5"
          >
            Solicitar Consultoría Estratégica
          </a>
          <a
            href="#especializacion"
            className="rounded-md border border-border px-7 py-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            Ver especialización
          </a>
        </motion.div>
      </div>
    </section>
  );
}