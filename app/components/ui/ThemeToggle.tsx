'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemePreference } from '@app/context/ThemeContext';

const options: { value: ThemePreference; icon: typeof Sun; labelTh: string; labelEn: string }[] = [
  { value: 'system', icon: Monitor, labelTh: 'ตามระบบ', labelEn: 'System' },
  { value: 'light', icon: Sun, labelTh: 'สว่าง', labelEn: 'Light' },
  { value: 'dark', icon: Moon, labelTh: 'มืด', labelEn: 'Dark' },
];

type Props = {
  language?: 'th' | 'en';
};

export default function ThemeToggle({ language = 'th' }: Props) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className="flex items-center gap-0.5 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-900/80 p-0.5"
      role="group"
      aria-label={language === 'th' ? 'เลือกธีมสี' : 'Theme'}
    >
      {options.map(({ value, icon: Icon, labelTh, labelEn }) => {
        const active = theme === value;
        const label = language === 'th' ? labelTh : labelEn;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            title={label}
            aria-label={label}
            aria-pressed={active}
            className={`rounded-full p-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 ${
              active
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
