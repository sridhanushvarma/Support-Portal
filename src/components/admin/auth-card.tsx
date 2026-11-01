import { LogoMark } from "@/components/site/logo";

export function AuthCard({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2.5 text-lg font-bold text-navy">
          <LogoMark /> Website administration
        </div>
        <div className="card p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-navy">{title}</h1>
          {intro && <p className="mt-2 text-ink-soft">{intro}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </main>
  );
}
