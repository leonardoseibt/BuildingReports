import * as React from "react";

export default function FormHeader({ title, subtitle, initials }: { title: React.ReactNode; subtitle?: React.ReactNode; initials?: string | null; }) {
  const i = (initials ?? '').slice(0,2).toUpperCase() || null;
  return (
    <div className="rounded-2xl border bg-white/80 backdrop-blur px-5 py-4 md:px-6 md:py-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-100 ring-1 ring-slate-200 flex items-center justify-center overflow-hidden">
            <span className="font-semibold text-slate-700">{i ?? ' '}</span>
          </div>
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h2>
          {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
    </div>
  );
}
