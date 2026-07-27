import type { ReactNode } from "react";

type SpaceHeaderProps = {
  title: string;
  count: number;
  countLabel: string;
  titleId?: string;
  controls?: ReactNode;
};

export function SpaceHeader({
  title,
  count,
  countLabel,
  titleId,
  controls,
}: SpaceHeaderProps) {
  return (
    <header className="space-header">
      <div className="space-heading">
        <h1 id={titleId}>{title}</h1>
        <span className="space-count" aria-label={countLabel}>
          {count}
        </span>
      </div>
      {controls ? <div className="space-filter">{controls}</div> : null}
    </header>
  );
}
