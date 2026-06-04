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

type DotFieldProps = {
  children: ReactNode;
  className?: string;
  /** Static spotlight anchor when motion/coarse pointer is active */
  defaultX?: number;
  defaultY?: number;
};

export function DotField({
  children,
  className = "",
  defaultX = 72,
  defaultY = 28,
}: DotFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const coarsePointer = useCoarsePointer();
  const interactive = !reducedMotion && !coarsePointer;

  const [spot, setSpot] = useState({ x: defaultX, y: defaultY });

  const handleMove = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!interactive || !rootRef.current) {
        return;
      }
      const rect = rootRef.current.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      setSpot({ x, y });
    },
    [interactive],
  );

  const style = {
    "--spot-x": `${spot.x}%`,
    "--spot-y": `${spot.y}%`,
  } as CSSProperties;

  return (
    <div
      ref={rootRef}
      className={`pds-dot-field${className ? ` ${className}` : ""}${interactive ? " pds-dot-field--interactive" : ""}`}
      style={style}
      onMouseMove={interactive ? handleMove : undefined}
    >
      <div className="pds-dot-field__pattern" aria-hidden="true" />
      <div className="pds-dot-field__spotlight" aria-hidden="true" />
      <div className="pds-dot-field__content">{children}</div>
    </div>
  );
}
