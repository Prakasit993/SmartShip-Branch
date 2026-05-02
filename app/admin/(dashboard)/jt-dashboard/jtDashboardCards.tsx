export function StatCard({
    label,
    value,
    icon,
    accent,
    hint,
}: {
    label: string;
    value: string;
    icon: string;
    accent: string;
    hint: string;
}) {
    return (
        <div className="relative overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-950/50 p-5 shadow-inner">
            <div className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${accent} opacity-20 blur-2xl`} />
            <p className="text-2xl mb-2 drop-shadow-sm">{icon}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
            <p className="text-2xl font-black mt-1 tabular-nums tracking-tight text-white">{value}</p>
            <p className="text-[10px] text-zinc-600 mt-1 leading-snug">{hint}</p>
        </div>
    );
}

export function FeeCard({
    label,
    value,
    icon,
    accent,
    hint,
}: {
    label: string;
    value: string;
    icon: string;
    accent: string;
    hint?: string;
}) {
    return (
        <div className="rounded-2xl border border-zinc-800/90 bg-zinc-950/50 p-5 flex items-start gap-4 shadow-inner">
            <span className="text-3xl shrink-0">{icon}</span>
            <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
                <p className={`text-xl font-black tabular-nums mt-0.5 ${accent}`}>{value}</p>
                {hint ? <p className="text-[10px] text-zinc-600 mt-1 leading-snug">{hint}</p> : null}
            </div>
        </div>
    );
}
