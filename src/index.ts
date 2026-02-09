import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";

const app = new Hono();

app.use("*", cors());

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

/* Root */
app.get("/", (c) => {
  return c.json({
    status: "ok",
    message: "Decyde API running"
  });
});

/* Health */
app.get("/health", (c) => {
  return c.json({ ok: true });
});

/* Coverage */
app.get("/coverage", async (c) => {
  const pincode = c.req.query("pincode");

  if (!pincode) {
    return c.json({ error: "pincode required" }, 400);
  }

  return c.json({
    pincode,
    city: "Bangalore",
    state: "Karnataka",
    partners: ["Zepto", "Blinkit", "Instamart"],
  });
});


/* Compare */
app.post("/compare", async (c) => {
  const body = await c.req.json();

  const { items, pincode } = body;

  if (!items || !pincode) {
    return c.json({ error: "items + pincode required" }, 400);
  }

  return c.json({
    confidence: "low",
    cheapest: "Zepto",
    fastest: "Blinkit",
    best: "Instamart"
  });
});

/* START SERVER */
const port = Number(process.env.PORT || 3000);

console.log("Starting Decyde server on port", port);

serve({
  fetch: app.fetch,
  port
});
