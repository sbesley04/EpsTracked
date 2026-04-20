import { getAllEntities } from "@/lib/data";
import EntitiesList from "@/components/EntitiesList";

export default function EntitiesPage() {
  const entities = getAllEntities();

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "#e4e4ef" }}>
          Entities
        </h1>
        <p className="text-sm mt-1" style={{ color: "#8888a0" }}>
          {entities.length} unique actors and recipients extracted from the document corpus
        </p>
      </div>
      <EntitiesList entities={entities} />
    </div>
  );
}
