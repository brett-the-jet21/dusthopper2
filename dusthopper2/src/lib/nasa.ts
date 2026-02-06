type LL2Launch = {
  id: string | number;
  name: string;
  status?: { name?: string };
  net?: string;
  window_start?: string;
  window_end?: string;
  launch_service_provider?: { name?: string };
  mission?: { name?: string; description?: string; type?: string };
  vidURLs?: string[];
  webcast_live?: boolean;
  url?: string;
};

export async function fetchNasaMissions() {
  // Launch Library 2: upcoming launches (includes NASA, SpaceX, ESA, etc.)
  // We'll filter to NASA-related on normalize step.
  const url =
    "https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=25&mode=detailed";

  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error("Launch Library 2 fetch failed");

  const json = await res.json();
  return json as { results: LL2Launch[] };
}
