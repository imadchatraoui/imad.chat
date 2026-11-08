import { readFile } from "node:fs/promises";
import path from "node:path";
import Star from "@/components/Star";

export const OG_SIZE = { width: 1200, height: 630 };

export const og = {
  paper: "#fbfaf7",
  ink: "#1c1e2a",
  muted: "#6b6e7c",
  lapis: "#2f4fa3",
};

/** Newsreader, per le anteprime condivise. */
export async function ogFont() {
  const data = await readFile(path.join(process.cwd(), "assets", "fonts", "newsreader.woff"));
  return [{ name: "Newsreader", data, style: "normal" as const, weight: 400 as const }];
}

export function OgStar() {
  return <Star size={48} color={og.lapis} />;
}
