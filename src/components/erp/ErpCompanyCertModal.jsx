import { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Loader2, Upload, CheckCircle2, AlertTriangle } from "lucide-react";

const cnpjDigits = (v) => String(v || "").replace(/\D/g, "");
const fmtBR = (iso) => { try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return iso || "—"; } };

// Anexar o certificado digital A1 (.pfx/.p12) da empresa — o arquivo é enviado
// ao storage privado, validado (CNPJ e validade extraídos do certificado),
// ativado automaticamente para uso na consulta SEFAZ / emissão.
export default function ErpCompanyCertModal({ user, company, onClose }) {
  const [file, setFile] = useState(null);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  const handleAttach = async () => {
    setError(""); setResult(null);
    if (!file || !password) { setError("Selecione o arquivo .pfx/.p12 e informe a senha do certificado."); return; }
    setSaving(true);
    try {
      const up = await base44.integrations.Core.UploadPrivateFile({ file });
      if (!up?.file_uri) throw new Error("Falha no upload do arquivo.");
      const res = await base44.functions.invoke("manageCertificate", {
        operation: "upload",
        email: user.email,
        file_uri: up.file_uri,
        file_name: file.name,
        password,
        alias: `${company.razao_social} — Certificado A1`,
        modelos: ["NFe", "NFCe", "NFSe"],
      });
      const data = res?.data || {};
      if (!data.success || !data.certificate) throw new Error(data.error || "Erro ao importar o certificado.");
      const cert = data.certificate;
      // Ativa o certificado para uso imediato (consulta SEFAZ / emissão)
      await base44.functions.invoke("manageCertificate", { operation: "activate", email: user.email, certificate_id: cert.id });
      const mismatch = company.cnpj && cert.cnpj && cnpjDigits(company.cnpj) !== cnpjDigits(cert.cnpj);
      setResult({ cert, mismatch });
    } catch (e) {
      setError(e?.response?.data?.error || e?.data?.error || e?.message || "Erro ao anexar certificado.");
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="font-bold flex items-center gap-2"><KeyRound className="w-5 h-5 text-indigo-600" /> Anexar Certificado A1</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-500">✕</button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-500">Empresa: <b>{company.razao_social}</b>{company.cnpj ? ` — CNPJ ${cnpjDigits(company.cnpj)}` : ""}</p>
          <div>
            <Label className="text-xs">Arquivo do certificado (.pfx / .p12)</Label>
            <Input type="file" accept=".pfx,.p12,application/x-pkcs12" ref={fileRef} onChange={e => setFile(e.target.files?.[0] || null)} className="mt-1 text-xs" />
          </div>
          <div>
            <Label className="text-xs">Senha do certificado</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha do arquivo .pfx" className="mt-1" />
          </div>
          {error && <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5"><AlertTriangle className="w-4 h-4" /> {error}</div>}
          {result && (
            <div className={`rounded-lg border p-3 text-xs space-y-1 ${result.mismatch ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
              <p className="flex items-center gap-1.5 font-medium">{result.mismatch ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                {result.mismatch ? "Certificado anexado — CNPJ diferente do cadastrado na empresa" : "Certificado anexado e ativado com sucesso"}</p>
              <p>Nome: <b>{result.cert.alias}</b></p>
              <p>CNPJ do certificado: <b>{result.cert.cnpj || "—"}</b></p>
              <p>Validade: <b>{fmtBR(result.cert.valid_from)} a {fmtBR(result.cert.valid_to)}</b></p>
              <p className="text-gray-500">Modelos autorizados: {(result.cert.modelos || []).join(", ")}</p>
              {result.mismatch && <p className="font-medium">Atenção: o CNPJ do certificado não corresponde ao CNPJ desta empresa — as consultas e emissões da SEFAZ com este certificado serão no nome do titular do certificado.</p>}
            </div>
          )}
        </div>
        <div className="p-4 border-t flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>{result ? "Fechar" : "Cancelar"}</Button>
          {!result && (
            <Button size="sm" onClick={handleAttach} disabled={saving} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {saving ? "Anexando..." : "Anexar Certificado"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}