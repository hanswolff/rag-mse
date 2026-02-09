"use client";

import { VictoryPie, VictoryTooltip } from "victory";
import { VOTE_OPTIONS } from "@/lib/vote-utils";

interface VotingPieChartProps {
  voteCounts: {
    JA: number;
    NEIN: number;
    VIELLEICHT: number;
  };
}

const CHART_COLORS = {
  JA: "#10b981",
  NEIN: "#ef4444",
  VIELLEICHT: "#f59e0b",
};

export function VotingPieChart({ voteCounts }: VotingPieChartProps) {
  const totalVotes = voteCounts.JA + voteCounts.NEIN + voteCounts.VIELLEICHT;

  if (totalVotes === 0) {
    return (
      <div className="h-72 flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-50 rounded-2xl border-2 border-dashed border-gray-200 shadow-inner">
        <div className="text-center">
          <p className="text-gray-500 font-medium text-base">Noch keine Teilnahmeanmeldungen vorhanden</p>
        </div>
      </div>
    );
  }

  const data = VOTE_OPTIONS
    .map((option) => {
      const value = voteCounts[option.value];
      const percent = value / totalVotes;
      return {
        name: option.label,
        value,
        percent,
        color: CHART_COLORS[option.value],
      };
    })
    .filter((item) => item.value > 0);

  const colors = data.map((item) => item.color);

  return (
    <div className="w-full bg-gradient-to-br from-white via-gray-50 to-white rounded-2xl shadow-lg p-6">
      <div className="w-full h-80">
        <VictoryPie
          data={data}
          x="name"
          y="value"
          width={320}
          height={320}
          innerRadius={70}
          padAngle={data.length === 1 ? 0 : 2}
          labels={({ datum }) => `${datum.name}: ${datum.value}`}
          labelComponent={
            <VictoryTooltip
              flyoutStyle={{
                fill: "rgba(255, 255, 255, 0.98)",
                stroke: "#e5e7eb",
                strokeWidth: 1,
              }}
              cornerRadius={10}
              pointerLength={6}
              style={{ fill: "#1f2937", fontSize: 12, fontWeight: 600 }}
            />
          }
          colorScale={colors}
          style={{
            parent: { width: "100%", height: "100%" },
            labels: { display: "none" },
          }}
          animate={{ duration: 800, easing: "quadInOut" }}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm font-medium text-gray-700">
        {data.map((item) => (
          <div key={item.name} className="inline-flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: item.color }}
              aria-hidden="true"
            />
            <span>{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
