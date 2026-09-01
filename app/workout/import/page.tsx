import Link from "next/link";
import BruceLeeQuote from "@/components/BruceLeeQuote";

export default function ImportWorkoutsPage() {
  return (
    <main className="apex-page">
      <p className="apex-kicker">ApexLoad</p>
      <h1 className="apex-title">Log past workouts</h1>
      <p className="apex-copy">
        Bringing over entries from a handwritten log book — pick how you want to get them in.
      </p>
      <BruceLeeQuote className="mt-4" />

      <div className="mt-6 flex flex-col gap-3">
        <Link
          href="/workout/log"
          className="apex-action"
        >
          <div>
            <p className="font-semibold text-chalk-100">Enter manually</p>
            <p className="mt-1 text-sm text-chalk-500">
              Pick a date, add exercises, and type in sets.
            </p>
          </div>
          <span className="font-mono text-xs text-copper-400">→</span>
        </Link>

        <Link
          href="/workout/import/photo"
          className="apex-action-primary"
        >
          <div>
            <p>Import from a photo</p>
            <p className="mt-1 text-sm font-normal text-steel-800">
              Read a logbook page, then review before saving.
            </p>
          </div>
          <span className="font-mono text-xs">→</span>
        </Link>
      </div>
    </main>
  );
}
