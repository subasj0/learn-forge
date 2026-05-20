import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc, setDoc, runTransaction } from 'firebase/firestore';

export const DAILY_BUDGET = 0.50; // $0.5
export const MONTHLY_BUDGET = 1.00; // $1.00

export const MODEL_PRICING = {
  'gemini-3.1-pro-preview': { input: 1.25 / 1000000, output: 5.00 / 1000000 },
  'gemini-3-flash-preview': { input: 0.075 / 1000000, output: 0.30 / 1000000 },
  'gemini-2.5-flash': { input: 0.075 / 1000000, output: 0.30 / 1000000 },
  'gemini-2.5-flash-image': { input: 0, output: 0.03 }, // flat $0.03 per image
  'ocr-api': { input: 0, output: 0.01 }, // Flat $0.01 per OCR request
};

export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BudgetExceededError';
  }
}

function getDayString() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

function getMonthString() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
}

export async function checkBudget(userId: string) {
  const usageRef = doc(db, 'users', userId, 'billing', 'usage');
  const snap = await getDoc(usageRef);
  if (!snap.exists()) return;

  const data = snap.data();
  const today = getDayString();
  const thisMonth = getMonthString();

  if (data.lastDailyUpdate === today && data.dailyCost >= DAILY_BUDGET) {
    throw new BudgetExceededError("Daily budget is over, contact subasj0@gmail.com for more.");
  }
  if (data.lastMonthlyUpdate === thisMonth && data.monthlyCost >= MONTHLY_BUDGET) {
    throw new BudgetExceededError("Monthly budget is over, contact subasj0@gmail.com for more.");
  }
}

export async function recordUsage(userId: string, model: keyof typeof MODEL_PRICING, inputTokens: number, outputTokens: number, isImage: boolean = false) {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['gemini-3-flash-preview'];
  let cost = 0;
  if (isImage) {
    cost = pricing.output; // single image cost
  } else if (model === 'ocr-api') {
    cost = pricing.output;
  } else {
    cost = (inputTokens * pricing.input) + (outputTokens * pricing.output);
  }

  // Transactionally update the user's budget
  const usageRef = doc(db, 'users', userId, 'billing', 'usage');
  
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(usageRef);
    const today = getDayString();
    const thisMonth = getMonthString();

    let newDaily = cost;
    let newMonthly = cost;

    if (snap.exists()) {
      const data = snap.data();
      newDaily = (data.lastDailyUpdate === today ? data.dailyCost : 0) + cost;
      newMonthly = (data.lastMonthlyUpdate === thisMonth ? data.monthlyCost : 0) + cost;
    }

    transaction.set(usageRef, {
      dailyCost: newDaily,
      monthlyCost: newMonthly,
      lastDailyUpdate: today,
      lastMonthlyUpdate: thisMonth,
      totalCost: ((snap.exists() ? snap.data().totalCost : 0) || 0) + cost
    }, { merge: true });
  });
}
