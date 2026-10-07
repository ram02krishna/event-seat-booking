'use client';

import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { Html5QrcodeScanner } from 'html5-qrcode';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  QrCode,
  Scan,
  RefreshCw,
  Camera,
  Search,
} from 'lucide-react';
import Link from 'next/link';

interface ScanResult {
  status: 'SUCCESS' | 'ALREADY_USED' | 'INVALID';
  message: string;
  checkedInAt?: string;
  attendee?: {
    email: string;
    eventTitle?: string;
    venue?: string;
    seat: string;
    tier?: string;
  };
}

export default function StaffScannerPage() {
  const { data: authData, isLoading: authLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => apiFetch('/api/auth/me'),
  });

  const user = authData?.user;
  const isAuthorized = user?.role === 'STAFF' || user?.role === 'ORGANIZER';

  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Play audio chime for feedback
  function playSound(type: 'success' | 'error') {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime); // A3
        osc.frequency.setValueAtTime(164.81, ctx.currentTime + 0.15); // E3
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch {
      // AudioContext unavailable
    }
  }

  async function handleValidateToken(token: string) {
    if (!token.trim() || isProcessing) return;
    setIsProcessing(true);

    try {
      const res = await apiFetch('/api/tickets/check-in', {
        method: 'POST',
        body: JSON.stringify({ qrToken: token.trim() }),
      });

      playSound('success');
      setScanResult({
        status: 'SUCCESS',
        message: 'Valid Ticket - Check-in Approved',
        checkedInAt: res.checkedInAt,
        attendee: res.attendee,
      });
    } catch (err: any) {
      playSound('error');
      if (err.message?.includes('already used')) {
        setScanResult({
          status: 'ALREADY_USED',
          message: 'Ticket Already Used',
          attendee: err.attendee,
          checkedInAt: err.checkedInAt,
        });
      } else {
        setScanResult({
          status: 'INVALID',
          message: err.message || 'Invalid QR code or ticket not found',
        });
      }
    } finally {
      setIsProcessing(false);
    }
  }

  // Initialize camera scanner
  useEffect(() => {
    if (!isAuthorized || !isCameraActive) return;

    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
      },
      false
    );

    scannerRef.current = scanner;

    scanner.render(
      (decodedText) => {
        handleValidateToken(decodedText);
        setIsCameraActive(false);
      },
      () => {
        // scan errors ignored
      }
    );

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [isAuthorized, isCameraActive]);

  if (authLoading) {
    return (
      <main className="max-w-md mx-auto px-4 py-20 text-center animate-pulse space-y-4">
        <div className="h-10 bg-slate-900 rounded-xl" />
        <div className="h-40 bg-slate-900 rounded-2xl" />
      </main>
    );
  }

  if (!isAuthorized) {
    return (
      <main className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <ShieldCheck className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-xl font-bold text-white">Staff Access Required</h2>
        <p className="text-xs text-slate-400">
          This portal is reserved for venue staff and organizers to check in attendees.
        </p>
        <Link
          href="/login"
          className="inline-block px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
        >
          Sign in as Staff
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-xl mx-auto px-4 py-10 space-y-6">
      <div className="text-center space-y-1.5">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <Scan className="w-3.5 h-3.5" />
          <span>Gate Scanner Active</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Staff Ticket Check-in</h1>
        <p className="text-xs text-slate-400">
          Scan attendee QR codes with device camera or enter ticket token manually.
        </p>
      </div>

      {/* Main Scanner Container */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl space-y-6">
        {/* Camera toggle */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-2">
            <Camera className="w-4 h-4 text-indigo-400" />
            Camera Scanning
          </span>
          <button
            onClick={() => setIsCameraActive((prev) => !prev)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              isCameraActive
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            {isCameraActive ? 'Stop Camera' : 'Start Camera'}
          </button>
        </div>

        {/* HTML5 QR Camera view container */}
        {isCameraActive && (
          <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950 p-2">
            <div id="qr-reader" className="w-full" />
          </div>
        )}

        {/* Manual Token input (Great for demo / quick test) */}
        <div className="space-y-2 pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-slate-400">
              Manual Token / UUID Verification
            </label>
            <Link
              href="/my-tickets"
              className="text-[11px] text-indigo-400 hover:text-indigo-300 underline"
            >
              Open My Tickets &rarr;
            </Link>
          </div>
          <p className="text-[11px] text-slate-500">
            Paste the UUID Token from the attendee&apos;s ticket or click &quot;Copy UUID&quot; from their ticket pass.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && manualToken.trim()) {
                  handleValidateToken(manualToken);
                }
              }}
              className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={() => handleValidateToken(manualToken)}
              disabled={isProcessing || !manualToken.trim()}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs transition-colors flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Verify</span>
            </button>
          </div>
        </div>

        {/* Scan Result Feedback Card */}
        {scanResult && (
          <div
            className={`p-5 rounded-xl border text-xs space-y-3 animate-in fade-in zoom-in-95 duration-200 ${
              scanResult.status === 'SUCCESS'
                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                : scanResult.status === 'ALREADY_USED'
                ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {scanResult.status === 'SUCCESS' && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                )}
                {scanResult.status === 'ALREADY_USED' && (
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                )}
                {scanResult.status === 'INVALID' && (
                  <XCircle className="w-5 h-5 text-rose-400" />
                )}
                <span className="font-bold text-sm text-white">
                  {scanResult.message}
                </span>
              </div>
              <button
                onClick={() => setScanResult(null)}
                className="text-[11px] underline opacity-70 hover:opacity-100"
              >
                Clear
              </button>
            </div>

            {scanResult.attendee && (
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5 text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Attendee:</span>
                  <span className="font-medium text-white">
                    {scanResult.attendee.email}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Assigned Seat:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {scanResult.attendee.seat} ({scanResult.attendee.tier || 'STANDARD'})
                  </span>
                </div>
                {scanResult.attendee.eventTitle && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Event:</span>
                    <span>{scanResult.attendee.eventTitle}</span>
                  </div>
                )}
                {scanResult.checkedInAt && (
                  <div className="flex justify-between pt-1 border-t border-slate-800 text-[11px] text-slate-400">
                    <span>Scan Timestamp:</span>
                    <span className="font-mono">
                      {new Date(scanResult.checkedInAt).toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => {
                setScanResult(null);
                setManualToken('');
                setIsCameraActive(true);
              }}
              className="w-full py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Ready for Next Attendee</span>
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
