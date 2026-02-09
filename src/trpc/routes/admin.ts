import { createTRPCRouter, publicProcedure } from "../create-context";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const adminRouter = createTRPCRouter({
  overview: publicProcedure.query(async () => {
    console.log('[Admin] Fetching overview data');

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.log('[Admin] Supabase not configured');
      return {
        users: 0,
        requests: 0,
        message: 'Supabase not configured',
      };
    }

    try {
      const usersResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?select=id&limit=1000`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Prefer': 'count=exact',
          },
        }
      );

      const userCount = parseInt(usersResponse.headers.get('content-range')?.split('/')[1] || '0', 10);

      console.log('[Admin] User count:', userCount);

      return {
        users: userCount,
        requests: 0,
        message: 'OK',
      };
    } catch (error) {
      console.error('[Admin] Error:', error);
      return {
        users: 0,
        requests: 0,
        message: 'Error fetching data',
      };
    }
  }),
});