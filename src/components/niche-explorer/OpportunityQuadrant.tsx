"use client";

import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";

type KeywordPoint = {
  term: string;
  demand: number;
  competition: number;
  opportunity: number;
};

type OpportunityQuadrantProps = {
  keywords: KeywordPoint[];
  onPointClick?: (keyword: KeywordPoint) => void;
};

export function OpportunityQuadrant({ keywords, onPointClick }: OpportunityQuadrantProps): JSX.Element {
  const getQuadrantColor = (demand: number, competition: number): string => {
    if (demand >= 50 && competition < 50) return "#16A34A"; // Green - sweet spot
    if (demand >= 50 && competition >= 50) return "#D97706"; // Orange - high competition
    if (demand < 50 && competition < 50) return "#3366FF"; // Blue - low volume
    return "#DC2626"; // Red - avoid
  };

  const getQuadrantLabel = (demand: number, competition: number): string => {
    if (demand >= 50 && competition < 50) return "Sweet Spot";
    if (demand >= 50 && competition >= 50) return "Competitive";
    if (demand < 50 && competition < 50) return "Niche";
    return "Avoid";
  };

  const data = keywords.map((kw) => ({
    x: kw.demand,
    y: 100 - kw.competition, // Invert so low competition is high on Y axis
    z: kw.opportunity,
    term: kw.term,
    color: getQuadrantColor(kw.demand, kw.competition),
    demand: kw.demand,
    competition: kw.competition,
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-semibold text-sm mb-2">{data.term}</p>
          <div className="space-y-1 text-xs">
            <p><span className="text-muted-foreground">Demand:</span> <span className="font-semibold">{data.demand}%</span></p>
            <p><span className="text-muted-foreground">Competition:</span> <span className="font-semibold">{data.competition}%</span></p>
            <p><span className="text-muted-foreground">Opportunity:</span> <span className="font-semibold">{data.z}%</span></p>
            <p className="pt-1 font-semibold" style={{ color: data.color }}>
              {getQuadrantLabel(data.demand, data.competition)}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-600"></div>
          <span>Sweet Spot (High Demand, Low Competition)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-orange-600"></div>
          <span>Competitive (High Demand, High Competition)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-600"></div>
          <span>Niche (Low Demand, Low Competition)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-600"></div>
          <span>Avoid (Low Demand, High Competition)</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis
            type="number"
            dataKey="x"
            name="Demand"
            domain={[0, 100]}
            label={{ value: 'Demand →', position: 'bottom', offset: 0 }}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Low Competition"
            domain={[0, 100]}
            label={{ value: '← Low Competition', angle: -90, position: 'left' }}
            tick={{ fontSize: 12 }}
          />
          <ZAxis type="number" dataKey="z" range={[50, 400]} name="Opportunity" />
          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
          <ReferenceLine x={50} stroke="#94A3B8" strokeDasharray="5 5" />
          <ReferenceLine y={50} stroke="#94A3B8" strokeDasharray="5 5" />
          <Scatter
            data={data}
            onClick={(data) => onPointClick?.(keywords.find(kw => kw.term === data.term)!)}
            className="cursor-pointer"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export default OpportunityQuadrant;
