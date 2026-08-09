import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, ArrowLeft, Loader2 } from "lucide-react";

export default function ForgotPasswordFlow({ backendFunction = "portalAuth", systemName = "SoftPremier", onBack }) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleRequest = async () => {
    setError("");
    setSuccess("");
    if (!email) { setError("Informe seu email cadastrado"); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke(backendFunction, { operation: "requestPasswordReset", email });
      setSuccess(res.data.message || "Senha temporária enviada para seu email.");
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao enviar email de recuperação");
    }
    setLoading(false);
  };

  const handleChange = async () => {
    setError("");
    setSuccess("");
    if (!email || !tempPassword || !newPassword) { setError("Preencha todos os campos"); return; }
    if (newPassword !== confirmPassword) { setError("As senhas não coincidem"); return; }
    if (newPassword.length < 6) { setError("A nova senha deve ter ao menos 6 caracteres"); return; }
    setLoading(true);
    try {
      await base44.functions.invoke(backendFunction, { operation: "changePassword", email, current_password: tempPassword, new_password: newPassword });
      setSuccess("Senha alterada com sucesso! Você já pode fazer login.");
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao alterar a senha");
    }
    setLoading(false);
  };

  const reset = () => {
    setStep(1);
    setEmail("");
    setTempPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setSuccess("");
    if (onBack) onBack();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
            <Mail className="w-7 h-7 text-primary" />
          </div>
          <CardTitle>Recuperação de Senha</CardTitle>
          <p className="text-sm text-muted-foreground">
            {step === 1 && "Informe o email cadastrado para receber uma senha temporária"}
            {step === 2 && "Digite a senha temporária recebida por email e sua nova senha"}
            {step === 3 && "Senha alterada com sucesso!"}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 1 && (
            <>
              <div>
                <Label>Email cadastrado</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" onKeyDown={(e) => e.key === "Enter" && handleRequest()} autoFocus />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="w-full" onClick={handleRequest} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Enviar senha temporária
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Apenas emails cadastrados no {systemName} podem recuperar a senha.
              </p>
              <Button variant="ghost" className="w-full" onClick={reset}>
                <ArrowLeft className="w-4 h-4" /> Voltar ao login
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              {success && <p className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg p-3">{success}</p>}
              <div>
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled />
              </div>
              <div>
                <Label>Senha temporária</Label>
                <Input type="password" value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} placeholder="Senha recebida por email" autoFocus />
              </div>
              <div>
                <Label>Nova senha</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
              </div>
              <div>
                <Label>Confirmar nova senha</Label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repita a nova senha" onKeyDown={(e) => e.key === "Enter" && handleChange()} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="w-full" onClick={handleChange} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />} Alterar senha
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => { setStep(1); setError(""); setSuccess(""); }}>
                <ArrowLeft className="w-4 h-4" /> Reenviar senha temporária
              </Button>
            </>
          )}

          {step === 3 && (
            <>
              {success && <p className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">{success}</p>}
              <Button className="w-full" onClick={reset}>
                <Lock className="w-4 h-4" /> Ir para o login
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}