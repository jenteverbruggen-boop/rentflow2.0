/** SVG pattern (diagonal hatch) for the "nog te bevestigen" bars: lighter than
 * the solid agreed series and distinguishable without relying on colour.
 * Reference it as `fill="url(#pending-hatch)"` and render `{pendingHatchDefs}` as
 * a direct child of the chart — an element, not a component, because recharts
 * only keeps plain svg children such as `<defs>`. */
export const pendingHatchDefs = (
    <defs>
      <pattern id="pending-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="6" height="6" fill="var(--muted-foreground)" fillOpacity={0.18} />
        <line x1="0" y1="0" x2="0" y2="6" stroke="var(--muted-foreground)" strokeWidth={2.5} />
      </pattern>
    </defs>
);
