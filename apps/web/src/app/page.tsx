export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-3xl space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          <span>Phase 1 Initialized</span>
          <span>•</span>
          <span>Monorepo & CI Ready</span>
        </div>
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-white">
          Concurrency-Safe <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
            Event Ticketing System
          </span>
        </h1>
        <p className="text-slate-400 text-lg max-w-xl mx-auto">
          High-concurrency ticket reservations with interactive SVG seat map,
          atomic PostgreSQL conditional holds, BullMQ auto-expiry, and QR code check-in.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left pt-6">
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
            <h3 className="font-semibold text-slate-200">Atomic Seat Holds</h3>
            <p className="text-sm text-slate-400 mt-1">
              Zero double-booking guarantee via conditional raw SQL transactions.
            </p>
          </div>
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
            <h3 className="font-semibold text-slate-200">Real-Time Sync</h3>
            <p className="text-sm text-slate-400 mt-1">
              Live seat state broadcasted instantly across users with Socket.IO.
            </p>
          </div>
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
            <h3 className="font-semibold text-slate-200">Fraud-Proof QR</h3>
            <p className="text-sm text-slate-400 mt-1">
              Cryptographic QR codes with atomic check-in verification for venue staff.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
