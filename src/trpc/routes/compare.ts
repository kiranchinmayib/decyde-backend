import * as z from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

interface PriceRecord {
  partner: string;
  sku: string;
  price: number;
}

export const compareRouter = createTRPCRouter({
  compare: publicProcedure
    .input(z.object({
      pincode: z.string().min(6).max(6),
      items: z.array(z.string()).min(1),
    }))
    .mutation(async ({ input }) => {
      console.log('[Compare] Starting comparison for pincode:', input.pincode, 'items:', input.items);

      if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.log('[Compare] Supabase not configured, returning mock data');
        return {
          pincode: input.pincode,
          confidence: 'low' as const,
          cheapest: { partner: 'Zepto', avg_price: 0 },
          fastest: { partner: 'Blinkit', avg_price: 0 },
          best_balance: { partner: 'Instamart', avg_price: 0 },
        };
      }

      try {
        const coverageResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/partner_coverage?pincode=eq.${input.pincode}&active=eq.true&select=partner`,
          {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
            },
          }
        );

        if (!coverageResponse.ok) {
          console.log('[Compare] Coverage fetch failed');
          return {
            pincode: input.pincode,
            results: [],
            message: 'Failed to fetch coverage',
          };
        }

        const coverageData = await coverageResponse.json();
        console.log('[Compare] Coverage data:', coverageData);

        if (!coverageData || coverageData.length === 0) {
          return {
            pincode: input.pincode,
            results: [],
            message: 'No partners available in this area',
          };
        }

        const partners = coverageData.map((c: { partner: string }) => c.partner);
        console.log('[Compare] Available partners:', partners);

        const skuList = input.items.map(s => `"${s}"`).join(',');
        const partnerList = partners.map((p: string) => `"${p}"`).join(',');

        const pricesResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/price_records?partner=in.(${partnerList})&sku=in.(${skuList})&select=*`,
          {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
            },
          }
        );

        let prices: PriceRecord[] = [];
        if (pricesResponse.ok) {
          prices = await pricesResponse.json();
          console.log('[Compare] Price records:', prices);
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

        const confidence = partners.length >= 3 ? 'high' : partners.length === 2 ? 'medium' : 'low';

        return {
          pincode: input.pincode,
          confidence,
          cheapest: ranked[0] || null,
          fastest: ranked[1] || null,
          best_balance: ranked[2] || null,
          all_partners: ranked,
        };
      } catch (error) {
        console.error('[Compare] Error:', error);
        return {
          pincode: input.pincode,
          results: [],
          message: 'Comparison failed',
        };
      }
    }),
});