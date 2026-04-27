'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Sun, Moon, Palette as PaletteIcon, Check } from 'lucide-react';
import { useTheme, type Palette } from '@/lib/theme';

interface PaletteOption {
  id: Palette;
  name: string;
  description: string;
  swatches: string[];
}

const PALETTES: PaletteOption[] = [
  {
    id: 'miramar',
    name: 'Mira Mar',
    description:
      'The Brand Edition — oxblood, dusty rose and warm cream. Heritage held lightly. Default.',
    swatches: ['#4B0108', '#A4515E', '#F3ECE7', '#FFFDFB', '#161412'],
  },
  {
    id: 'classic',
    name: 'Classic',
    description:
      'The original dashboard look — neutral grays with blue accents. Use this if you prefer the previous palette.',
    swatches: ['#1f2937', '#3b82f6', '#f3f4f6', '#ffffff', '#111827'],
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const { palette, setPalette, mode, setMode } = useTheme();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition mb-6 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <header className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
            Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Personalize how the dashboard looks for you. Changes apply instantly and persist on this device.
          </p>
        </header>

        {/* Appearance */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Sun className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Appearance
            </h2>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Mode</div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Defaults to dark. Switch from the header sun/moon button or here.
                </p>
              </div>
              <div className="flex items-center bg-gray-100 dark:bg-gray-900 rounded-lg p-1">
                <button
                  onClick={() => setMode('light')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition cursor-pointer ${
                    mode === 'light'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Sun className="w-4 h-4" />
                  Light
                </button>
                <button
                  onClick={() => setMode('dark')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition cursor-pointer ${
                    mode === 'dark'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Moon className="w-4 h-4" />
                  Dark
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Palette */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <PaletteIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Palette
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {PALETTES.map((opt) => {
              const selected = palette === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setPalette(opt.id)}
                  className={`relative text-left bg-white dark:bg-gray-800 rounded-xl shadow p-5 border-2 transition-all cursor-pointer hover:shadow-md ${
                    selected
                      ? 'border-blue-600 dark:border-blue-400'
                      : 'border-transparent hover:border-gray-200 dark:hover:border-gray-700'
                  }`}
                >
                  {selected && (
                    <span className="absolute top-3 right-3 w-6 h-6 rounded-full bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center">
                      <Check className="w-4 h-4" />
                    </span>
                  )}
                  <div className="font-medium text-gray-900 dark:text-white">{opt.name}</div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-4">
                    {opt.description}
                  </p>
                  <div className="flex gap-1.5">
                    {opt.swatches.map((hex, i) => (
                      <span
                        key={i}
                        className="w-8 h-8 rounded-md border border-gray-200 dark:border-gray-700"
                        style={{ background: hex }}
                        title={hex}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Theme preferences are stored in your browser's local storage and only on this device.
        </p>
      </div>
    </div>
  );
}
