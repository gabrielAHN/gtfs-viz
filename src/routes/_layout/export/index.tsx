import { createFileRoute, redirect } from "@tanstack/react-router";
import Export from "@/client/Export";

export const Route = createFileRoute("/_layout/export/")({
  component: ExportPage,
  beforeLoad: () => {
    
    const initialized = localStorage.getItem('gtfs_data_initialized') === 'true';

    if (!initialized) {
      throw redirect({ to: "/" });
    }
  },
});

function ExportPage() {
  return (
    <div className="p-4">
      <Export />
    </div>
  );
}
