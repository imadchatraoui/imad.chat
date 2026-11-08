import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { formatHijri, formatLong, formatShort } from "./dates";

export type Note = {
  slug: string;
  title: string;
  /** "YYYY-MM-DD" */
  date: string;
  tags: string[];
  /** Domanda suggerita in home, se presente nel frontmatter. */
  question?: string;
  excerpt: string;
  body: string;
  dateShort: string;
  dateLong: string;
  dateHijri: string;
};

export type NoteSummary = Omit<Note, "body">;

const CONTENT_DIR = path.join(process.cwd(), "content");
const NOTES_DIR = path.join(CONTENT_DIR, "notes");

let cache: Note[] | null = null;

function toKey(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return "1970-01-01";
}

function excerptOf(markdown: string): string {
  const paragraph =
    markdown
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .find((p) => p && !p.startsWith(">") && !p.startsWith("#") && !p.startsWith("```") && !/^[؀-ۿ]/.test(p)) ?? "";
  const plain = paragraph
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= 160) return plain;
  const cut = plain.slice(0, 157);
  const space = cut.lastIndexOf(" ");
  return `${(space > 100 ? cut.slice(0, space) : cut).replace(/[\s,;:]+$/, "")}…`;
}

export function getNotes(): Note[] {
  if (cache && process.env.NODE_ENV === "production") return cache;
  if (!fs.existsSync(NOTES_DIR)) return [];

  const notes = fs
    .readdirSync(NOTES_DIR)
    .filter((file) => file.endsWith(".md") && !file.startsWith("_"))
    .map((file): Note | null => {
      const raw = fs.readFileSync(path.join(NOTES_DIR, file), "utf8");
      const { data, content } = matter(raw);
      if (data.draft === true) return null;

      const slug = String(data.slug ?? file.replace(/\.md$/, ""))
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const date = toKey(data.date);
      const tags = Array.isArray(data.tags)
        ? data.tags.map(String)
        : typeof data.tags === "string"
          ? data.tags.split(",").map((t) => t.trim()).filter(Boolean)
          : [];

      return {
        slug,
        title: String(data.title ?? slug),
        date,
        tags,
        question: data.question ? String(data.question) : undefined,
        excerpt: excerptOf(content),
        body: content.trim(),
        dateShort: formatShort(date),
        dateLong: formatLong(date),
        dateHijri: formatHijri(date),
      };
    })
    .filter((n): n is Note => n !== null)
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));

  cache = notes;
  return notes;
}

export function getNote(slug: string): Note | undefined {
  return getNotes().find((n) => n.slug === slug);
}

export function summaries(notes: Note[]): NoteSummary[] {
  return notes.map(({ body: _body, ...rest }) => rest);
}

/** Il testo di content/me.md, senza i commenti HTML. */
export function getMe(): string {
  const file = path.join(CONTENT_DIR, "me.md");
  if (!fs.existsSync(file)) return "";
  return fs
    .readFileSync(file, "utf8")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
}
