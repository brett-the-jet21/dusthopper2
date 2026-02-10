import OrbitSceneEnhanced from "@/components/orbit/OrbitSceneEnhanced";

type ParamsObj = { id: string };
type Props = { params: ParamsObj | Promise<ParamsObj> };

export default async function MissionViewPage({ params }: Props) {
  const { id } = await params;
  
  return (
    <main className="w-full h-screen">
      <OrbitSceneEnhanced />
    </main>
  );
}
