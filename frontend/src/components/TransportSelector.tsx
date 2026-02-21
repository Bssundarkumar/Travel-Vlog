import type { TransportMode } from '../types/travel';
import { TRANSPORT_CONFIG } from '../utils/transportIcons';

interface TransportSelectorProps {
  value: TransportMode;
  onChange: (mode: TransportMode) => void;
}

const MODES: TransportMode[] = ['flight', 'car', 'bus', 'amtrak', 'rv'];

export default function TransportSelector({ value, onChange }: TransportSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">
        Mode of Transport
      </label>
      <div className="grid grid-cols-5 gap-2">
        {MODES.map(mode => {
          const config = TRANSPORT_CONFIG[mode];
          const isSelected = value === mode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => onChange(mode)}
              className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all
                ${isSelected
                  ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20'
                  : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                }`}
            >
              <span className="text-2xl">{config.emoji}</span>
              <span className={`text-xs font-medium ${isSelected ? 'text-blue-400' : 'text-gray-400'}`}>
                {config.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
