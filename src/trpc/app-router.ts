import { createTRPCRouter } from "./create-context";
import { coverageRouter } from "./routes/coverage";
import { compareRouter } from "./routes/compare";
import { adminRouter } from "./routes/admin";

export const appRouter = createTRPCRouter({
  coverage: coverageRouter,
  compare: compareRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;