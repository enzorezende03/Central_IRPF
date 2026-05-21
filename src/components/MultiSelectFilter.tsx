import { useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface Props {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  className?: string;
  width?: string;
}

export function MultiSelectFilter({
  options,
  selected,
  onChange,
  placeholder,
  className,
  width = "w-44",
}: Props) {
  const [open, setOpen] = useState(false);
  const toggle = (v: string) => {
    if (selected.includes(v)) onChange(selected.filter((s) => s !== v));
    else onChange([...selected, v]);
  };
  const label =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? placeholder
        : `${placeholder} (${selected.length})`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(width, "h-10 justify-between font-normal", className)}
        >
          <span className="truncate">{label}</span>
          {selected.length > 0 ? (
            <X
              className="h-4 w-4 opacity-60 hover:opacity-100 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
            />
          ) : (
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1" align="start">
        <div className="max-h-72 overflow-y-auto">
          {options.length === 0 && (
            <div className="px-2 py-3 text-sm text-muted-foreground">Sem opções</div>
          )}
          {options.map((opt) => {
            const checked = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent text-left"
              >
                <Checkbox checked={checked} className="pointer-events-none" />
                <span className="flex-1 truncate">{opt.label}</span>
                {checked && <Check className="h-4 w-4 opacity-70" />}
              </button>
            );
          })}
        </div>
        {selected.length > 0 && (
          <div className="border-t mt-1 pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-8 justify-start text-xs"
              onClick={() => onChange([])}
            >
              Limpar seleção
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
