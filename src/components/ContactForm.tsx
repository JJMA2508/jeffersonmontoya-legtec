import { useState } from "react";
import { motion } from "motion/react";
import { z } from "zod";
import { toast } from "sonner";

const schema = z.object({
  name: z.string().trim().min(2, "Ingresa tu nombre").max(100),
  company: z.string().trim().min(2, "Ingresa tu empresa").max(120),
  problem: z.string().trim().min(10, "Describe brevemente el problema").max(1000),
});

export function ContactForm() {
  const [values, setValues] = useState({ name: "", company: "", problem: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = schema.safeParse(values);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        fieldErrors[issue.path[0] as string] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    toast.success("Solicitud recibida. Te contactaré en breve.");
    setValues({ name: "", company: "", problem: "" });
  }

  return (
    <section id="contacto" className="mx-auto max-w-6xl px-6 py-24">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-start">
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
            Acceso directo y confidencial. Cuéntame el problema principal a resolver y
            diseñaremos la arquitectura legal adecuada.
          </p>
        </motion.div>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-bunker)]"
        >
          <Field
            label="Nombre"
            value={values.name}
            onChange={(v) => setValues((s) => ({ ...s, name: v }))}
            error={errors.name}
            placeholder="Tu nombre completo"
          />
          <Field
            label="Empresa"
            value={values.company}
            onChange={(v) => setValues((s) => ({ ...s, company: v }))}
            error={errors.company}
            placeholder="Nombre de la organización"
          />
          <div className="mt-5">
            <label className="mb-2 block text-sm font-medium">Problema principal a resolver</label>
            <textarea
              value={values.problem}
              onChange={(e) => setValues((s) => ({ ...s, problem: e.target.value }))}
              rows={4}
              maxLength={1000}
              placeholder="Describe el reto operativo, legal o tecnológico."
              className="w-full resize-none rounded-md border border-input bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
            />
            {errors.problem && <p className="mt-1.5 text-xs text-destructive">{errors.problem}</p>}
          </div>
          <button
            type="submit"
            className="mt-7 w-full rounded-md bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-transform hover:-translate-y-0.5"
          >
            Solicitar Consultoría Estratégica
          </button>
        </motion.form>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
}) {
  return (
    <div className="mt-5 first:mt-0">
      <label className="mb-2 block text-sm font-medium">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={120}
        className="w-full rounded-md border border-input bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
      />
      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </div>
  );
}