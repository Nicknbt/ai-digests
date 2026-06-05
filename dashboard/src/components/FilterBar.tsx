import { useState } from 'react';

type Filter = 'all' | 'frontend' | 'rabbit-hole';

interface FilterBarProps {
  counts: { all: number; frontend: number; 'rabbit-hole': number };
  onChange: (filter: Filter) => void;
}

const FILTERS: { key: Filter; label: string; icon: string }[] = [
  { key: 'all', label: 'All Digests', icon: '📋' },
  { key: 'frontend', label: 'Frontend', icon: '🖥️' },
  { key: 'rabbit-hole', label: 'Rabbit Hole', icon: '🐇' },
];

export default function FilterBar({ counts, onChange }: FilterBarProps) {
  const [active, setActive] = useState<Filter>('all');

  return (
    <div class="flex flex-wrap gap-2">
      {FILTERS.map((f) => (
        <button
          key={f.key}
          onClick={() => { setActive(f.key); onChange(f.key); }}
          class={[
            'flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all',
            active === f.key
              ? 'bg-gray-900 text-white shadow-sm'
              : 'bg-white text-gray-600 ring-1 ring-inset ring-gray-200 hover:bg-gray-50',
          ].join(' ')}
        >
          <span>{f.icon}</span>
          <span>{f.label}</span>
          <span class={[
            'ml-0.5 rounded-full px-1.5 py-0.5 text-xs tabular-nums',
            active === f.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500',
          ].join(' ')}>
            {counts[f.key]}
          </span>
        </button>
      ))}
    </div>
  );
}
