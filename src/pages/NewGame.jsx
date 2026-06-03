import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import PrizeForm from "@/components/bingo/PrizeForm";

export default function NewGame() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [prizes, setPrizes] = useState([{ name: "", description: "", awarded: false }]);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const game = await base44.entities.BingoGame.create({
      name: name.trim(),
      status: "waiting",
      drawn_numbers: [],
      max_number: 75,
      prizes: prizes.filter((p) => p.name.trim()),
    });
    navigate(`/game/${game.id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-8">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-2xl flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" />
              Novo Jogo de Bingo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Jogo</Label>
              <Input
                id="name"
                placeholder="Ex: Bingo da Festa Junina"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <PrizeForm prizes={prizes} onChange={setPrizes} />

            <Button
              onClick={handleCreate}
              disabled={!name.trim() || saving}
              className="w-full gap-2"
              size="lg"
            >
              {saving ? "Criando..." : "Criar Jogo"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}