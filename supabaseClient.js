import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://zzhwzeartfukqlytbmqq.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6aHd6ZWFydGZ1a3FseXRibXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1ODgzNjIsImV4cCI6MjA3MzE2NDM2Mn0.vbnnK1uDi4qU81z6umtE25hhuCUEVD1q4kMBOvIEyH4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: AsyncStorage, // <- required for React Native
  },
});