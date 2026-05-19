export interface QuizHistoryRecord {
  id: string;
  title: string;
  score: number;
  total: number;
  percentage: number;
  date: string;
}

const STORAGE_KEY = 'quizler_history';

export function getHistory(): QuizHistoryRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load history', e);
  }
  return [];
}

export function saveHistory(record: Omit<QuizHistoryRecord, 'id' | 'date' | 'percentage'>) {
  const history = getHistory();
  const newRecord: QuizHistoryRecord = {
    ...record,
    id: Math.random().toString(36).substring(7),
    percentage: Math.round((record.score / record.total) * 100),
    date: new Date().toISOString()
  };
  
  history.unshift(newRecord);
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (e) {
    console.error('Failed to save history', e);
  }
}

export function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
}
