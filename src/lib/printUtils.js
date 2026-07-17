/**
 * Imprime um ou mais elementos da página em folhas separadas,
 * posicionando o conteúdo no topo da página (contornando problemas
 * de position:absolute em print que causam margem superior).
 *
 * @param {string[]} elementIds - IDs dos elementos a imprimir
 * @param {object} options - { padding: "16px" }
 */
export function printElements(elementIds, options = {}) {
  const ids = Array.isArray(elementIds) ? elementIds : [elementIds];
  const padding = options.padding || "16px";

  const root = document.createElement("div");
  root.id = "js-print-root";
  root.style.position = "absolute";
  root.style.left = "0";
  root.style.top = "0";
  root.style.width = "100%";
  root.style.margin = "0";
  root.style.background = "white";

  ids.forEach((id, index) => {
    const el = document.getElementById(id);
    if (!el) return;
    const section = document.createElement("div");
    section.innerHTML = el.innerHTML;
    section.style.padding = padding;
    if (index > 0) section.style.pageBreakBefore = "always";
    root.appendChild(section);
  });

  document.body.style.visibility = "hidden";
  document.body.appendChild(root);

  setTimeout(() => {
    window.print();
    setTimeout(() => {
      document.body.style.visibility = "";
      if (root.parentNode) root.parentNode.removeChild(root);
    }, 200);
  }, 50);
}