import { OrbitSceneEnhanced } from "@/components/orbit/OrbitSceneEnhanced";

type ParamsObj = { id: string };
type Props = { params: ParamsObj | Promise<ParamsObj> };

export default async function MissionViewPage(props: Props) {
  const p = await props.params;
  return <OrbitSceneEnhanced missionId={p.id} />;
}
