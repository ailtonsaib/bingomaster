import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2, AlertCircle, Info } from "lucide-react";
import { setPortalUser } from "@/lib/portalSession";

export default function PortalLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const errors = {};
    if (!email.trim()) errors.email = "Preencha este campo.";
    if (!password.trim()) errors.password = "Preencha este campo.";
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      const res = await base44.functions.invoke('portalAuth', {
        operation: 'login',
        email,
        password,
      });
      if (res.data.user) {
        setPortalUser(res.data.user);
        window.location.href = '/';
      }
    } catch (err) {
      setError(err.response?.data?.error || "Email ou senha inválidos");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Radial gradient background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,#FFFFFF_0%,#F5F5F5_70%)] pointer-events-none" />

      <div className="max-w-sm w-full relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold font-display tracking-tight text-[#1B1C21]">
            SoftPremier
          </h1>
          <p className="mt-2 text-sm text-[#71717A]">Acesse seus aplicativos</p>
        </div>

        {/* Login Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-white p-8 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-100"
        >
          {/* Email field */}
          <div className="mb-5">
            <Label className="text-sm font-medium text-[#333333] mb-1.5 block">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7E57C2]" />
              <Input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: null });
                }}
                className="pl-10 h-11 border-[#7E57C2] focus:border-[#6200EA] focus:ring-[#6200EA]/20 rounded-lg"
                placeholder="seu@email.com"
                autoFocus
              />
            </div>
            {fieldErrors.email && (
              <div className="absolute mt-1 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200">
                <AlertCircle className="w-3.5 h-3.5 text-[#F57C00]" />
                <span className="text-xs text-[#333333]">{fieldErrors.email}</span>
              </div>
            )}
          </div>

          {/* Password field */}
          <div className="mb-6">
            <Label className="text-sm font-medium text-[#333333] mb-1.5 block">Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7E57C2]" />
              <Input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: null });
                }}
                className="pl-10 h-11 border-[#7E57C2] focus:border-[#6200EA] focus:ring-[#6200EA]/20 rounded-lg"
                placeholder="••••••••"
              />
            </div>
            {fieldErrors.password && (
              <div className="mt-1 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 w-fit">
                <AlertCircle className="w-3.5 h-3.5 text-[#F57C00]" />
                <span className="text-xs text-[#333333]">{fieldErrors.password}</span>
              </div>
            )}
          </div>

          {/* General error */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Submit button */}
          <Button
            type="submit"
            className="w-full h-11 rounded-lg bg-[#6200EA] hover:bg-[#6200EA]/90 text-white font-medium"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Entrando...
              </>
            ) : (
              "Entrar"
            )}
          </Button>
        </form>

        {/* Test credentials info */}
        <div className="mt-4 p-4 rounded-xl bg-white/80 border border-[#7E57C2]/20 backdrop-blur-sm">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-[#7E57C2] flex-shrink-0 mt-0.5" />
            <div className="text-xs text-[#71717A] space-y-1">
              <p className="font-semibold text-[#333333]">Credenciais de teste:</p>
              <p>Email: <span className="font-mono text-[#7E57C2]">teste@softpremier.com.br</span></p>
              <p>Senha: <span className="font-mono text-[#7E57C2]">teste123</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}