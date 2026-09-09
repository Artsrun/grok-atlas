import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType } from "react";
import { BootScreen } from "@/components/atlas/BootScreen";
import { warmEarth } from "@/lib/atlas/boot";

export const Route = createFileRoute("/")({ component: Home });

type AtlasModule = { AtlasApp: ComponentType };

let pending: Promise<AtlasModule> | null = null;

/**
 * Kicked when this route module evaluates, not when the component mounts: the
 * atlas chunk is the gate on everything, and waiting for hydration to ask for
 * it costs a round trip on the connection that can least afford one. Textures
 * go out with it so the download overlaps the parse.
 */
const loadAtlas = (): Promise<AtlasModule> => (pending ??= import("@/components/atlas/AtlasApp"));

if (typeof window !== "undefined") {
  loadAtlas();
  warmEarth();
}

function Home() {
  const [App, setApp] = useState<ComponentType | null>(null);
  useEffect(() => {
    let live = true;
    loadAtlas().then((m) => {
      if (live) setApp(() => m.AtlasApp);
    });
    return () => {
      live = false;
    };
  }, []);
  if (!App) return <BootScreen label="Loading kernel" />;
  return <App />;
}
