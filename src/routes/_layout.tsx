import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import Header from "@/client/Header";

export const Route = createFileRoute("/_layout")({
  beforeLoad: () => {
    const isInitialized = localStorage.getItem('gtfs_data_initialized') === 'true';
    if (!isInitialized) {
      throw redirect({ to: "/" });
    }
  },
  component: LayoutComponent,
});

function LayoutComponent() {
  return (
    <>
      <Header />
      <Outlet />
    </>
  );
}
