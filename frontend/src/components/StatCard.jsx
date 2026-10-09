import React from 'react';

const TONES = {
  default: { wrap: '', strip: 'strip-primary', icon: 'text-muted-foreground' },
  primary: {
    wrap: '!bg-[hsl(var(--primary))] text-white border-transparent',
    strip: '', icon: 'text-white/80', dark: true,
  },
  soft: {
    wrap: '!bg-[hsl(var(--primary-soft))] text-[hsl(var(--primary-soft-foreground))]',
    strip: 'strip-primary', icon: 'text-[hsl(var(--primary))]',
  },
  info: {
    wrap: '!bg-[hsl(var(--info-soft))] text-[hsl(var(--info-soft-foreground))]',
    strip: 'strip-info', icon: 'text-[hsl(var(--info))]',
  },
  success: {
    wrap: '!bg-[hsl(var(--success-soft))] text-[hsl(var(--success-soft-foreground))]',
    strip: 'strip-success', icon: 'text-[hsl(var(--success))]',
  },
  warning: {
    wrap: '!bg-[hsl(var(--warning-soft))] text-[hsl(var(--warning-soft-foreground))]',
    strip: 'strip-warning', icon: 'text-[hsl(var(--warning))]',
  },
  danger: {
    wrap: '!bg-[hsl(var(--danger-soft))] text-[hsl(var(--danger-soft-foreground))]',
    strip: 'strip-danger', icon: 'text-[hsl(var(--danger))]',
  },
  violet: {
    wrap: '!bg-[hsl(var(--bonus-6)/0.10)] text-[hsl(var(--bonus-6))]',
    strip: 'strip-violet', icon: 'text-[hsl(var(--bonus-6))]',
  },
};

export const StatCard = ({ label, value, sub, icon: Icon, tone = 'default', testid }) => {
  const t = TONES[tone] || TONES.default;
  return (
    <div
      className={`card-c strip ${t.strip} px-3 py-2.5 md:px-3.5 md:py-3 ${t.wrap}`}
      data-testid={testid}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`text-[10.5px] font-semibold uppercase tracking-wide ${t.dark ? 'text-white/80' : 'opacity-70'}`}>
          {label}
        </p>
        {Icon ? <Icon className={`h-3.5 w-3.5 shrink-0 ${t.icon}`} /> : null}
      </div>
      <p className={`mt-1 font-mono text-lg font-semibold leading-tight md:text-xl ${t.dark ? 'text-white' : ''}`}>
        {value}
      </p>
      {sub ? (
        <p className={`mt-0.5 text-[11px] leading-snug ${t.dark ? 'text-white/80' : 'opacity-70'}`}>{sub}</p>
      ) : null}
    </div>
  );
};

export default StatCard;
