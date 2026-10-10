'use client';

import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Server, Loader2, CheckCircle2, AlertCircle, RefreshCw, X } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type ServerState = 'checking' | 'waking' | 'online' | 'error';

export function BackendBanner() {
  const queryClient = useQueryClient();
  const [serverState, setServerState] = useState<ServerState>('checking');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const checkCountRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setIsMounted(true);
    // Check if dismissed in this session
    try {
      if (sessionStorage.getItem('backend_notice_dismissed') === 'true') {
        setIsDismissed(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const pingBackend = async () => {
    try {
      checkCountRef.current += 1;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(`${API_URL}/health`, {
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        setServerState('online');
        // Automatically refetch active queries once backend is awake
        queryClient.invalidateQueries();
        return true;
      } else {
        setServerState('waking');
        return false;
      }
    } catch {
      setServerState('waking');
      return false;
    }
  };

  useEffect(() => {
    let active = true;
    let pollInterval: NodeJS.Timeout | null = null;

    // Start timer for elapsed cold-start seconds
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    const checkStatus = async () => {
      const isOnline = await pingBackend();
      if (!isOnline && active) {
        // Poll every 4 seconds while waking up
        pollInterval = setInterval(async () => {
          if (!active) return;
          const ok = await pingBackend();
          if (ok && pollInterval) {
            clearInterval(pollInterval);
            if (timerRef.current) clearInterval(timerRef.current);
          }
        }, 4000);
      } else if (isOnline) {
        if (timerRef.current) clearInterval(timerRef.current);
      }
    };

    checkStatus();

    return () => {
      active = false;
      if (pollInterval) clearInterval(pollInterval);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [queryClient]);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem('backend_notice_dismissed', 'true');
    } catch {
      // ignore
    }
  };

  const handleManualRetry = () => {
    setServerState('checking');
    pingBackend();
  };

  if (!isMounted || isDismissed) {
    return null;
  }

  return (
    <aside
      role="region"
      aria-label="Backend status notice"
      className="relative z-50 w-full border-b border-indigo-500/20 bg-[#0c1022]/95 backdrop-blur-md text-slate-200 transition-colors"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm">
        {/* Left: Icon, Badge & Explanation */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 flex items-center justify-center shrink-0 shadow-sm shadow-indigo-500/10">
            <Server className="w-3.5 h-3.5" />
          </div>

          <div className="leading-snug text-slate-300 flex-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 mr-2 tracking-wide">
              Backend Notice
            </span>
            <span className="text-slate-300 text-xs sm:text-sm">
              Hosted on <strong className="text-white font-medium">Render</strong> (free tier). Inactive instances spin down automatically, so the first request takes about <strong className="text-indigo-300 font-semibold">30–60s</strong> to wake up.
            </span>
          </div>
        </div>

        {/* Right: Live Status Indicator & Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5 self-end sm:self-auto shrink-0">
          {serverState === 'online' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shadow-sm shadow-emerald-500/10">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Backend Online</span>
            </span>
          ) : (
            <div className="inline-flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                <span>
                  Waking server...{' '}
                  <span className="font-mono text-[11px] text-indigo-200 opacity-90">
                    ({elapsedSeconds}s)
                  </span>
                </span>
              </span>
              <button
                type="button"
                onClick={handleManualRetry}
                title="Retry connection"
                className="p-1 rounded-md text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/15 transition-colors cursor-pointer"
                aria-label="Retry connection check"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Dismiss button */}
          <button
            type="button"
            onClick={handleDismiss}
            title="Dismiss notice"
            aria-label="Dismiss notice"
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer ml-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
