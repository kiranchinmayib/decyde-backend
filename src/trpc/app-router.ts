import { createTRPCRouter } from "./create-context.js";
import { createContext } from "./create-context.js";
import { coverageRouter } from "./routes/coverage.js";
import { compareRouter } from "./routes/compare.js";
import { adminRouter } from "./routes/admin.js";

export const appRouter = createTRPCRouter({
  coverage: coverageRouter,
  compare: compareRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;