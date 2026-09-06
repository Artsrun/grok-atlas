import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType } from "react";
import { BootScreen } from "@/components/atlas/BootScreen";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [App, setApp] = useState<ComponentType | null>(null);
  useEffect(() => {
    let live = true;
    import("@/components/atlas/AtlasApp").then((m) => {
      if (live) setApp(() => m.AtlasApp);
    });
    return () => {
      live = false;
    };
  }, []);
  if (!App) return <BootScreen label="Loading kernel" />;
  return <App />;
}
