/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import styles from './CardModal.module.css'; // Reusing matching styles

interface MokiMetadata {
  id: string;
  name: string;
  portraitUrl: string;
  fur: string;
  traits: string[];
  marketLink: string;
}

export default function MokiLiveStats({ moki }: { moki: MokiMetadata }) {
  const [leaderboard, setLeaderboard] = useState<
    { date: string; daily_rank: number; daily_score: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'7' | '14' | 'all'>('14');
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile screens for responsive chart features
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        // Fetch daily leaderboard history from Supabase (All dates)
        const { data: lbData, error } = await supabase
          .from('daily_leaderboard')
          .select('date, daily_rank, daily_score')
          .eq('moki_id', moki.id)
          .order('date', { ascending: false }); // Get newest first - removed limit to fetch all

        if (!error && lbData) {
          // Reverse to restore chronological order (left-to-right) for the chart
          setLeaderboard([...lbData].reverse());
        }
      } catch (err) {
        console.error('Failed to fetch live stats', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [moki.id, moki.name]);

  const chartData = (view === 'all'
    ? leaderboard
    : leaderboard.slice(-Number(view))
  ).map((d) => ({
    ...d,
    formatted_date: new Date(
      d.date.replace(/-/g, '/')
    ).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    }),
  }));
  
  const ticks = (() => {
    if (chartData.length === 0) return [];
    if (view === '7') return chartData.map(d => d.formatted_date);
    const t: string[] = [];
    const step = view === '14' ? 3 : 6;
    for (let i = chartData.length - 1; i >= 0; i -= step) {
      t.push(chartData[i].formatted_date);
    }
    return t.reverse();
  })();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        width: '100%',
      }}
    >
      {/* Leaderboard Chart */}
      <div
        style={{
          background: '#ffffff',
          border: '3px solid #333333',
          borderBottomWidth: '6px',
          borderRadius: '1rem',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          marginTop: '1rem',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            color: '#333',
            fontSize: '1.2rem',
            textTransform: 'uppercase',
            textAlign: 'center',
          }}
        >
          Leaderboard Position
        </h3>

        {/* Timeframe Controls */}
        <div
          style={{
            display: 'flex',
            gap: '0.3rem',
            justifyContent: 'center',
            margin: '0.5rem 0',
          }}
        >
          {(['7', '14', 'all'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setView(type)}
              style={{
                padding: '0.3rem 0.6rem',
                borderRadius: '0.5rem',
                border: '2px solid #333',
                background: view === type ? '#FFD753' : '#fff',
                fontWeight: 'bold',
                fontSize: '0.75rem',
                cursor: 'pointer',
                transition: 'all 0.1s ease',
                textTransform: 'uppercase',
              }}
            >
              {type === 'all' ? 'ALL' : `${type}D`}
            </button>
          ))}
        </div>

        {loading ? (
          <p
            style={{
              margin: '1rem 0',
              color: '#666',
              fontSize: '0.9rem',
              fontWeight: 600,
              textAlign: 'center',
            }}
          >
            Syncing data...
          </p>
        ) : leaderboard.length === 0 ? (
          <p
            style={{
              margin: '1rem 0',
              color: '#666',
              fontSize: '0.9rem',
              fontWeight: 600,
              textAlign: 'center',
            }}
          >
            No data available for sync yet.
          </p>
        ) : (
          <div style={{ height: '220px', width: '100%', marginTop: '0.5rem' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 0, left: -32, bottom: 0 }}
                style={{ overflow: 'visible' }}
              >
                <defs>
                  <linearGradient id="colorRank" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FFD753" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#FFD753" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="formatted_date"
                  stroke="#555"
                  tickLine={false}
                  tick={{ textAnchor: 'end', fontSize: 9, fontWeight: 600, fill: '#555' }}
                  interval={0}
                  ticks={ticks}
                />
                <YAxis
                  direction="invert" // Rank 1 should be at the top!
                  stroke="#555"
                  fontSize={10}
                  fontWeight={600}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1C1C1E',
                    border: '2px solid #333',
                    borderRadius: '0.5rem',
                    color: '#fff',
                    fontSize: '0.85rem',
                  }}
                  formatter={
                    ((value: any, name: any) => {
                      const label = String(name || '');
                      if (label === 'daily_rank')
                        return [`Rank #${value}`, 'Position'];
                      if (label === 'daily_score')
                        return [`${value} pts`, 'Score'];
                      return [value, label];
                    }) as any
                  }
                />
                <Area
                  type="monotone"
                  dataKey="daily_rank"
                  stroke="#FFD753"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorRank)"
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Build Lineups Actions */}
      <div
        style={{
          marginTop: '1.5rem',
          padding: '1.5rem',
          backgroundColor: '#ffffff',
          border: '3px solid #333333',
          borderBottomWidth: '6px',
          borderRadius: '1rem',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          alignItems: 'center',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            color: '#FFD753',
            fontSize: '1.5rem',
            textTransform: 'uppercase',
            textShadow:
              '2px 0 #000, -2px 0 #000, 0 2px #000, 0 -2px #000, 1px 1px #000, -1px -1px #000, 1px -1px #000, -1px 1px #000',
          }}
        >
          Build Lineups with {moki.name}
        </h2>
        <p
          style={{
            color: '#555',
            margin: 0,
            fontWeight: 600,
            fontSize: '0.95rem',
          }}
        >
          Simulate the best team compositions and increase your win rate by
          combining {moki.name} with synergistic classes and Scheme cards.
        </p>
        <button
          onClick={() =>
            (window.location.href = `/?mokiSearch=${encodeURIComponent(moki.name)}`)
          }
          className={styles.builderActionBtn}
        >
          OPEN IN THE BUILDER
        </button>
      </div>
    </div>
  );
}
