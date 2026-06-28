import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

export function useLicense() {
  const [license, setLicense] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initLicense();
  }, []);

  const initLicense = async () => {
    try {
      // Get IP from public API
      let device_ip = "desconhecido";
      try {
        const res = await fetch("https://api.ipify.org?format=json");
        const data = await res.json();
        device_ip = data.ip;
      } catch (_) {}

      const result = await base44.functions.invoke("notifyLogin", { device_ip });
      setLicense(result.data);
    } catch (e) {
      // Default to free on error
      setLicense({ plan_key: "free", plan_name: "FREE", max_cards: 50 });
    } finally {
      setLoading(false);
    }
  };

  return { license, loading, refetch: initLicense };
}