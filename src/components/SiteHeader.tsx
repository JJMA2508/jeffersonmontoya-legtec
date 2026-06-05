import { useState } from "react";

const links = [
  { label: "Especialización", href: "#especializacion" },
  { label: "Filosofía", href: "#filosofia" },
  { label: "Contacto", href: "#contacto" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="#top" className="flex flex-col leading-none">
          <span className="font-display text-base font-extrabold tracking-tight">
            Jefferson Montoya
          </span>
          <span className="text-[0.65rem] uppercase tracking-[0.25em] text-muted-foreground">
            LegalTech · AI · CBO
          </span>
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
          <a
            href="#contacto"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Consultoría
          </a>
        </nav>

        <button
          onClick={() => setOpen((v) => !v)}
          className="text-sm text-muted-foreground md:hidden"
          aria-label="Abrir menú"
        >
          {open ? "Cerrar" : "Menú"}
        </button>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-border/60 px-6 py-4 md:hidden">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="py-2 text-sm text-muted-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}