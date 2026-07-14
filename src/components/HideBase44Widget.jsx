import { useEffect } from "react";
import { getPortalUser } from "@/lib/portalSession";

/**
 * Oculta o widget "Edit with Base 44" (injetado pela plataforma)
 * para todos usuários exceto o Administrador do sistema (is_admin: true no portal).
 */
export default function HideBase44Widget() {
  useEffect(() => {
    const WIDGET_TEXT = "Edit with Base";

    const isSystemAdmin = () => {
      const portalUser = getPortalUser();
      return !!portalUser?.is_admin;
    };

    const hideWidget = () => {
      // Não ocultar para o administrador do sistema
      if (isSystemAdmin()) return;

      // O widget é um elemento fixed injetado como filho direto do body
      const bodyChildren = document.body.children;
      for (let i = 0; i < bodyChildren.length; i++) {
        const el = bodyChildren[i];
        if (el.id === "root") continue;
        const text = el.textContent || "";
        if (text.includes(WIDGET_TEXT)) {
          el.style.setProperty("display", "none", "important");
        }
      }
    };

    hideWidget();

    const observer = new MutationObserver(hideWidget);
    observer.observe(document.body, { childList: true, subtree: false });

    // Fallback: o widget pode ser injetado com atraso
    const interval = setInterval(hideWidget, 3000);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, []);

  return null;
}