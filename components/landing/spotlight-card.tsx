"use client";

import {
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useRef,
  useState,
} from "react";
import { useCoarsePointer, useReducedMotion } from "./use-reduced-motion";

type SpotlightCardProps = {
  children: ReactNode;
  className?: string;
};

export function SpotlightCard({
  children,
  className = "",
}: SpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const coarsePointer = useCoarsePointer();
  const interactive = !reducedMotion && !coarsePointer;

  const [glow, setGlow] = useState({ x: 50, y: 50, active: false });

  const handleMove = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (!interactive || !cardRef.current) {
        return;
      }
      const rect = cardRef.current.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      setGlow({ x, y, active: true });
    },
    [interactive],
  );

  const handleLeave = useCallback(() => {
    if (interactive) {
      setGlow(current => ({ ...current, active: false }));
    }
  }, [interactive]);

  const style = {
    "--card-glow-x": `${glow.x}%`,
    "--card-glow-y": `${glow.y}%`,
  } as CSSProperties;

  return (
    <div
      ref={cardRef}
      className={`pds-spotlight-card${className ? ` ${className}` : ""}${interactive ? " pds-spotlight-card--interactive" : ""}${glow.active ? " pds-spotlight-card--active" : ""}`}
      style={style}
      onMouseMove={interactive ? handleMove : undefined}
      onMouseLeave={interactive ? handleLeave : undefined}
    >
      <span className="pds-spotlight-card__glow" aria-hidden="true" />
      {children}
    </div>
  );
}
