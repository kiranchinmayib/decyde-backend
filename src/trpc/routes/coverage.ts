import * as z from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

interface PartnerCoverageRow {
  partner: string;
  active: boolean;
  district: string;
  statename: string;
}

export const coverageRouter = createTRPCRouter({
  getByPincode: publicProcedure
    .input(z.object({ pincode: z.string().min(6).max(6) }))
    .query(async ({ input }) => {
      console.log('[Coverage] Fetching coverage for pincode:', input.pincode);

      if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.log('[Coverage] Supabase not configured, returning all partners');
        return {
          pincode: input.pincode,
          city: 'Unknown',
          state: 'Unknown',
          partners: ['Zepto', 'Blinkit', 'Instamart', 'BigBasket', 'DMart'],
        };
      }

      try {
        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/rpc/get_partner_coverage`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
            },
            body: JSON.stringify({ p_pincode: input.pincode }),
          }
        );

        if (!response.ok) {
          console.log('[Coverage] RPC failed, trying direct query');
          
          const directResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/partner_coverage?pincode=eq.${input.pincode}&active=eq.true&select=partner,active,pincodes(district,statename)`,
            {
              headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
              },
            }
          );

          if (!directResponse.ok) {
            console.log('[Coverage] Direct query also failed');
            return {
              pincode: input.pincode,
              city: 'Unknown',
              state: 'Unknown',
              partners: ['Zepto', 'Blinkit', 'Instamart', 'BigBasket', 'DMart'],
            };
          }

          const directData = await directResponse.json();
          console.log('[Coverage] Direct query result:', directData);

          if (!directData || directData.length === 0) {
            return {
              pincode: input.pincode,
              city: 'Unknown',
              state: 'Unknown',
              partners: [],
            };
          }

          const partners = directData
            .filter((row: { active: boolean }) => row.active)
            .map((row: { partner: string }) => row.partner);
          
          const firstRow = directData[0];
          const pincodeInfo = firstRow.pincodes || {};

          return {
            pincode: input.pincode,
            city: pincodeInfo.district || 'Unknown',
            state: pincodeInfo.statename || 'Unknown',
            partners,
          };
        }

        const data: PartnerCoverageRow[] = await response.json();
        console.log('[Coverage] RPC result:', data);

        if (!data || data.length === 0) {
          return {
            pincode: input.pincode,
            city: 'Unknown',
            state: 'Unknown',
            partners: [],
          };
        }

        const partners = data
          .filter((row) => row.active)
          .map((row) => row.partner);

        return {
          pincode: input.pincode,
          city: data[0]?.district || 'Unknown',
          state: data[0]?.statename || 'Unknown',
          partners,
        };
      } catch (error) {
        console.error('[Coverage] Error fetching coverage:', error);
        return {
          pincode: input.pincode,
          city: 'Unknown',
          state: 'Unknown',
          partners: ['Zepto', 'Blinkit', 'Instamart', 'BigBasket', 'DMart'],
        };
      }
    }),
});