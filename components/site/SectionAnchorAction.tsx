"use client";

// Il pulsante che compie, sull'astrolabio, il gesto legato a una sezione: «Mostra la piastra di Al-Quds»,
// «Indica la qibla»… Prende il comando dal ShellActionsProvider; senza, non compare.

import { anchorActionLabel, parseAnchor } from "./anchors";
import { IconFlip, IconQibla, IconTariq, StarMark } from "./icons";
import { useShellActions } from "./ShellContext";
import t from "./tokens.module.css";
import p from "./Panels.module.css";

export default function SectionAnchorAction({ anchor }: { anchor: string | null | undefined }) {
  const { onAnchor, cityName } = useShellActions();
  const parsed = parseAnchor(anchor);
  const label = anchorActionLabel(parsed, cityName);
  if (!parsed || !label || !onAnchor) return null;
  const icon =
    parsed.kind === "qibla" ? (
      <IconQibla size={20} />
    ) : parsed.kind === "tariq" ? (
      <IconTariq size={20} />
    ) : parsed.kind === "retro" ? (
      <IconFlip size={20} />
    ) : (
      <StarMark size={17} />
    );
  return (
    <button type="button" className={`${t.button} ${p.action}`} onClick={() => onAnchor(parsed)}>
      {icon}
      <span>{label}</span>
    </button>
  );
}
