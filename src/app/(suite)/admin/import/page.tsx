import { requireUser } from "@/lib/auth";
import { ImportView } from "./ImportView";

export default async function AdminImportPage() {
  await requireUser(["admin"]);
  return <ImportView />;
}
