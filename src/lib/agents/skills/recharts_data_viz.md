---
name: recharts-data-viz
description: Standards for creating high-clarity, beautiful charts for educational interactive chapters.
---

# Educational Data Visualizations

In interactive learning, charts are tools for exploration. They should be clean, responsive, and tied to interactive controls.

## 1. Minimalist Aesthetic
Avoid clutter. Focus on the data.
- **Colors**: Use `indigo-600` (#4f46e5) for primary data, `rose-500` (#f43f5e) for critical thresholds, and `slate-400` (#94a3b8) for axes.
- **Grid**: Use `CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9"`.
- **Tooltip**: Custom style Tooltips to look like mini-cards.

```tsx
<Tooltip 
  contentStyle={{ 
    backgroundColor: '#fff', 
    border: '1px solid #e2e8f0', 
    borderRadius: '12px', 
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' 
  }}
  itemStyle={{ color: '#1e293b', fontWeight: 600, fontSize: '14px' }}
/>
```

## 2. Dynamic Simulation Pattern
Tie the chart `data` prop to a state variable (e.g., from a slider) to show "cause and effect".

```tsx
const [growthRate, setGrowthRate] = useState(1.05);

const data = useMemo(() => {
  return Array.from({ length: 12 }).map((_, i) => ({
    month: i + 1,
    value: Math.pow(growthRate, i) * 100
  }));
}, [growthRate]);

return (
  <ResponsiveContainer width="100%" height={300}>
    <AreaChart data={data}>
      <defs>
        <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
        </linearGradient>
      </defs>
      <XAxis dataKey="month" hide />
      <YAxis hide />
      <Tooltip cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }} />
      <Area type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" />
    </AreaChart>
  </ResponsiveContainer>
);
```

## 3. Guiding the View
Use `ReferenceLine` to highlight significant learning points (e.g., target thresholds).

```tsx
<ReferenceLine y={500} label="Target Goal" stroke="#10b981" strokeDasharray="3 3" />
```
