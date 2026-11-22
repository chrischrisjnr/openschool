import "server-only";
import { getAudienceOptions } from "@/lib/audience";
import type { AudienceType } from "@/db/schema";

/**
 * Builds a fast audience → label function for a school, so lists don't run
 * a query per row. "Whole school", "Year 3", "Class 6A", "Banksia house".
 */
export function audienceLabeler(schoolId: string, state = "VIC") {
  const options = getAudienceOptions(schoolId, state);
  const map = new Map(options.map((o) => [o.value, o.label]));
  map.set("school", "Whole school");
  return (type: AudienceType, id: string | null) => map.get(id ? `${type}:${id}` : type) ?? "Whole school";
}
