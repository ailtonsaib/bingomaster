import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollText, ChevronDown, ChevronUp, Save } from "lucide-react";
import { useRegulation } from "@/hooks/useRegulation";

export default function RegulationPanel() {
  const { regulation, setRegulation } = useRegulation();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setText(regulation);
  }, [regulation]);

  const handleSave = async () => {
    setSaving(true);
    await setRegulation(text);
    setSaving(false);
  };

  return (
    <div className="bg-card rounded-2xl shadow-lg border overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5"
      >
        <div className="flex items-center gap-2">
          <ScrollText className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold font-heading">Regulamento do Bingo</h2>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-3">
          <p className="text-sm text-muted-foreground">
            Digite o regulamento que poderá ser impresso junto às cartelas (uma cartela por folha, alternando com o regulamento).
          </p>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Digite aqui o regulamento do bingo..."
            className="min-h-[300px] text-sm leading-relaxed"
          />
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />
              {saving ? "Salvando..." : "Salvar Regulamento"}
            </Button>
            {text && text.trim() && (
              <span className="text-xs text-green-600 font-medium">✓ Regulamento cadastrado</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}