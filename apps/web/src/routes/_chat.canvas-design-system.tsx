import { createFileRoute } from "@tanstack/react-router";

import { DesignSystemGallery } from "../components/agentCanvas/design-system/DesignSystemGallery";

export const Route = createFileRoute("/_chat/canvas-design-system")({
  component: DesignSystemGallery,
});
