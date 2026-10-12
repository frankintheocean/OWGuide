import raw from "../data/content.json";
import { contentSchema } from "./schema";
export const bundledContent = contentSchema.parse(raw);
