import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  /** Units wanted but not backed by real stock. Omitted for a set, where
   * the shortfall sits on the components rather than the booking. */
  units?: number;
  materialName?: string;
}

/** Overboeken — the amber marker on any line that wants more units than
 * exist. Amber (not destructive) on purpose: in concept this is a
 * deliberate, legitimate state, not an error. `Badge` has no warning
 * variant, so it is `outline` plus the project's amber utility colours
 * (design skill: amber-600 on light, amber-500 on dark for contrast). */
export function OverbookBadge({ units, materialName }: Props) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className="shrink-0 text-[9px] h-4 px-1 border-amber-500/60 text-amber-600 dark:text-amber-500"
        >
          {units != null ? `${units} overboekt` : "niet volledig in voorraad"}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        {units != null
          ? `${units} ${materialName ? `× ${materialName} ` : ""}niet in voorraad — moet nog aangekocht worden.`
          : "Niet alle onderdelen van deze set zijn in voorraad."}{" "}
        Het project kan zo niet naar bevestigd.
      </TooltipContent>
    </Tooltip>
  );
}
