import Twin from '@/components/twin';

export default function Home() {
  return (
    <main className="twin-page-mesh min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14 md:py-16">
        <header className="mb-8 text-center sm:mb-10">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700/90">
            Career
          </p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
            Ed Folmi&apos;s Digital Twin
          </h1>
          <p className="mx-auto mt-3 max-w-md text-pretty text-sm leading-relaxed text-zinc-600 sm:text-base">
            A conversational way to explore my background, skills, and how I work.
          </p>
        </header>

        <div className="h-[min(640px,calc(100vh-14rem))] min-h-[420px] sm:min-h-[480px]">
          <Twin />
        </div>

        <footer className="mt-10 border-t border-zinc-200/80 pt-8 text-center">
          <p className="text-xs text-zinc-500">Ed Folmi, career digital twin</p>
          <p className="mt-1 text-[11px] text-zinc-400">
            For recruiters, hiring managers, and collaborators
          </p>
        </footer>
      </div>
    </main>
  );
}
