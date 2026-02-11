import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ReservationSetting {
  role: string;
  max_active: number | null;
  max_hours_per_day: number | null;
  allowed_courts: number[] | null;
  can_create: boolean;
}

export const useReservationSettings = () => {
  const [settings, setSettings] = useState<ReservationSetting[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from("reservation_settings")
      .select("*");

    if (!error && data) {
      setSettings(data as unknown as ReservationSetting[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const getSettingForRole = (role: string): ReservationSetting | undefined => {
    return settings.find((s) => s.role === role);
  };

  return { settings, loading, fetchSettings, getSettingForRole };
};
