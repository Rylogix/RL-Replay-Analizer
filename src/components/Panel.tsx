import type { PropsWithChildren, ReactNode } from 'react';

interface PanelProps extends PropsWithChildren {
  title?: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export const Panel = ({ title, subtitle, action, className, children }: PanelProps) => (
  <section className={`panel ${className ?? ''}`.trim()}>
    {(title || subtitle || action) && (
      <header className="panel__header">
        <div>
          {title ? <h2 className="panel__title">{title}</h2> : null}
          {subtitle ? <p className="panel__subtitle">{subtitle}</p> : null}
        </div>
        {action ? <div className="panel__action">{action}</div> : null}
      </header>
    )}
    <div className="panel__body">{children}</div>
  </section>
);

