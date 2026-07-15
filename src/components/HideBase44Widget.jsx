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

      // Busca em todos os elementos do body (diretos e aninhados)
      const allElements = document.body.querySelectorAll("*");
      for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i];
        const text = el.textContent || "";
        if (text.includes(WIDGET_TEXT) && text.length < 200) {
          // Sobe até o ancestral fixo/absolute para ocultar o container inteiro
          let target = el;
          for (let depth = 0; depth < 5 && target.parentElement; depth++) {
            const style = window.getComputedStyle(target);
            if (style.position === "fixed" || style.position === "absolute") break;
            target = target.parentElement;
          }
          target.style.setProperty("display", "none", "important");
        }
      }
    };

    hideWidget();

    const observer = new MutationObserver(hideWidget);
    observer.observe(document.body, { childList: true, subtree: true });

    // Fallback: o widget pode ser injetado com atraso
    const interval = setInterval(hideWidget, 1500);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, []);

  return null;
}