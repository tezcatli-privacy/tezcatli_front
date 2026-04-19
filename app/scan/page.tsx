import { ScanWorkbench } from "@/components/scan-workbench";
import { loadAlphaManifest } from "@/lib/alpha-manifest";

export default function ScanPage() {
  const manifest = loadAlphaManifest();

  return (
    <main className="app-page">
      <ScanWorkbench manifest={manifest} />
    </main>
  );
}
