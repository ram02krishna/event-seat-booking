import React from 'react';
import { Film, Presentation, Landmark, Flame, Building2 } from 'lucide-react';

export type VenueTypeKey = 'THEATER_DOLBY' | 'CONFERENCE_HALL' | 'AUDITORIUM' | 'ARENA' | 'OTHERS';

interface VenueBadgeProps {
  type?: VenueTypeKey | string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const BADGE_CONFIG: Record<
  VenueTypeKey,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    // Rich contrast for both light & dark modes
    styleClass: string;
    iconColor: string;
  }
> = {
  THEATER_DOLBY: {
    label: 'Dolby Atmos Cinema',
    icon: Film,
    styleClass:
      'bg-violet-50 text-violet-800 border-violet-200 shadow-sm dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-500/40',
    iconColor: 'text-violet-600 dark:text-violet-400',
  },
  CONFERENCE_HALL: {
    label: 'Conference Hall',
    icon: Presentation,
    styleClass:
      'bg-sky-50 text-sky-800 border-sky-200 shadow-sm dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-500/40',
    iconColor: 'text-sky-600 dark:text-sky-400',
  },
  AUDITORIUM: {
    label: 'Grand Auditorium',
    icon: Landmark,
    styleClass:
      'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200 shadow-sm dark:bg-fuchsia-950/50 dark:text-fuchsia-300 dark:border-fuchsia-500/40',
    iconColor: 'text-fuchsia-600 dark:text-fuchsia-400',
  },
  ARENA: {
    label: 'Live Concert Arena',
    icon: Flame,
    styleClass:
      'bg-rose-50 text-rose-800 border-rose-200 shadow-sm dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-500/40',
    iconColor: 'text-rose-600 dark:text-rose-400',
  },
  OTHERS: {
    label: 'Multipurpose Venue',
    icon: Building2,
    styleClass:
      'bg-slate-100 text-slate-800 border-slate-200 shadow-sm dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    iconColor: 'text-slate-600 dark:text-slate-400',
  },
};

export function VenueBadge({ type, size = 'sm', className = '' }: VenueBadgeProps) {
  if (!type) return null;

  const key = (type as VenueTypeKey) in BADGE_CONFIG ? (type as VenueTypeKey) : 'OTHERS';
  const config = BADGE_CONFIG[key] || BADGE_CONFIG.OTHERS;
  const IconComponent = config.icon;

  const sizeClasses = {
    sm: 'text-[11px] font-semibold px-2.5 py-0.5 gap-1.5 rounded-full border tracking-wide',
    md: 'text-xs font-semibold px-3 py-1 gap-2 rounded-full border tracking-wide',
    lg: 'text-sm font-bold px-3.5 py-1.5 gap-2.5 rounded-xl border',
  }[size];

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  }[size];

  return (
    <span
      className={`inline-flex items-center transition-colors ${sizeClasses} ${config.styleClass} ${className}`}
    >
      <IconComponent className={`${iconSizes} ${config.iconColor} shrink-0`} />
      <span>{config.label}</span>
    </span>
  );
}
