export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-muted-foreground sm:flex-row">
        <div>
          <p className="font-display font-bold text-foreground">Jefferson Montoya</p>
          <p className="text-xs uppercase tracking-[0.2em]">LegalTech Strategist · CBO</p>
        </div>
        <p>© {new Date().getFullYear()} · Arquitectura legal para la era de la IA.</p>
      </div>
    </footer>
  );
}