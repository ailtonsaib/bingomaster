import { useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";

/**
 * Oculta o widget "Edit with Base 44" (injetado pela plataforma)
 * para usuários que não são administradores do sistema.
 */
export default function HideBase44Widget() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (isAdmin) return;

    const WIDGET_TEXT = "Edit with Base";

    const hideWidget = () => {
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
  }, [isAdmin]);

  return null;
}