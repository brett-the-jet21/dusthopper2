import MissionCommandCenter from "@/components/MissionCommandCenter";

export default async function MissionViewPage({ params }: { params: { id: string } }) {
  return <MissionCommandCenter missionId={params.id} />;
}
