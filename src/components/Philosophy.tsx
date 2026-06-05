import { motion } from "motion/react";

export function Philosophy() {
  return (
    <section id="filosofia" className="relative border-y border-border bg-card/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-24 lg:grid-cols-[1fr_1.2fr] lg:items-center">
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-xs uppercase tracking-[0.25em] text-accent">Filosofía</p>
          <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">
            La tecnología al servicio del criterio
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="space-y-5 text-lg leading-relaxed text-muted-foreground"
        >
          <p>
            Como estratega y escritor, entiendo el derecho como un sistema de decisiones bajo
            incertidumbre. La inteligencia artificial no reemplaza ese juicio: lo amplifica,
            despejando el ruido para que la decisión correcta sea también la más rápida.
          </p>
          <p className="text-foreground">
            Mi trabajo conecta la precisión de la tecnología con la profundidad del pensamiento
            jurídico, construyendo organizaciones legales que deciden mejor y operan con
            exclusividad.
          </p>
          <p className="border-l-2 border-primary pl-5 font-display text-foreground">
            “Automatizar lo repetitivo para liberar lo estratégico.”
          </p>
        </motion.div>
      </div>
    </section>
  );
}