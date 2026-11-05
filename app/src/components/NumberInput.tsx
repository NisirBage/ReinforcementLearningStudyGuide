// A number box that keeps what the learner types (so it can be cleared and retyped) and reports a number only
// when the text is a valid one inside [min, max]. Fractions such as 1/3 are accepted when `fractions` is set.
import { useEffect, useState } from "react";

interface Props {
  value: number;
  onChange: (x: number) => void;
  label?: string; // accessible name when there is no visible <label>
  min?: number;
  max?: number;
  integer?: boolean;
  fractions?: boolean;
  className?: string;
  describedBy?: string;
}

export function parseNumberText(text: string, fractions = false): number | null {
  const t = text.trim();
  if (!t) return null;
  const frac = fractions ? /^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(t) : null;
  if (frac) return Number(frac[2]) === 0 ? null : Number(frac[1]) / Number(frac[2]);
  const x = Number(t.replace(/^−/, "-"));
  return Number.isFinite(x) ? x : null;
}

export function NumberInput({ value, onChange, label, min, max, integer, fractions, className = "mini-input", describedBy }: Props) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);
  // Follow outside changes (presets) unless the learner is typing.
  useEffect(() => {
    if (!focused) setText(String(Math.round(value * 1e6) / 1e6));
  }, [value, focused]);
  const x = parseNumberText(text, fractions);
  const valid = x !== null && (min === undefined || x >= min) && (max === undefined || x <= max) && (!integer || Number.isInteger(x));
  return (
    <input
      className={className}
      inputMode="decimal"
      aria-label={label}
      aria-invalid={!valid || undefined}
      aria-describedby={describedBy}
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        if (!valid) setText(String(Math.round(value * 1e6) / 1e6)); // an invalid entry falls back to the last valid value
      }}
      onChange={(e) => {
        setText(e.target.value);
        const y = parseNumberText(e.target.value, fractions);
        if (y !== null && (min === undefined || y >= min) && (max === undefined || y <= max) && (!integer || Number.isInteger(y))) onChange(y);
      }}
    />
  );
}
