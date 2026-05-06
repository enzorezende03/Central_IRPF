import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSeasons, useWeeklyGoals } from "@/hooks/use-irpf-goals";
import { useAddToPlan, useSeasonPlan } from "@/hooks/use-weekly-plan";
import { toast } from "@/hooks/use-toast";

interface AddToWeekDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  internalOwner?: string | null;
  clientName?: string | null;
}

export function AddToWeekDialog({
  open,
  onOpenChange,
  caseId,
  internalOwner,
  clientName,
}: AddToWeekDialogProps) {
  const { data: seasons = [] } = useSeasons();
  const [seasonId, setSeasonId] = useState<string>("");

  useEffect(() => {
    if (!seasonId && seasons.length > 0) {
      const y = new Date().getFullYear();
      const m = seasons.find((s) => s.season_year === y) ?? seasons[0];
      setSeasonId(m.id);
    }
  }, [seasons, seasonId]);

  const { data: weeks = [] } = useWeeklyGoals(seasonId || null);
  const { data: plan = [] } = useSeasonPlan(seasonId || null);
  const add = useAddToPlan();

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const currentWeek = useMemo(
    () =>
      weeks.find((w) => w.week_start <= todayStr && todayStr <= w.week_end) ??
      weeks[0],
    [weeks, todayStr],
  );

  const [weekNumber, setWeekNumber] = useState<number | null>(null);
  useEffect(() => {
    if (weekNumber === null && currentWeek) setWeekNumber(currentWeek.week_number);
  }, [currentWeek, weekNumber]);

  const alreadyPlanned = plan.find((p) => p.case_id === caseId);

  const handleConfirm = async () => {
    if (!seasonId || weekNumber === null) return;
    if (alreadyPlanned) {
      toast({
        title: "Já planejada",
        description: `Esta demanda já está na semana ${alreadyPlanned.week_number}.`,
        variant: "destructive",
      });
      return;
    }
    await add.mutateAsync([
      {
        season_id: seasonId,
        week_number: weekNumber,
        case_id: caseId,
        responsible: internalOwner ?? null,
      },
    ]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar ao planejamento semanal</DialogTitle>
          <DialogDescription>
            {clientName ? <>Demanda de <strong>{clientName}</strong>.</> : null} Selecione a temporada e a semana.
          </DialogDescription>
        </DialogHeader>

        {seasons.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma temporada configurada. Crie uma em <strong>Metas IRPF</strong>.
          </p>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Temporada</Label>
              <Select value={seasonId} onValueChange={(v) => { setSeasonId(v); setWeekNumber(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {seasons.map((s) => (
                    <SelectItem key={s.id} value={s.id}>Temporada {s.season_year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Semana</Label>
              <Select
                value={weekNumber?.toString() ?? ""}
                onValueChange={(v) => setWeekNumber(Number(v))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione uma semana" /></SelectTrigger>
                <SelectContent>
                  {weeks.map((w) => {
                    const isCurrent = currentWeek?.week_number === w.week_number;
                    return (
                      <SelectItem key={w.id} value={w.week_number.toString()}>
                        Semana {w.week_number} ({new Date(w.week_start).toLocaleDateString("pt-BR")} - {new Date(w.week_end).toLocaleDateString("pt-BR")})
                        {isCurrent ? " · atual" : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {alreadyPlanned && (
              <p className="text-xs text-warning">
                Esta demanda já está na semana {alreadyPlanned.week_number} desta temporada.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={!seasonId || weekNumber === null || add.isPending || !!alreadyPlanned}
          >
            {add.isPending ? "Enviando..." : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
