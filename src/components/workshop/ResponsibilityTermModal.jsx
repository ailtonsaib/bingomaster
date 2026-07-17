import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { X, FileText, Camera, Printer, Upload } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function ResponsibilityTermModal({ order, userEmail, onClose }) {
  const { toast } = useToast();
  const [declinedProblem, setDeclinedProblem] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [signedPhoto, setSignedPhoto] = useState(null);
  const [signedPhotoUrl, setSignedPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState(null);
  const [saved, setSaved] = useState(false);

  const today = new Date().toLocaleDateString("pt-BR");

  useEffect(() => {
    const loadExisting = async () => {
      if (!order.id) return;
      try {
        const list = await base44.entities.DiagnosticMaintenanceHistory.filter({
          user_email: userEmail,
          service_order_id: order.id,
          type: "termo_responsabilidade",
        });
        if (list.length > 0) {
          const existing = list[0];
          setExistingId(existing.id);
          setDeclinedProblem(existing.declined_problem || "");
          setRecommendation(existing.declined_recommendation || "");
          setSignedPhotoUrl(existing.signed_document_url || "");
          setSignedPhoto(existing.signed_document_url || null);
          setSaved(true);
        }
      } catch {
        // ignore
      }
    };
    loadExisting();
  }, [order.id]);

  const handlePrintOS = () => {
    window.print();
  };

  const handlePrintTerm = () => {
    document.body.classList.add("printing-term");
    window.print();
    setTimeout(() => document.body.classList.remove("printing-term"), 500);
  };

  const handlePrintBoth = () => {
    document.body.classList.add("printing-both");
    window.print();
    setTimeout(() => document.body.classList.remove("printing-both"), 500);
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setSignedPhotoUrl(file_url);
      setSignedPhoto(file_url);
      toast({ title: "Foto anexada", description: "Documento assinado carregado." });
    } catch {
      toast({ title: "Erro", description: "Falha ao enviar foto.", variant: "destructive" });
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!declinedProblem.trim()) {
      toast({ title: "Atenção", description: "Descreva o problema recusado.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const data = {
        user_email: userEmail,
        vehicle_id: order.vehicle_id || "",
        client_cpf_cnpj: order.client_cpf_cnpj || "",
        client_name: order.client_name || "",
        plate: order.vehicle_plate || "",
        brand: order.vehicle_brand || "",
        model: order.vehicle_model || "",
        year: order.vehicle_year || "",
        type: "termo_responsabilidade",
        description: `Termo de Responsabilidade — OS ${order.order_number}`,
        declined_problem: declinedProblem,
        declined_recommendation: recommendation,
        signed_document_url: signedPhotoUrl || "",
        date: new Date().toISOString(),
        term_date: new Date().toISOString(),
        mileage: order.vehicle_mileage || 0,
        mechanic_name: order.mechanic_name || "",
        service_order_id: order.id || "",
        order_number: order.order_number || "",
        cost: 0,
      };
      if (existingId) {
        await base44.entities.DiagnosticMaintenanceHistory.update(existingId, data);
        toast({ title: "Termo atualizado", description: "Documento atualizado com sucesso." });
      } else {
        const created = await base44.entities.DiagnosticMaintenanceHistory.create(data);
        setExistingId(created.id);
        toast({ title: "Termo salvo", description: "Documento vinculado ao histórico do veículo." });
      }
      setSaved(true);
    } catch {
      toast({ title: "Erro", description: "Não foi possível salvar o termo.", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10 no-print">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-gray-800">Termo de Responsabilidade</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Print area */}
        <div id="print-term-area" className="p-6 space-y-4">
          {/* Header do termo */}
          <div className="text-center border-b pb-4">
            <h2 className="text-lg font-bold uppercase">Termo de Responsabilidade do Cliente</h2>
            <p className="text-xs text-gray-500 mt-1">Recusa de reparo / serviço recomendado</p>
          </div>

          {/* Dados da OS */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-400">Ordem de Serviço</p>
              <p className="font-semibold">{order.order_number}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Data</p>
              <p className="font-semibold">{today}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Cliente</p>
              <p className="font-semibold">{order.client_name}</p>
              {order.client_cpf_cnpj && <p className="text-xs text-gray-500">{order.client_cpf_cnpj}</p>}
            </div>
            <div>
              <p className="text-xs text-gray-400">Veículo</p>
              <p className="font-semibold">{order.vehicle_brand} {order.vehicle_model}</p>
              {order.vehicle_plate && <p className="text-xs text-gray-500">Placa: {order.vehicle_plate}</p>}
            </div>
            <div>
              <p className="text-xs text-gray-400">Mecânico Responsável</p>
              <p className="font-semibold">{order.mechanic_name || "—"}</p>
            </div>
            {order.vehicle_mileage > 0 && (
              <div>
                <p className="text-xs text-gray-400">KM atual</p>
                <p className="font-semibold">{Number(order.vehicle_mileage).toLocaleString("pt-BR")} km</p>
              </div>
            )}
          </div>

          {/* Descrição do problema recusado */}
          <div>
            <label className="text-xs font-semibold text-gray-400 mb-1 block">
              DESCRIÇÃO DO PROBLEMA IDENTIFICADO (NÃO EXECUTADO)
            </label>
            <Textarea
              value={declinedProblem}
              onChange={(e) => setDeclinedProblem(e.target.value)}
              placeholder="Descreva o problema/defeito detectado, peças ou serviços recomendados que o cliente optou por não realizar..."
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Recomendação técnica */}
          <div>
            <label className="text-xs font-semibold text-gray-400 mb-1 block">
              RECOMENDAÇÃO TÉCNICA E POSSÍVEIS CONSEQUÊNCIAS
            </label>
            <Textarea
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              placeholder="Descreva os riscos de continuar usando o veículo sem o reparo e quando retornar para revisão..."
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Declaração */}
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed">
            Declaro, por meio deste termo, que fui informado(a) pelo mecânico sobre o problema descrito
            acima e das recomendações técnicas apresentadas. Atesto estar ciente dos riscos e possíveis
            consequências de não realizar o reparo no momento, isentando a oficina e o mecânico
            responsável de quaisquer responsabilidades futuras relacionadas a este problema.
          </div>

          {/* Assinaturas */}
          <div className="grid grid-cols-2 gap-8 pt-8">
            <div className="text-center">
              <div className="border-t border-gray-400 pt-1">
                <p className="text-xs text-gray-500">{order.client_name}</p>
                <p className="text-[10px] text-gray-400">Assinatura do Cliente</p>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-gray-400 pt-1">
                <p className="text-xs text-gray-500">{order.mechanic_name || "Mecânico Responsável"}</p>
                <p className="text-[10px] text-gray-400">Assinatura do Mecânico</p>
              </div>
            </div>
          </div>

          {/* Foto do documento assinado */}
          <div className="border-t pt-4 no-print">
            <label className="text-xs font-semibold text-gray-400 mb-2 block">
              FOTO DO DOCUMENTO ASSINADO (OPCIONAL)
            </label>
            <div className="flex items-center gap-3">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm text-gray-600">
                  {uploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      {signedPhoto ? "Trocar foto" : "Tirar foto / Anexar"}
                    </>
                  )}
                </div>
              </label>
              {signedPhoto && (
                <div className="relative">
                  <img src={signedPhoto} alt="Documento assinado" className="w-20 h-20 object-cover rounded-lg border" />
                  <button
                    onClick={() => { setSignedPhoto(null); setSignedPhotoUrl(""); }}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
            {signedPhoto && (
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                <Upload className="w-3 h-3" /> Foto anexada ao histórico
              </p>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50 no-print sticky bottom-0 z-10">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 hidden sm:block">Imprimir:</span>
            <Button variant="outline" size="sm" onClick={handlePrintOS} className="gap-1">
              <Printer className="w-3.5 h-3.5" /> Só OS
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrintTerm} className="gap-1 border-amber-200 text-amber-600 hover:bg-amber-50">
              <FileText className="w-3.5 h-3.5" /> Só Termo
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrintBoth} className="gap-1">
              <Printer className="w-3.5 h-3.5" /> OS + Termo
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !declinedProblem.trim()}
              className="gap-1 text-white"
              style={{ backgroundColor: "#2563EB" }}
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Salvando...
                </>
              ) : saved ? (
                <>
                  <FileText className="w-4 h-4" /> Atualizar Termo
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" /> Salvar Termo
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}