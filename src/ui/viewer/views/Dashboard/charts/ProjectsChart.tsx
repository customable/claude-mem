import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ProjectsChartProps {
  data: Array<{ project: string; count: number; tokens: number }>;
}

export function ProjectsChart({ data }: ProjectsChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-base-content/50">
        No data available
      </div>
    );
  }

  // Truncate long project names
  const chartData = data.slice(0, 5).map((item) => ({
    ...item,
    shortName: item.project.length > 12 ? item.project.slice(0, 12) + '...' : item.project,
  }));

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
        >
          <XAxis
            type="number"
            tick={{ fontSize: 11 }}
            className="text-base-content/60"
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="shortName"
            tick={{ fontSize: 11 }}
            className="text-base-content/60"
            tickLine={false}
            axisLine={false}
            width={80}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'oklch(var(--b2))',
              border: '1px solid oklch(var(--b3))',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
            }}
            formatter={(value: number, name: string, props: { payload: { project: string; tokens: number } }) => {
              if (name === 'count') {
                return [
                  <span key="count">
                    {value} memories
                    <br />
                    <span className="text-base-content/50">
                      {props.payload.tokens.toLocaleString()} tokens
                    </span>
                  </span>,
                  props.payload.project,
                ];
              }
              return [value, name];
            }}
            labelFormatter={() => ''}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {chartData.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={`oklch(var(--p) / ${1 - index * 0.15})`}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
