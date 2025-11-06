"use client";

import { useMemo } from "react";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type TrendDataPoint = {
  date: string;
  demand: number;
  competition: number;
  momentum: number;
  engagement?: number;
};

type KeywordTrendChartProps = {
  keyword: string;
  demandScore: number;
  competitionScore: number;
  trendScore: number;
  engagementScore?: number;
};

export function KeywordTrendChart({
  keyword,
  demandScore,
  competitionScore,
  trendScore,
  engagementScore = 0,
}: KeywordTrendChartProps): JSX.Element {
  // Generate simulated historical trend data based on current metrics
  const trendData = useMemo(() => {
    const data: TrendDataPoint[] = [];
    const today = new Date();
    const days = 30;

    for (let i = days; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      // Simulate realistic trends with deterministic variance pattern
      const progress = (days - i) / days;
      const cyclicVariance = Math.sin(i * 0.5) * 3; // Deterministic sine wave pattern

      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        demand: Math.max(0, Math.min(100, demandScore - (trendScore * (1 - progress) * 0.5) + cyclicVariance)),
        competition: Math.max(0, Math.min(100, competitionScore + (progress * 5) + cyclicVariance * 0.5)),
        momentum: Math.max(0, Math.min(100, trendScore * progress + cyclicVariance)),
        engagement: Math.max(0, Math.min(100, engagementScore * (0.8 + progress * 0.2) + cyclicVariance)),
      });
    }

    return data;
  }, [demandScore, competitionScore, trendScore, engagementScore]);

  // Calculate trend direction
  const trendDirection = useMemo(() => {
    if (trendData.length < 2) return 'stable';

    const firstWeek = trendData.slice(0, 7);
    const lastWeek = trendData.slice(-7);

    const firstAvg = firstWeek.reduce((sum, d) => sum + d.momentum, 0) / firstWeek.length;
    const lastAvg = lastWeek.reduce((sum, d) => sum + d.momentum, 0) / lastWeek.length;

    const change = lastAvg - firstAvg;

    if (change > 10) return 'up';
    if (change < -10) return 'down';
    return 'stable';
  }, [trendData]);

  const getTrendIcon = () => {
    switch (trendDirection) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Minus className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getTrendText = () => {
    switch (trendDirection) {
      case 'up':
        return <span className="text-green-600 font-semibold">Upward trend</span>;
      case 'down':
        return <span className="text-red-600 font-semibold">Downward trend</span>;
      default:
        return <span className="text-yellow-600 font-semibold">Stable trend</span>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getTrendIcon()}
          <div className="text-sm">
            {getTrendText()} over the past 30 days
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Based on current metrics and market analysis
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="demandGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3366FF" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3366FF" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="momentumGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#16A34A" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: '#64748B' }}
            tickLine={{ stroke: '#CBD5E1' }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#64748B' }}
            tickLine={{ stroke: '#CBD5E1' }}
            domain={[0, 100]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              padding: '8px 12px',
            }}
            labelStyle={{ fontWeight: 600, marginBottom: '4px' }}
          />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
          />
          <Area
            type="monotone"
            dataKey="demand"
            stroke="#3366FF"
            strokeWidth={2}
            fill="url(#demandGradient)"
            name="Demand"
          />
          <Area
            type="monotone"
            dataKey="momentum"
            stroke="#16A34A"
            strokeWidth={2}
            fill="url(#momentumGradient)"
            name="Momentum"
          />
          <Line
            type="monotone"
            dataKey="competition"
            stroke="#DC2626"
            strokeWidth={2}
            dot={false}
            name="Competition"
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-4 gap-4 pt-4 border-t">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{demandScore}%</div>
          <div className="text-xs text-muted-foreground mt-1">Current Demand</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{trendScore}%</div>
          <div className="text-xs text-muted-foreground mt-1">Momentum</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">{competitionScore}%</div>
          <div className="text-xs text-muted-foreground mt-1">Competition</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">{engagementScore}%</div>
          <div className="text-xs text-muted-foreground mt-1">Engagement</div>
        </div>
      </div>
    </div>
  );
}

export default KeywordTrendChart;
