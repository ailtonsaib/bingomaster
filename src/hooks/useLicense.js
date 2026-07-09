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
      // Check if user is admin — admins always get mega plan
      const user = await base44.auth.me();
      if (user?.role === "admin") {
        setLicense({ plan_key: "mega", plan_name: "MEGA", max_cards: 50000, app_generator: true, app_seller: true, app_buyer: true, app_telao: true, app_rifa: true, is_admin: true });
        setLoading(false);
        return;
      }

      // Get IP from public API
      let device_ip = "desconhecido";
      try {
        const res = await fetch("https://api.ipify.org?format=json");
        const data = await res.json();
        device_ip = data.ip;
      } catch (_) {}

      const result = await base44.functions.invoke("notifyLogin", { device_ip });
      setLicense(result.data);

      // Send WhatsApp notification on first access
      if (result.data?.is_new) {
        try {
          await base44.functions.invoke("sendWhatsAppMessage", {
            message: `🆕 *Novo usuário cadastrado*\n\nNome: ${user?.full_name || "Não informado"}\nE-mail: ${user?.email || "—"}\nIP: ${device_ip}\n\nPlano inicial: FREE (50 cartelas)`
          });
        } catch (_) {}
      }
    } catch (e) {
      // Default to free on error
      setLicense({ plan_key: "free", plan_name: "FREE", max_cards: 50 });
    } finally {
      setLoading(false);
    }
  };

  return { license, loading, refetch: initLicense };
}