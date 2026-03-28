'use client';

const ITEMS: { color: string; label: string; desc: string; opacity?: number }[] = [
  { color: '#eecc22', label: '33° shell', desc: 'Low-latitude coverage' },
  { color: '#ff8844', label: '43° shell', desc: 'Mid-latitude coverage' },
  { color: '#6699ff', label: '53° shell', desc: 'Standard coverage orbits' },
  { color: '#22ddbb', label: '70° shell', desc: 'High-latitude coverage' },
  { color: '#ff4466', label: '97.6° polar', desc: 'Sun-synchronous polar orbits' },
  { color: '#dd55ff', label: 'In steering cone', desc: 'Satellite visible from dish' },
  { color: '#ff3366', label: 'Connected', desc: 'Actively serving your dish' },
  { color: '#ff9933', label: 'Gateway', desc: 'Operational ground station' },
  { color: '#ff9933', label: 'Planned GW', desc: 'Approved or under construction', opacity: 0.35 },
  { color: '#44ff44', label: 'GPS', desc: 'Navigation constellation (MEO)' },
];

export default function ColorLegend() {
  return (
    <div className="hud-panel p-3 w-full md:w-[160px]">
      <div className="text-[10px] uppercase tracking-[0.15em] text-cyan-400/60 mb-2">
        Legend
      </div>
      <div className="space-y-1">
        {ITEMS.map(({ color, label, desc, opacity }) => (
          <div key={label} className="flex items-start gap-2">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0 mt-[3px]"
              style={{ backgroundColor: color, opacity: opacity ?? 1, boxShadow: `0 0 4px ${color}80` }}
            />
            <div className="flex flex-col">
              <span className="text-[10px] text-white/60">{label}</span>
              <span className="text-[9px] text-white/45 leading-tight">{desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
