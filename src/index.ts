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

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return c.json({
      partners: ["Zepto", "Blinkit", "Instamart"]
    });
  }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/partner_coverage?pincode=eq.${pincode}&active=eq.true`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    }
  );

  const data = await res.json();

  return c.json({ data });
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
  cheapest: {
    app: "Zepto",
    estimate: "₹240",
    explanation: "Based on recent price trends"
  },
  fastest: {
    app: "Blinkit",
    estimate: "15 mins",
    explanation: "Closest delivery partner available"
  },
  best_balance: {
    app: "Instamart",
    estimate: "₹255 • 20 mins",
    explanation: "Balanced price and delivery time"
  }
});

/* START SERVER */
const port = Number(process.env.PORT || 3000);

console.log("Starting Decyde server on port", port);

serve({
  fetch: app.fetch,
  port
});
