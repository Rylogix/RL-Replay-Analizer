import type { ReactNode } from 'react';

interface TabOption<T extends string> {
  id: T;
  label: string;
  count?: ReactNode;
}

interface TabsProps<T extends string> {
  value: T;
  options: TabOption<T>[];
  onChange: (value: T) => void;
}

export const Tabs = <T extends string>({ value, options, onChange }: TabsProps<T>) => (
  <div className="tabs" role="tablist" aria-label="Replay tabs">
    {options.map((option) => (
      <button
        key={option.id}
        className={`tabs__button ${value === option.id ? 'tabs__button--active' : ''}`}
        onClick={() => onChange(option.id)}
        type="button"
      >
        <span>{option.label}</span>
        {option.count ? <span className="tabs__count">{option.count}</span> : null}
      </button>
    ))}
  </div>
);

