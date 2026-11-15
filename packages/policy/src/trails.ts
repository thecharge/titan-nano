import { TrailFade } from "@titan/constants";
import { type Trails, TrailsSchema } from "@titan/types";

export function fadeTrails(trails: Trails): Trails {
  const parsed = TrailsSchema.parse(trails);
  return Object.fromEntries(
    Object.entries(parsed).map(([choice, count]) => [choice, count * TrailFade]),
  );
}
