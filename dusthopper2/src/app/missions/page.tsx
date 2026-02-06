import MissionsClient from "@/components/MissionsClient";

export default async function MissionsPage() {
  const res = await fetch("https://dusthopper2.space/api/missions", { cache: "no-store" });
  const initial = await res.json();

  return <MissionsClient initial={initial} />;
}
