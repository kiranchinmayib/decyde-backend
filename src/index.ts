import { Hono } from "hono";
import { cors } from "hono/cors";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const app = new Hono();

app.use("*", cors());

app.use(
  "/trpc/*",
  trpcServer({
    endpoint: "/trpc",
    router: appRouter,
    createContext,
  }),
);

app.get("/", (c) => {
  return c.json({ status: "ok", message: "Decyde API is running", version: "2.1.0", timestamp: new Date().toISOString() });
});

app.get("/health", (c) => {
  return c.json({ ok: true, timestamp: new Date().toISOString() });
});

app.get("/coverage", async (c) => {
  const pincode = c.req.query("pincode");

  if (!pincode) {
    return c.json({ error: "pincode required" }, 400);
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return c.json({
      pincode,
      city: "Unknown",
      state: "Unknown",
      partners: ["Zepto", "Blinkit", "Instamart", "BigBasket", "DMart"],
    });
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/partner_coverage?pincode=eq.${pincode}&active=eq.true&select=partner,active,pincodes(district,statename)`,
      {
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (!response.ok) {
      return c.json({ pincode, city: "Unknown", state: "Unknown", partners: [] });
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      return c.json({ pincode, city: "Unknown", state: "Unknown", partners: [] });
    }

    const partners = data
      .filter((row: { active: boolean }) => row.active)
      .map((row: { partner: string }) => row.partner);
    const firstRow = data[0];
    const pincodeInfo = firstRow.pincodes || {};

    return c.json({
      pincode,
      city: pincodeInfo.district || "Unknown",
      state: pincodeInfo.statename || "Unknown",
      partners,
    });
  } catch (err) {
    console.error("[Coverage REST] Error:", err);
    return c.json({ error: "Server error" }, 500);
  }
});

app.post("/compare", async (c) => {
  const body = await c.req.json();
  const { items, pincode, user_id } = body;

  if (!items || !items.length || !pincode) {
    return c.json({ error: "items + pincode required" }, 400);
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return c.json({
      pincode,
      confidence: "low",
      cheapest: { partner: "Zepto", avg_price: 0 },
      fastest: { partner: "Blinkit", avg_price: 0 },
      best_balance: { partner: "Instamart", avg_price: 0 },
    });
  }

  try {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/search_logs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({ user_id: user_id || null, pincode, items }),
      });
    } catch (logErr) {
      console.error("[Compare] Failed to log search:", logErr);
    }

    const coverageRes = await fetch(
      `${SUPABASE_URL}/rest/v1/partner_coverage?pincode=eq.${pincode}&active=eq.true&select=partner`,
      {
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (!coverageRes.ok) {
      return c.json({ pincode, results: [], message: "Failed to fetch coverage" });
    }

    const coverage = await coverageRes.json();

    if (!coverage || coverage.length === 0) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/coverage_gaps`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`,
            "Prefer": "return=minimal",
          },
          body: JSON.stringify({ pincode, requested_partner: null }),
        });
      } catch (_gapErr) {
        // silent
      }
      return c.json({ pincode, results: [], message: "No partners available" });
    }

    const partners = coverage.map((cov: { partner: string }) => cov.partner);
    const skuList = items.map((s: string) => `"${s}"`).join(",");
    const partnerList = partners.map((p: string) => `"${p}"`).join(",");

    const pricesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/price_records?partner=in.(${partnerList})&sku=in.(${skuList})&select=*`,
      {
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    let prices: { partner: string; sku: string; price: number }[] = [];
    if (pricesRes.ok) {
      prices = await pricesRes.json();
    }

    const scores: Record<string, { total: number; count: number }> = {};
    partners.forEach((p: string) => {
      scores[p] = { total: 0, count: 0 };
    });

    prices.forEach((row) => {
      if (scores[row.partner]) {
        scores[row.partner].total += row.price;
        scores[row.partner].count += 1;
      }
    });

    const ranked = partners.map((p: string) => {
      const avg = scores[p].count === 0 ? 99999 : scores[p].total / scores[p].count;
      return { partner: p, avg_price: avg };
    });

    ranked.sort((a: { avg_price: number }, b: { avg_price: number }) => a.avg_price - b.avg_price);

    const confidence = partners.length >= 3 ? "high" : partners.length === 2 ? "medium" : "low";

    return c.json({
      pincode,
      confidence,
      cheapest: ranked[0] || null,
      fastest: ranked[1] || null,
      best_balance: ranked[2] || null,
      all_partners: ranked,
    });
  } catch (err) {
    console.error("[Compare REST] Error:", err);
    return c.json({ error: "Compare failed" }, 500);
  }
});

app.post("/redirect", async (c) => {
  const body = await c.req.json();
  const { user_id, partner, pincode } = body;

  if (!partner || !pincode) {
    return c.json({ error: "partner + pincode required" }, 400);
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return c.json({ success: true });
  }

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/redirect_logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({ user_id: user_id || null, partner, pincode }),
    });
    return c.json({ success: true });
  } catch (err) {
    console.error("[Redirect] Failed:", err);
    return c.json({ error: "Redirect log failed" }, 500);
  }
});

app.get("/admin/overview", async (c) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "No token provided" }, 401);
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return c.json({ error: "Database not configured" }, 500);
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${token}`,
      },
    });

    if (!userRes.ok) {
      return c.json({ error: "Invalid or expired token" }, 401);
    }

    const user = await userRes.json();
    if (!user || !user.id) {
      return c.json({ error: "Invalid user" }, 401);
    }

    const adminRes = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_users?user_id=eq.${user.id}&select=user_id`,
      {
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (!adminRes.ok) {
      return c.json({ error: "Not authorized" }, 403);
    }

    const adminData = await adminRes.json();
    if (!adminData || adminData.length === 0) {
      return c.json({ error: "Not authorized - admin access required" }, 403);
    }

    const topPincodesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/search_logs?select=pincode&order=created_at.desc&limit=500`,
      {
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    const searchLogs = topPincodesRes.ok ? await topPincodesRes.json() : [];

    const pincodeCounts: Record<string, number> = {};
    searchLogs.forEach((log: { pincode: string }) => {
      pincodeCounts[log.pincode] = (pincodeCounts[log.pincode] || 0) + 1;
    });
    const topPincodes = Object.entries(pincodeCounts)
      .map(([pincode, searches]) => ({ pincode, searches }))
      .sort((a, b) => b.searches - a.searches)
      .slice(0, 10);

    const redirectsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/redirect_logs?select=partner&order=created_at.desc&limit=500`,
      {
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    const redirectLogs = redirectsRes.ok ? await redirectsRes.json() : [];

    const partnerCounts: Record<string, number> = {};
    redirectLogs.forEach((log: { partner: string }) => {
      partnerCounts[log.partner] = (partnerCounts[log.partner] || 0) + 1;
    });
    const partnerPerformance = Object.entries(partnerCounts)
      .map(([partner, redirects]) => ({ partner, redirects }))
      .sort((a, b) => b.redirects - a.redirects);

    const gapsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/coverage_gaps?select=pincode,created_at&order=created_at.desc&limit=50`,
      {
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    const coverageGaps = gapsRes.ok ? await gapsRes.json() : [];

    return c.json({
      topPincodes,
      partnerPerformance,
      coverageGaps,
      totalSearches: searchLogs.length,
      totalRedirects: redirectLogs.length,
    });
  } catch (err) {
    console.error("[Admin Overview] Error:", err);
    return c.json({ error: "Failed to fetch admin data" }, 500);
  }
});

export default app;
