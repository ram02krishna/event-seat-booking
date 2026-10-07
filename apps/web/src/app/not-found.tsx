import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main className="max-w-sm mx-auto px-4 py-24 text-center space-y-4">
      <p className="text-5xl font-black text-slate-300 dark:text-slate-700">404</p>
      <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Page Not Found</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        This page doesn't exist or has been moved.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Events
      </Link>
    </main>
  );
}
