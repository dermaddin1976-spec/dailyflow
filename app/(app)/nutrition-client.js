'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import MealLogger from './meal-logger.js';
import NutritionDayPicker from './nutrition-day.js';
import NutritionAsk from './nutrition-ask.js';

// Meal data lives in one place here, shared by the day picker (browse, edit,
// delete) and the logging form below it. Logging a meal, editing one, or
// deleting one all funnel through this same refresh, so the list is never
// fetched — or shown — twice.
export default function NutritionClient() {
  const router = useRouter();
  const [items, setItems] = useState(null); // null = still loading

  const refresh = useCallback(() => {
    fetch('/api/logs/meal').then(r => r.json()).then(d => setItems(d.logs || [])).catch(() => setItems([]));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  async function saveMeal(id, fields) {
    await fetch(`/api/logs/meal/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: fields.description,
        calories: parseInt(fields.calories, 10) || null,
        protein: parseInt(fields.protein, 10) || null,
        carbs: parseInt(fields.carbs, 10) || null,
        fat: parseInt(fields.fat, 10) || null,
      }),
    });
    refresh();
    router.refresh();
  }

  async function deleteMeal(id) {
    await fetch(`/api/logs/meal/${id}`, { method: 'DELETE' });
    refresh();
    router.refresh();
  }

  return (
    <>
      <NutritionDayPicker items={items} onSave={saveMeal} onDelete={deleteMeal} />
      <MealLogger onLogged={refresh} />
      <NutritionAsk />
    </>
  );
}
