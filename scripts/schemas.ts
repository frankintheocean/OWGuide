import { z } from "zod";
import { writeFileSync } from "node:fs";
import { contentSchema, userSchema } from "../src/domain/schema";
for (const [name, schema] of [
  ["content", contentSchema],
  ["user", userSchema],
] as const)
  writeFileSync(
    `content/${name}.schema.json`,
    JSON.stringify(z.toJSONSchema(schema), null, 2) + "\n",
  );
