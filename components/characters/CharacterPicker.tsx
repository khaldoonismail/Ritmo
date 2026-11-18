"use client";

import { useEffect, useRef, useState } from "react";
import { colors, radius } from "@/lib/theme";
import SvgPuppet from "./SvgPuppet";
import { CHARACTER_KINDS, OUTFITS, SKIN_TONES, type CharacterChoice } from "./choice";

// "Choose your runner!": big tappable cards with live (idling, blinking)
// previews, a big preview that cheers when you pick, and skin tone /
// clothes colour for the boy and girl. Plain SVG, no 3D canvas, so it is
// light on old tablets. Shared by Note Runner and Up or Down.

export default function CharacterPicker({
  value,
  onChange,
  onDone,
  doneLabel = "Let’s run!",
}: {
  value: CharacterChoice;
  onChange: (c: CharacterChoice) => void;
  onDone: () => void;
  doneLabel?: string;
}) {
  const custom = CHARACTER_KINDS.find((k) => k.kind === value.kind)?.custom ?? false;
  const name = CHARACTER_KINDS.find((k) => k.kind === value.kind)?.name ?? "";
  const [cheer, setCheer] = useState(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setCheer((c) => c + 1);
  }, [value.kind, value.skin, value.outfit]);

  return (
    <div className="cp-root">
      <style>{CSS}</style>
      <h1 className="cp-title">Choose your runner!</h1>
      <div className="cp-layout">
        <div className="cp-grid" role="radiogroup" aria-label="Runner">
          {CHARACTER_KINDS.map(({ kind, name: n }) => {
            const on = kind === value.kind;
            return (
              <button
                key={kind}
                type="button"
                role="radio"
                aria-checked={on}
                className={`cp-card${on ? " cp-on" : ""}`}
                onClick={() => onChange({ ...value, kind })}
              >
                <div className="cp-preview">
                  <SvgPuppet choice={{ ...value, kind }} className="cp-puppet" />
                </div>
                <span className="cp-name">{n}</span>
                {on && <span className="cp-tick">✓</span>}
              </button>
            );
          })}
        </div>
        <div className="cp-panel">
          <div className="cp-big">
            <SvgPuppet choice={value} reaction={{ state: "happy", key: cheer }} className="cp-puppet" label={name} />
          </div>
          <div className="cp-opts">
            <div className="cp-panel-name">{name}</div>
            {custom && (
              <>
                <div className="cp-label">Skin</div>
                <div className="cp-swatches" role="radiogroup" aria-label="Skin tone">
                  {SKIN_TONES.map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      role="radio"
                      aria-checked={value.skin === i}
                      aria-label={`Skin tone ${i + 1}`}
                      className={`cp-swatch${value.skin === i ? " cp-swatch-on" : ""}`}
                      style={{ background: c }}
                      onClick={() => onChange({ ...value, skin: i })}
                    />
                  ))}
                </div>
                <div className="cp-label">Clothes</div>
                <div className="cp-swatches" role="radiogroup" aria-label="Clothes colour">
                  {OUTFITS.map((o, i) => (
                    <button
                      key={i}
                      type="button"
                      role="radio"
                      aria-checked={value.outfit === i}
                      aria-label={o.name}
                      className={`cp-swatch${value.outfit === i ? " cp-swatch-on" : ""}`}
                      style={{ background: `linear-gradient(135deg, ${o.main} 62%, ${o.accent} 62%)` }}
                      onClick={() => onChange({ ...value, outfit: i })}
                    />
                  ))}
                </div>
              </>
            )}
            <button type="button" className="cp-go" onClick={onDone}>
              {doneLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.cp-root { min-height: 100dvh; background: linear-gradient(#7FD1FF 0%, #CFF0FF 65%, #C9F0B4 100%); padding: max(16px, env(safe-area-inset-top)) 16px 24px; box-sizing: border-box; color: ${colors.textPrimary}; font-family: inherit; }
.cp-title { margin: 0 0 14px; text-align: center; font-size: clamp(1.7rem, 4.2vw, 2.4rem); font-weight: 900; color: #fff; text-shadow: 0 3px 0 #2B2745; letter-spacing: 0.5px; }
.cp-layout { display: grid; gap: 16px; max-width: 1100px; margin: 0 auto; }
@media (min-width: 900px) and (orientation: landscape) { .cp-layout { grid-template-columns: 1fr 300px; align-items: start; } }
.cp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.cp-card { position: relative; display: flex; flex-direction: column; align-items: center; padding: 8px 8px 10px; border-radius: ${radius.card}; border: 4px solid #2B2745; background: #fff; box-shadow: 0 6px 0 #2B2745; cursor: pointer; font: inherit; color: inherit; touch-action: manipulation; transition: transform 0.12s; }
.cp-card:active { transform: translateY(3px); box-shadow: 0 3px 0 #2B2745; }
.cp-card.cp-on { background: #FFF6C9; outline: 4px solid ${colors.blueText}; outline-offset: 3px; }
.cp-preview { width: 100%; aspect-ratio: 1 / 1; max-height: 200px; border-radius: 14px; background: radial-gradient(40% 8% at 50% 88%, rgba(43,39,69,0.18) 0 95%, transparent 100%), #E7F7FF; display: grid; place-items: center; overflow: hidden; }
.cp-puppet { width: 86%; height: 86%; }
.cp-name { margin-top: 6px; font-weight: 900; font-size: 1.1rem; }
.cp-tick { position: absolute; top: -10px; right: -10px; width: 34px; height: 34px; border-radius: 50%; background: ${colors.blueText}; border: 3px solid #2B2745; color: #fff; display: grid; place-items: center; font-weight: 900; }
.cp-panel { background: #fff; border: 4px solid #2B2745; border-radius: 20px; padding: 14px; box-shadow: 0 6px 0 #2B2745; display: grid; grid-template-columns: minmax(150px, 38%) 1fr; align-items: center; gap: 14px; }
.cp-opts { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; min-width: 0; }
@media (min-width: 900px) and (orientation: landscape) { .cp-panel { display: flex; flex-direction: column; align-items: center; gap: 8px; } .cp-opts { align-items: center; align-self: stretch; } }
.cp-big { width: 100%; max-width: 250px; aspect-ratio: 1 / 1; border-radius: 16px; background: radial-gradient(40% 8% at 50% 88%, rgba(43,39,69,0.18) 0 95%, transparent 100%), #E7F7FF; display: grid; place-items: center; overflow: hidden; }
.cp-panel-name { font-weight: 900; font-size: 1.35rem; }
.cp-label { align-self: stretch; text-align: left; font-weight: 900; font-size: 0.95rem; opacity: 0.7; margin-top: 2px; }
.cp-swatches { align-self: stretch; display: flex; flex-wrap: wrap; gap: 10px; }
.cp-swatch { width: 44px; height: 44px; border-radius: 50%; border: 3px solid #2B2745; cursor: pointer; touch-action: manipulation; }
.cp-swatch-on { box-shadow: 0 0 0 3px #fff, 0 0 0 6px ${colors.blueText}; }
.cp-go { align-self: stretch; margin-top: 6px; font-size: 1.25rem; font-weight: 900; padding: 0.85rem; border-radius: 16px; border: 4px solid #2B2745; background: ${colors.greenButton}; box-shadow: 0 5px 0 #2B2745; color: #fff; cursor: pointer; touch-action: manipulation; }
`;
