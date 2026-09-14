"use client";

import { AGENTS, AgentName, AgentStatus } from "@/lib/agents/types";

interface Props {
  statuses: Record<AgentName, AgentStatus>;
  active: AgentName | null;
}

interface NodeLayout {
  name: AgentName;
  cx: number;
  cy: number;
}

const W = 220;
const H = 360;
const R = 22;

const NODES: NodeLayout[] = [
  { name: "planner", cx: 110, cy: 40 },
  { name: "file_selector", cx: 110, cy: 115 },
  { name: "architect", cx: 50, cy: 200 },
  { name: "concern_hunter", cx: 170, cy: 200 },
  { name: "synthesizer", cx: 110, cy: 290 },
];

const EDGES: [AgentName, AgentName][] = [
  ["planner", "file_selector"],
  ["file_selector", "architect"],
  ["file_selector", "concern_hunter"],
  ["architect", "synthesizer"],
  ["concern_hunter", "synthesizer"],
];

function getNode(name: AgentName) {
  return NODES.find((n) => n.name === name)!;
}

export function AgentGraph({ statuses, active }: Props) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto select-none"
      role="img"
      aria-label="Multi-agent execution graph"
    >
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {NODES.map((n) => (
          <radialGradient key={n.name} id={`g-${n.name}`} cx="50%" cy="50%">
            <stop offset="0%" stopColor={AGENTS[n.name].hue} stopOpacity="0.95" />
            <stop offset="100%" stopColor={AGENTS[n.name].hue} stopOpacity="0.4" />
          </radialGradient>
        ))}
      </defs>

      {/* Edges */}
      {EDGES.map(([from, to]) => {
        const a = getNode(from);
        const b = getNode(to);
        const fromDone = statuses[from] === "done";
        const toRunning = statuses[to] === "running";
        const isActive = fromDone && toRunning;
        const fromColor = fromDone ? AGENTS[from].hue : "#30363d";
        const stroke = isActive ? AGENTS[to].hue : fromColor;
        const opacity = fromDone ? 0.85 : 0.35;
        const dash = isActive ? "4 4" : undefined;
        return (
          <line
            key={`${from}-${to}`}
            x1={a.cx}
            y1={a.cy + R}
            x2={b.cx}
            y2={b.cy - R}
            stroke={stroke}
            strokeWidth={2}
            strokeOpacity={opacity}
            strokeDasharray={dash}
            strokeLinecap="round"
          >
            {isActive && (
              <animate
                attributeName="stroke-dashoffset"
                from="0"
                to="-16"
                dur="0.8s"
                repeatCount="indefinite"
              />
            )}
          </line>
        );
      })}

      {/* Nodes */}
      {NODES.map((n) => {
        const status = statuses[n.name];
        const meta = AGENTS[n.name];
        const isActive = active === n.name || status === "running";
        const isDone = status === "done";
        const isError = status === "error";
        const fill = isError
          ? "#3a1212"
          : isDone || isActive
            ? `url(#g-${n.name})`
            : "#0d1117";
        const ringColor = isError ? "#f85149" : meta.hue;
        const ringOpacity = isActive ? 1 : isDone ? 0.7 : 0.35;
        return (
          <g key={n.name} filter={isActive ? "url(#glow)" : undefined}>
            <circle
              cx={n.cx}
              cy={n.cy}
              r={R}
              fill={fill}
              stroke={ringColor}
              strokeWidth={isActive ? 2.2 : 1.4}
              strokeOpacity={ringOpacity}
            />
            {isActive && (
              <circle
                cx={n.cx}
                cy={n.cy}
                r={R + 4}
                fill="none"
                stroke={meta.hue}
                strokeWidth={1.4}
                strokeOpacity={0.6}
              >
                <animate attributeName="r" from={R + 2} to={R + 10} dur="1.4s" repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" from="0.6" to="0" dur="1.4s" repeatCount="indefinite" />
              </circle>
            )}
            {isDone && !isActive && (
              <path
                d={`M ${n.cx - 6} ${n.cy} l 4 4 l 8 -8`}
                stroke="#0d1117"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            )}
            <text
              x={n.cx}
              y={n.cy + R + 16}
              textAnchor="middle"
              fontSize={11}
              fontFamily="var(--font-geist-mono), monospace"
              fill={isActive || isDone ? "#e6edf3" : "#6e7681"}
              fontWeight={500}
            >
              {meta.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
