import { useEffect } from "react";
import { getPortalUser } from "@/lib/portalSession";

/**
 * Oculta o widget "Edit with Base 44" (injetado pela plataforma)
 * em todas as telas. Só permanece visível para o admin dentro do portal admin.
 */
export default function HideBase44Widget() {
  useEffect(() => {
    const WIDGET_TEXT = "Edit with Base";

    const isSystemAdmin = () => {
      try {
        const portalUser = getPortalUser();
        return !!portalUser?.is_admin;
      } catch (_) {
        return false;
      }
    };

    // Verifica se estamos em uma rota administrativa
    const isAdminRoute = () => {
      return (
        window.location.pathname.includes("portal-admin") ||
        window.location.pathname === "/portal"
      );
    };

    const shouldHide = () => {
      // Oculta em telas públicas sempre; no portal admin só oculta se não for admin
      if (isAdminRoute()) {
        return !isSystemAdmin();
      }
      return true;
    };

    const hideElement = (el) => {
      try {
        if (el && el.style) {
          el.style.setProperty("display", "none", "important");
        }
      } catch (_) {}
    };

    const hideWidget = () => {
      if (!shouldHide()) return;

      // Estratégia 1: Oculta filhos diretos de body/html que NÃO são #root,
      // não são script/style/link, e são position: fixed (típico do widget)
      const candidates = [
        ...Array.from(document.body.children),
        ...Array.from(document.documentElement.children),
      ];

      for (const el of candidates) {
        if (!el || el.id === "root") continue;
        const tag = el.tagName;
        if (["SCRIPT", "STYLE", "LINK", "META", "NOSCRIPT"].includes(tag)) continue;

        // Não esconder modais/popovers do Radix UI (Dialog, DropdownMenu, Select, etc.)
        const role = el.getAttribute("role");
        if (role === "dialog" || role === "presentation" || role === "menu" || role === "listbox" || role === "tooltip" || role === "popover") continue;
        if (el.hasAttribute("data-radix-popper-content-wrapper") || el.hasAttribute("data-radix-portal")) continue;

        let isFixed = false;
        try {
          const style = window.getComputedStyle(el);
          isFixed = style.position === "fixed";
        } catch (_) {}

        // Verifica texto visível (funciona para widgets sem shadow DOM)
        let text = "";
        try {
          text = (el.textContent || "").trim();
          if (el.shadowRoot) {
            text += " " + (el.shadowRoot.textContent || "").trim();
          }
        } catch (_) {}

        const hasWidgetText = text.includes(WIDGET_TEXT);

        // Se é fixed E (tem texto do widget OU é pequeno e está no canto)
        if (isFixed) {
          if (hasWidgetText || text.length < 300) {
            hideElement(el);
            continue;
          }
          // Verifica dimensões/posição típicas do widget (canto inferior direito)
          try {
            const rect = el.getBoundingClientRect();
            if (
              rect.width > 0 &&
              rect.width < 400 &&
              rect.height > 0 &&
              rect.height < 100
            ) {
              hideElement(el);
            }
          } catch (_) {}
        }
      }

      // Estratégia 2: Busca por texto em todos os elementos (incluindo shadow roots abertos)
      const checkAndHide = (root) => {
        if (!root || !root.querySelectorAll) return;
        let elements;
        try {
          elements = root.querySelectorAll("*");
        } catch (_) {
          return;
        }
        for (let i = 0; i < elements.length; i++) {
          const el = elements[i];
          if (el.shadowRoot) {
            checkAndHide(el.shadowRoot);
          }
          try {
            let text = el.textContent || "";
            if (el.shadowRoot) {
              text += " " + (el.shadowRoot.textContent || "");
            }
            if (text.includes(WIDGET_TEXT) && text.trim().length < 500) {
              // Sobe até ancestral fixed
              let target = el;
              for (let depth = 0; depth < 8 && target.parentElement; depth++) {
                try {
                  const style = window.getComputedStyle(target);
                  if (style.position === "fixed" || style.position === "absolute")
                    break;
                } catch (_) {
                  break;
                }
                target = target.parentElement;
              }
              hideElement(target);
              hideElement(el);
            }
          } catch (_) {}
        }
      };

      checkAndHide(document.body);
      checkAndHide(document.documentElement);
    };

    hideWidget();

    const observer = new MutationObserver(hideWidget);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    const interval = setInterval(hideWidget, 800);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, []);

  return null;
}