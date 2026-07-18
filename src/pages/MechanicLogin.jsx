import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wrench, Loader2, Lock } from "lucide-react";
import { setMechanicSession } from "@/lib/mechanicSession";

export default function MechanicLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Informe email e senha.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const mechanics = await base44.entities.DiagnosticMechanic.filter({ email: email.trim() });
      const mech = mechanics.find(m => m.is_active !== false && m.password === password.trim());
      if (!mech) {
        setError("Email ou senha incorretos. Verifique com o administrador.");
        setLoading(false);
        return;
      }
      setMechanicSession({
        id: mech.id,
        name: mech.name,
        email: mech.email,
        user_email: mech.user_email,
        specialty: mech.specialty,
      });
      window.location.href = "/mecanico-painel";
    } catch {
      setError("Erro ao conectar. Tente novamente.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Wrench className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Painel do Mecânico</h1>
          <p className="text-sm text-gray-500 mt-1">Acesse suas Ordens de Serviço</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div>
            <Label className="text-sm font-medium">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="mt-1"
              autoFocus
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Senha</Label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••"
                className="mt-1 pl-9"
              />
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full text-white" style={{ backgroundColor: "#2563EB" }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Entrar"}
          </Button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Solicite seu acesso com o administrador da oficina.
        </p>
      </div>
    </div>
  );
}