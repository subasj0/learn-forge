---
name: motion-animations
description: Standards for adding meaningful animations and gesture interactions using motion/react. Focused on educational feedback and polished transitions.
---

# Motion Animations for Learning

Animations should never be a distraction. In an educational context, use motion to **direct attention**, **provide feedback**, and **clarify relationships**.

## 1. Sophisticated Entrance (Staggered)
When a new section or chapter loads, use staggered fades to create a "reveal" effect that feels intentional and premium.

```tsx
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }
};

return (
  <motion.div variants={container} initial="hidden" animate="show" className="space-y-12">
    <motion.h1 variants={item} className="...">The Topic</motion.h1>
    <motion.div variants={item} className="...">Section Content</motion.div>
  </motion.div>
);
```

## 2. Interactive Feedback
Provide tactile feedback when the user interacts with educational widgets.

```tsx
<motion.button
  whileHover={{ scale: 1.01 }}
  whileTap={{ scale: 0.98 }}
  className="..."
>
  Compare Results
</motion.button>
```

## 3. The "Success Reveal"
When a user finishes a task or gets a quiz right, use a satisfying reveal animation.

```tsx
<AnimatePresence>
  {isCorrect && (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-6 rounded-3xl"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <p className="font-bold">Brilliant! You've grasped the core concept.</p>
      </div>
    </motion.div>
  )}
</AnimatePresence>
```

## 4. Property Interpolation
Animate numerical values directly to show transitions between states (e.g., mass changing in a gravity simulator).

```tsx
<motion.div 
  animate={{ 
    scale: currentMass / baseMass,
    backgroundColor: currentMass > threshold ? "#4f46e5" : "#64748b" 
  }}
  className="w-16 h-16 rounded-full"
/>
```
