import Link from "next/link";

export default function ImportWorkoutsPage() {
  return (
    <main className="min-h-screen px-5 pb-24 pt-8">
      <p className="font-mono text-xs uppercase tracking-widest text-copper-500">ApexLoad</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold text-chalk-100">Log past workouts</h1>
      <p className="mt-1 text-sm text-chalk-500">
        Bringing over entries from a handwritten log book — pick how you want to get them in.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <Link
          href="/workout/log"
          className="rounded-2xl border border-steel-700 bg-steel-900 p-4"
        >
          <p className="font-display text-lg font-bold text-chalk-100">Enter manually</p>
          <p className="mt-1 text-sm text-chalk-500">
            Pick a date, add exercises, and type in the sets — built for typing in a whole page at
            once, no live timer needed.
          </p>
        </Link>

        <Link
          href="/workout/import/photo"
          className="rounded-2xl border border-steel-700 bg-steel-900 p-4"
        >
          <p className="font-display text-lg font-bold text-chalk-100">Import from a photo</p>
          <p className="mt-1 text-sm text-chalk-500">
            Take a picture of a log book page and have it read into your history automatically.
            You'll always get a chance to review and correct it before anything is saved.
          </p>
        </Link>
      </div>
    </main>
  );
}
