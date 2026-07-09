import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Loader2 } from "lucide-react";
import { setPortalUser } from "@/lib/portalSession";

export default function PortalLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,hsl(var(--primary)/0.1),transparent_60%)] pointer-events-none" />
      <div className="max-w-sm w-full relative">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">SoftPremier</h1>
          <p className="mt-2 text-sm text-muted-foreground">Acesse seus aplicativos</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 bg-card p-6 rounded-2xl border shadow-sm">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                placeholder="seu@email.com"
                required
                autoFocus
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                placeholder="••••••••"
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Entrando...
              </>
            ) : (
              "Entrar"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}