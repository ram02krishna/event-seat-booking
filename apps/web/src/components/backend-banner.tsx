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
    <div
      role="region"
      aria-label="Backend status notice"
      className="relative z-50 w-full border-b border-amber-500/25 bg-gradient-to-r from-amber-950/80 via-slate-900/95 to-amber-950/80 text-slate-100 shadow-md backdrop-blur-sm transition-all dark:from-amber-950/80 dark:via-slate-900/95 dark:to-amber-950/80"
      style={{
        backgroundColor: undefined,
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm">
        {/* Left: Headline & Explanation */}
        <div className="flex items-start sm:items-center gap-2.5 flex-1 min-w-0">
          <div className="p-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0 mt-0.5 sm:mt-0">
            <Server className="w-4 h-4" />
          </div>

          <div className="leading-relaxed text-slate-200">
            <span className="font-semibold text-amber-300 mr-1.5">
              Backend Notice:
            </span>
            <span>
              The backend API is deployed on <strong className="text-white font-medium">Render</strong> (free tier). Inactive instances spin down automatically, so the server takes about <strong className="text-amber-200 font-semibold">30–60 seconds</strong> to wake up on the first request.
            </span>
          </div>
        </div>

        {/* Right: Live Status Indicator & Actions */}
        <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-auto shrink-0">
          {serverState === 'online' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Backend Online</span>
            </span>
          ) : (
            <div className="inline-flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span>
                  Waking up server...{' '}
                  <span className="font-mono text-[11px] opacity-80">
                    ({elapsedSeconds}s)
                  </span>
                </span>
              </span>
              <button
                type="button"
                onClick={handleManualRetry}
                title="Retry pinging backend"
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
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
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
