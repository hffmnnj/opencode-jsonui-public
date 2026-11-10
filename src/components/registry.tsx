import type { CSSProperties, ReactNode } from "react";
import type { ComponentRegistry, ComponentRenderer } from "@json-render/image";
import type { ComponentName, Props } from "../catalog/schema.ts";
import type { Box, PageLayout } from "../render/layout.ts";
import type { Graphic } from "../render/graphics.ts";
import { mono, sans, spacing, type Theme } from "../design/theme.ts";
import { day, formatValue } from "../charts/math.ts";

function Lines({ lines, size = 18, color, weight = 400, lineHeight = 1.4 }: { lines?: string[]; size?: number; color?: string; weight?: number; lineHeight?: number }) {
  return <div style={{ display: "flex", flexDirection: "column", fontSize: size, color, fontWeight: weight, flexShrink: 0 }}>
    {(lines ?? []).map((line, index) => <div key={index} style={{ display: "flex", height: size * lineHeight, lineHeight, whiteSpace: "pre" }}>{line || " "}</div>)}
  </div>;
}

export function componentRegistry(page: PageLayout, theme: Theme, graphics: Map<string, Graphic>, createdAt: string): ComponentRegistry {
  const panel = (box: Box): CSSProperties => ({ display: "flex", flexDirection: "column", width: box.width, height: box.height, padding: 23, borderRadius: 18, background: theme.surface, border: `1px solid ${theme.border}`, flexShrink: 0 });
  const title = (box: Box) => <Lines lines={box.lines.title} size={21} color={theme.ink} weight={600} />;
  const plot = (id: string, marginTop = 20) => {
    const graphic = graphics.get(id)!;
    return <img src={`data:image/png;base64,${graphic.png.toString("base64")}`} width={graphic.width} height={graphic.height} style={{ marginTop, flexShrink: 0 }} />;
  };
  const bind = <K extends ComponentName>(fn: (props: Props<K>, box: Box, children: ReactNode, id: string) => ReactNode): ComponentRenderer => ({ element, children }) => {
    const props = element.props as Props<K> & { __node: string };
    return fn(props, page.boxes.get(props.__node)!, children, props.__node);
  };
  return {
    Report: bind<"Report">((props, box, children) => {
      const titleSize = page.width < 1000 ? 34 : 42;
      return <div style={{ display: "flex", flexDirection: "column", width: page.width, height: page.height, padding: spacing.page, background: theme.background, color: theme.ink, fontFamily: sans }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 22, fontSize: 13, letterSpacing: 2, color: theme.accent, flexShrink: 0 }}>
          <div style={{ display: "flex" }}>JSONUI / VISUAL BRIEF</div>
          <div style={{ display: "flex", color: theme.muted, fontFamily: mono, letterSpacing: 0 }}>{props.synthetic ? "SYNTHETIC DATA" : "DATA REPORT"}{page.count > 1 ? `  ·  ${page.index + 1}/${page.count}` : ""}</div>
        </div>
        <div style={{ display: "flex", marginTop: 18 }}><Lines lines={box.lines.title} size={titleSize} weight={600} lineHeight={1.2} /></div>
        {props.subtitle && <div style={{ display: "flex", marginTop: 12 }}><Lines lines={box.lines.subtitle} size={20} color={theme.muted} /></div>}
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.gap, marginTop: 28, flexShrink: 0 }}>{children}</div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 24, paddingTop: 5, borderTop: `1px solid ${theme.border}`, flexShrink: 0 }}>
          <Lines lines={box.lines.source} size={14} lineHeight={1.5} color={theme.muted} />
          <Lines lines={box.lines.note} size={14} lineHeight={1.5} color={theme.muted} />
          <div style={{ display: "flex", marginTop: 2, fontSize: 12, color: theme.muted, fontFamily: mono }}>Rendered {createdAt.replace("T", " ").slice(0, 16)} UTC · json-render</div>
        </div>
      </div>;
    }),
    Row: bind<"Row">((props, box, children) => <div style={{ display: "flex", gap: props.gap, width: box.width, height: box.height, alignItems: "flex-start", flexShrink: 0 }}>{children}</div>),
    Column: bind<"Column">((props, box, children) => <div style={{ display: "flex", flexDirection: "column", gap: props.gap, width: box.width, height: box.height, flexShrink: 0 }}>{children}</div>),
    Card: bind<"Card">((props, box, children) => <div style={panel(box)}>{props.title && <div style={{ display: "flex", marginBottom: 16 }}>{title(box)}</div>}<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>{children}</div></div>),
    Heading: bind<"Heading">((props, box) => <Lines lines={box.lines.text} size={props.level === "section" ? 28 : 22} weight={600} color={theme.ink} />),
    Text: bind<"Text">((props, box) => <Lines lines={box.lines.text} size={19} color={props.tone === "muted" ? theme.muted : theme.ink} />),
    Badge: bind<"Badge">((props, box) => <div style={{ display: "flex", alignSelf: "flex-start", borderRadius: 9, padding: "8px 12px", background: theme.inset, color: props.tone === "neutral" ? theme.muted : theme[props.tone] }}><Lines lines={box.lines.text} size={16} /></div>),
    Divider: bind<"Divider">((_props, box) => <div style={{ display: "flex", width: box.width, height: 1, background: theme.border }} />),
    Icon: bind<"Icon">((props, box) => <div style={{ display: "flex", alignItems: "center", gap: 14 }}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={theme.accent} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={{ chart: "M4 20V12M12 20V4M20 20V8", trend: "M3 17L9 11L14 14L21 5M15 5H21V11", clock: "M12 7V12L16 15M22 12A10 10 0 1 1 2 12A10 10 0 1 1 22 12", check: "M4 12L9 17L20 6", alert: "M12 3L22 21H2Z M12 9V14M12 17V18", layers: "M2 8L12 2L22 8L12 14ZM2 13L12 19L22 13M2 18L12 24L22 18" }[props.name]} /></svg><Lines lines={box.lines.text} size={18} color={theme.ink} /></div>),
    Metric: bind<"Metric">((props, box, _children, id) => {
      const favorable = props.change !== undefined && props.change !== 0 && props.favorable !== "neutral" ? (props.change > 0) === (props.favorable === "up") : undefined;
      const color = favorable === undefined ? theme.muted : favorable ? theme.positive : theme.negative;
      const delta = props.change === undefined ? "" : `${props.change > 0 ? "+" : props.change < 0 ? "−" : ""}${formatValue(Math.abs(props.change), props.changeUnit === "absolute" ? props.format : { decimals: 1 })}${props.changeUnit === "percent" ? "%" : props.changeUnit === "percentagePoints" ? " pp" : ""}`;
      return <div style={panel(box)}>
        <Lines lines={box.lines.label} size={17} color={theme.muted} />
        <div style={{ display: "flex", height: 58, marginTop: 14, fontSize: 44, fontFamily: mono, color: theme.ink }}>{formatValue(props.value, props.format)}</div>
        {props.change !== undefined && <div style={{ display: "flex", height: 36, alignItems: "center", color, fontSize: 17 }}>{delta}<span style={{ marginLeft: 8, fontSize: 13 }}>{favorable === undefined ? "change" : favorable ? "improvement" : "decline"}</span></div>}
        {props.comparison && <div style={{ display: "flex", marginTop: 4 }}><Lines lines={box.lines.comparison} size={14} color={theme.muted} /></div>}
        {props.history && plot(id, 14)}
      </div>;
    }),
    Sparkline: bind<"Sparkline">((_props, box, _children, id) => <div style={panel(box)}><Lines lines={box.lines.title} size={19} weight={600} />{plot(id, 16)}</div>),
    Progress: bind<"Progress">((props, box) => <div style={panel(box)}><Lines lines={box.lines.label} size={18} weight={600} /><div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontSize: 17, color: theme.muted }}><span>{formatValue(props.value, props.format)}</span><span>of {formatValue(props.maximum, props.format)}</span></div><div style={{ display: "flex", marginTop: 12, width: box.width - 48, height: 12, background: theme.inset, borderRadius: 6 }}><div style={{ display: "flex", width: (box.width - 48) * props.value / props.maximum, height: 12, background: theme.accent, borderRadius: 6 }} /></div></div>),
    Chart: bind<"Chart">((props, box, _children, id) => <div style={panel(box)}>{title(box)}{plot(id)}{props.caption && <div style={{ display: "flex", marginTop: 14 }}><Lines lines={box.lines.caption} size={15} color={theme.muted} /></div>}</div>),
    Table: bind<"Table">((props, box) => {
      const alignment = props.columns.map(column => column.format || props.rows.some(row => typeof row[column.key] === "number") ? "flex-end" : "flex-start");
      return <div style={panel(box)}>{title(box)}<div style={{ display: "flex", flexDirection: "column", marginTop: 20 }}>
        <div style={{ display: "flex", height: box.rowHeights![0], background: theme.inset, borderRadius: 8 }}>{props.columns.map((column, index) => <div key={column.key} style={{ display: "flex", width: box.columns![index], padding: "12px 9px", justifyContent: alignment[index] }}><Lines lines={box.lines[`column:${index}`]} size={14} weight={600} color={theme.muted} /></div>)}</div>
        {props.rows.map((row, rowIndex) => <div key={rowIndex} style={{ display: "flex", height: box.rowHeights![rowIndex + 1], borderBottom: `1px solid ${theme.border}` }}>{props.columns.map((column, index) => <div key={column.key} style={{ display: "flex", width: box.columns![index], padding: "10px 9px", justifyContent: alignment[index] }}><Lines lines={box.lines[`cell:${rowIndex}:${index}`]} size={15} color={theme.ink} /></div>)}</div>)}
      </div></div>;
    }),
    Insight: bind<"Insight">((props, box) => <div style={{ ...panel(box), background: theme.accentSoft, borderColor: theme.accent }}><Lines lines={box.lines.title} size={22} weight={600} color={theme.accent} /><div style={{ display: "flex", marginTop: 14 }}><Lines lines={box.lines.text} size={20} /></div>{props.caveat && <div style={{ display: "flex", marginTop: 22 }}><Lines lines={box.lines.caveat} size={15} color={theme.muted} /></div>}</div>),
    Timeline: bind<"Timeline">((props, box) => <div style={panel(box)}>{title(box)}<div style={{ display: "flex", flexDirection: "column", marginTop: 20 }}>{props.events.map((event, index) => <div key={index} style={{ display: "flex", paddingBottom: 28 }}><div style={{ display: "flex", width: 140, paddingTop: 3, fontFamily: mono, fontSize: 14, color: theme.accent }}>{event.date}</div><div style={{ display: "flex", flexDirection: "column", borderLeft: `2px solid ${theme.border}`, paddingLeft: 13 }}><Lines lines={box.lines[`event:${index}`]} size={18} weight={600} /><Lines lines={box.lines[`detail:${index}`]} size={16} color={theme.muted} /></div></div>)}</div></div>),
    Gantt: bind<"Gantt">((props, box) => {
      const start = Math.min(...props.tasks.map(task => day(task.start))), end = Math.max(...props.tasks.map(task => day(task.end))) + 1;
      const labelWidth = Math.min(190, (box.width - 48) * 0.3), trackWidth = box.width - 48 - labelWidth;
      const startText = new Date(start * 86400000).toISOString().slice(0, 10), endText = new Date((end - 1) * 86400000).toISOString().slice(0, 10);
      return <div style={panel(box)}>{title(box)}<div style={{ display: "flex", justifyContent: "space-between", marginTop: 22, marginLeft: labelWidth, height: 54, fontSize: 14, fontFamily: mono, color: theme.muted }}><span>{startText}</span><span>{endText}</span></div>{props.tasks.map((task, index) => <div key={index} style={{ display: "flex", height: box.rowHeights![index], alignItems: "center" }}><div style={{ display: "flex", width: labelWidth, paddingRight: 12, color: theme.ink }}><Lines lines={box.lines[`task:${index}`]} size={15} /></div><div style={{ display: "flex", width: trackWidth, height: 28, position: "relative", background: theme.inset, borderRadius: 7 }}><div style={{ display: "flex", position: "absolute", left: (day(task.start) - start) / (end - start) * trackWidth, width: (day(task.end) + 1 - day(task.start)) / (end - start) * trackWidth, height: 28, background: theme.series[index % theme.series.length], opacity: 0.35, borderRadius: 7 }} /><div style={{ display: "flex", position: "absolute", left: (day(task.start) - start) / (end - start) * trackWidth, width: (day(task.end) + 1 - day(task.start)) / (end - start) * trackWidth * task.progress, height: 28, background: theme.series[index % theme.series.length], borderRadius: 7 }} /></div></div>)}</div>;
    }),
    Flow: bind<"Flow">((_props, box, _children, id) => <div style={panel(box)}>{title(box)}{plot(id)}</div>),
    Hierarchy: bind<"Hierarchy">((_props, box, _children, id) => <div style={panel(box)}>{title(box)}{plot(id)}</div>),
    Image: bind<"Image">((props, box, _children, id) => {
      const graphic = graphics.get(id)!, bounds = graphic.imageBounds!;
      return <div style={panel(box)}>{title(box)}<div style={{ display: "flex", position: "relative", marginTop: 20, height: 320 }}>{plot(id, 0)}{props.markers.map((marker, index) => <div key={index} style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "absolute", left: Math.min(graphic.width - 30, Math.max(0, bounds.left + marker.x * bounds.width - 15)), top: Math.min(290, Math.max(0, bounds.top + marker.y * bounds.height - 15)), width: 30, height: 30, borderRadius: 15, background: theme.accent, color: theme.surface, border: `2px solid ${theme.surface}`, fontSize: 16, fontWeight: 600 }}>{index + 1}</div>)}</div>{props.caption && <div style={{ display: "flex", marginTop: 14 }}><Lines lines={box.lines.caption} size={15} color={theme.muted} /></div>}{props.markers.map((_marker, index) => <div key={index} style={{ display: "flex", marginTop: 8 }}><Lines lines={box.lines[`marker:${index}`]} size={15} color={theme.muted} /></div>)}</div>;
    }),
  };
}
