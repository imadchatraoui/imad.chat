import Chat from "@/components/Chat";
import { formatHijri, formatLong, greetingFor, todayKey } from "@/lib/dates";
import { getNotes, summaries } from "@/lib/notes";

// La home sa che giorno è: la rigeneriamo ogni minuto.
export const revalidate = 60;

export default function Home() {
  const today = todayKey();
  const notes = summaries(getNotes());

  return (
    <Chat
      notes={notes}
      greeting={greetingFor(today)}
      dateLines={[formatLong(today, { weekday: true }), formatHijri(today)]}
    />
  );
}
