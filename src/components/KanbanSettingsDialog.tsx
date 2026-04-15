import { useState, useEffect } from "react";
import { Settings2, GripVertical, Eye, EyeOff, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useKanbanPreferences, KanbanPreferences } from "@/hooks/use-kanban-preferences";
import { toast } from "sonner";

const ALL_COLUMNS = [
  { key: "aguardando_cliente", label: "Aguardando Cliente" },
  { key: "documentos_parciais", label: "Documentos Parciais" },
  { key: "documentos_em_analise", label: "Documentos em Análise" },
  { key: "em_andamento", label: "Em Andamento" },
  { key: "impedida", label: "Impedida" },
  { key: "previa_enviada", label: "Prévia Enviada" },
  { key: "pendencia", label: "Pendência" },
  { key: "finalizado", label: "Finalizado" },
];

const DEFAULT_ORDER = ALL_COLUMNS.map((c) => c.key);

export function KanbanSettingsDialog() {
  const { preferences, savePreferences, isSaving } = useKanbanPreferences();
  const [open, setOpen] = useState(false);
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER);
  const [hidden, setHidden] = useState<string[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      const validKeys = new Set(DEFAULT_ORDER);
      const filtered = preferences.column_order.filter((k) => validKeys.has(k));
      const missing = DEFAULT_ORDER.filter((k) => !filtered.includes(k));
      setOrder([...filtered, ...missing]);
      setHidden([...preferences.hidden_columns.filter((k) => validKeys.has(k))]);
    }
  }, [open, preferences]);

  const toggleColumn = (key: string) => {
    setHidden((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    setDragIdx(idx);
  };

  const handleSave = () => {
    savePreferences({ column_order: order, hidden_columns: hidden });
    toast.success("Preferências salvas!");
    setOpen(false);
  };

  const handleReset = () => {
    setOrder(DEFAULT_ORDER);
    setHidden([]);
  };

  const labelMap = Object.fromEntries(ALL_COLUMNS.map((c) => [c.key, c.label]));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline">Personalizar</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Personalizar Kanban</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-3">
          Arraste para reordenar e ative/desative colunas. Suas preferências são salvas na sua conta.
        </p>
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {order.map((key, idx) => {
            const isHidden = hidden.includes(key);
            return (
              <div
                key={key}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={() => setDragIdx(null)}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 cursor-grab active:cursor-grabbing transition-colors ${
                  isHidden ? "opacity-50 bg-muted" : "bg-background"
                } ${dragIdx === idx ? "ring-2 ring-primary" : ""}`}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="flex-1 text-sm font-medium">{labelMap[key] ?? key}</span>
                <button
                  type="button"
                  onClick={() => toggleColumn(key)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            );
          })}
        </div>
        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1">
            <RotateCcw className="h-3.5 w-3.5" /> Restaurar padrão
          </Button>
          <Button onClick={handleSave} disabled={isSaving} size="sm">
            {isSaving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
