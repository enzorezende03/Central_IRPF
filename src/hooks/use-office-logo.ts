import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import logo2m from "@/assets/logo-2m.png";

export function useOfficeLogo() {
  const { data: logoUrl } = useQuery({
    queryKey: ["office-logo"],
    queryFn: async () => {
      const { data } = await supabase
        .from("office_settings")
        .select("logo_url")
        .limit(1)
        .maybeSingle();
      return data?.logo_url || null;
    },
    staleTime: 1000 * 60 * 10, // cache 10 min
  });

  return logoUrl || logo2m;
}
