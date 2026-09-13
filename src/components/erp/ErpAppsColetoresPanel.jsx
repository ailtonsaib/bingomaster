import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Smartphone, ShoppingCart, Factory, Truck, Download, Trash2, Loader2, CheckCircle2, X, MonitorSmartphone } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { fmtDate } from "@/lib/erpUtils";

// Aplicativos para coletores de dados / aparelhos externos — o gestor
// controla a instalação de cada app pelo Módulo Gerencial
export const COLLECTOR_APPS = [
  {
    id: "vendedor", name: "App do Vendedor", icon: Smartphone,
    module: "Comercial → App do Vendedor",
    desc: "Pedido de venda no celular do vendedor: consulta de preços, pedidos com desconto para aprovação, roteirização e acompanhamento de visitas.",
  },
  {
    id: "compras", name: "App de Compras (Bipagem)", icon: ShoppingCart,
    module: "WMS → Recebimento NF / Etiquetas",
    desc: "Bipagem das etiquetas de compra no recebimento de mercadoria: lote, validade e endereçamento WMS na entrada dos produtos.",
  },
  {
    id: "producao", name: "App de Produção (Bipagem)", icon: Factory,
    module: "WMS → Bipagem Produção",
    desc: "Bipagem das etiquetas de produção no chão de fábrica: entrada do produto acabado no estoque com lote e validade.",
  },
  {
    id: "logistica", name: "App de Logística", icon: Truck,
    module: "Em desenvolvimento",
    desc: "Bipagem de montagem de carga, conferência e entrega — aplicativo a ser desenvolvido posteriormente.",
    available: false,
  },
];

export default function ErpAppsColetoresPanel({ user }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      setRecords(await base44.entities.ErpCollectorApp.filter({ user_email: user.email }, "-updated_date", 100));
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const recByApp = (id) => records.find(r => r.app_id === id && r.installed);

  const uninstall = async (rec) => {
    if (!confirm(`Desinstalar "${rec.app_name}" do coletor "${rec.device_name || "—"}"? O aplicativo deixará de figurar como instalado.`)) return;
    await base44.entities.ErpCollectorApp.update(rec.id, { installed: false });
    load();
  };

  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-base flex items-center gap-2"><MonitorSmartphone className="w-5 h-5 text-purple-600" /> Aplicativos para Coletores de Dados</h2>
      <p className="text-xs text-gray-500 -mt-1">Instalação dos aplicativos bipáveis nos aparelhos externos (coletores de dados, celulares e tablets) — controle do gestor do sistema.</p>

      {loading ? (
        <div className="p-6 text-center text-gray-400 flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {COLLECTOR_APPS.map(app => {
            const Icon = app.icon;
            const rec = recByApp(app.id);
            return (
              <div key={app.id} className="bg-white rounded-xl border p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center"><Icon className="w-5 h-5" /></div>
                    <div>
                      <p className="font-medium text-sm">{app.name}</p>
                      <p className="text-xs text-gray-500">{app.module}</p>
                    </div>
                  </div>
                  {rec ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Instalado</span>
                  ) : app.available === false ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Em desenvolvimento</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Disponível</span>
                  )}
                </div>
                <p className="text-xs text-gray-600">{app.desc}</p>
                {rec && (
                  <p className="text-[11px] text-gray-400">Coletor: {rec.device_name || "—"} — instalado em {fmtDate(rec.install_date)}</p>
                )}
                <div className="flex gap-2 justify-end mt-auto">
                  {app.available === false ? (
                    <Button size="sm" variant="outline" disabled>Instalar</Button>
                  ) : rec ? (
                    <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50 gap-1.5" onClick={() => uninstall(rec)}><Trash2 className="w-4 h-4" /> Desinstalar</Button>
                  ) : (
                    <Button size="sm" className="gap-1.5 bg-purple-600 hover:bg-purple-700" onClick={() => setInstalling(app)}><Download className="w-4 h-4" /> Instalar</Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {installing && <ErpInstallModal user={user} app={installing} onClose={() => setInstalling(null)} onSaved={() => { setInstalling(null); load(); }} />}
    </div>
  );
}

// Modal de instalação: QR code do endereço de acesso + passo a passo no coletor
function ErpInstallModal({ user, app, onClose, onSaved }) {
  const [device, setDevice] = useState("");
  const [saving, setSaving] = useState(false);
  const appUrl = `${window.location.origin}/erp-painel`;

  const confirm = async () => {
    setSaving(true);
    try {
      const existing = (await base44.entities.ErpCollectorApp.filter({ user_email: user.email, app_id: app.id }, "-updated_date", 10))[0];
      const payload = { user_email: user.email, app_id: app.id, app_name: app.name, installed: true, install_date: new Date().toISOString(), device_name: device, notes: app.module };
      if (existing?.id) await base44.entities.ErpCollectorApp.update(existing.id, payload);
      else await base44.entities.ErpCollectorApp.create(payload);
      onSaved();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="font-bold">Instalar {app.name}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-500"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <div className="flex gap-4 items-start">
            <div className="border rounded-lg p-2 shrink-0"><QRCodeCanvas value={appUrl} size={120} /></div>
            <ol className="list-decimal pl-4 space-y-1.5 text-xs text-gray-600">
              <li>No coletor de dados (ou celular/tablet do operador), abra o navegador e acesse o endereço ao lado — ou escaneie o QR code: <b className="text-purple-700 break-all">{appUrl}</b></li>
              <li>Faça login com o usuário do ERP (e-mail e senha com permissão de acesso ao sistema).</li>
              <li>Abra o módulo <b>{app.module}</b>.</li>
              <li>Instale como aplicativo: menu do navegador → <b>Adicionar à tela inicial</b> — o ícone fica no aparelho como um app comum.</li>
              <li>O leitor de código de barras/QR do coletor bipa direto no campo de bipagem do módulo.</li>
            </ol>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Coletor / Aparelho instalado *</label>
            <input value={device} onChange={e => setDevice(e.target.value)} placeholder="ex: Zebra MC3300, tablet do galpão, Moto G84..."
              className="w-full h-9 rounded-md border border-input px-3 text-sm mt-1" />
          </div>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" disabled={saving || !device.trim()} onClick={confirm} className="bg-purple-600 hover:bg-purple-700">{saving ? "Registrando..." : "Confirmar Instalação"}</Button>
        </div>
      </div>
    </div>
  );
}