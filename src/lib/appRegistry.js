// Registry of all apps shown on the portal page.
// To add a new app, copy an entry and fill in the details.
// Replace the finance app URL with the actual Base44 app URL.

export const APPS = [
  {
    id: "bingo",
    name: "Bingo Eletrônico",
    icon: "Grid3x3",
    iconBg: "bg-primary/10 group-hover:bg-primary/20",
    iconColor: "text-primary",
    url: "/app",
  },
  {
    id: "financeiro",
    name: "Controle de Finanças",
    icon: "Wallet",
    iconBg: "bg-emerald-100 group-hover:bg-emerald-200",
    iconColor: "text-emerald-600",
    url: "https://softpremier.com.br/controlefinanceiro",
  },
];