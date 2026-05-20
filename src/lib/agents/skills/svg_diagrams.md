---
name: svg-diagrams
description: Standards for drawing dynamic educational diagrams or interactive illustrations using standard SVG and Framer Motion.
---

# Educational Diagrams & Graphics

For visualizing complex processes, networks, or custom illustrations, raw inline `<svg>` is powerful. Keep them clean and minimal.

## 1. Aesthetic Calibration
- **Strokes**: Use consistent widths (e.g., `strokeWidth="1.5"` or `"2"`).
- **Colors**: Use the chapter palette. Neutral lines (`slate-300`), accented nodes (`indigo-500`).
- **Typography**: Use standard fonts even inside SVG for consistency.

```tsx
<div className="w-full max-w-lg mx-auto aspect-[4/3] bg-white rounded-3xl border border-slate-200 overflow-hidden relative group">
  <svg viewBox="0 0 400 300" className="w-full h-full">
     {/* Grid background for technical feel */}
     <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
       <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f1f5f9" strokeWidth="1" />
     </pattern>
     <rect width="100%" height="100%" fill="url(#grid)" />
     
     {/* Content */}
     <motion.circle 
       cx={200} cy={150} r={40} 
       fill="#4f46e5" fillOpacity={0.1}
       stroke="#4f46e5" strokeWidth="2"
       whileHover={{ r: 45, fillOpacity: 0.2 }}
     />
     <text x="200" y="155" textAnchor="middle" className="text-[12px] font-bold fill-indigo-900 pointer-events-none">
       NODE
     </text>
  </svg>
</div>
```

## 2. Interactive Flow Pattern
Use `motion.path` to animate the flow of information between nodes.

```tsx
<motion.path
  d="M 100 150 Q 200 50 300 150"
  fill="none"
  stroke="#94a3b8"
  strokeWidth="2"
  strokeDasharray="0 1"
  animate={{ pathLength: 1, opacity: 1 }}
  initial={{ pathLength: 0, opacity: 0 }}
  transition={{ duration: 2, repeat: Infinity }}
/>
```

## 3. Exploded Views
Use React state to "explode" or transform the diagram when the user interacts or toggles a switch.

```tsx
const [isExploded, setIsExploded] = useState(false);

return (
  <svg viewBox="0 0 200 200">
    <motion.rect 
      animate={{ x: isExploded ? 50 : 0, rotate: isExploded ? 45 : 0 }}
      // ...
    />
  </svg>
);
```
