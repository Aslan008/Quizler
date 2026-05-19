import { useState, useEffect } from 'react';
import { ArrowLeft, Trash2, Calendar, Trophy } from 'lucide-react';
import { getHistory, clearHistory, type QuizHistoryRecord } from '../utils/history';
import { motion } from 'framer-motion';

export function HistoryViewer({ onBack }: { onBack: () => void }) {
  const [history, setHistory] = useState<QuizHistoryRecord[]>([]);

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  const handleClear = () => {
    if (confirm('Вы уверены, что хотите очистить всю историю?')) {
      clearHistory();
      setHistory([]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={20} /> В меню
        </button>
        {history.length > 0 && (
          <button className="btn btn-secondary" onClick={handleClear} style={{ color: 'var(--error)', borderColor: 'var(--surface-border)' }}>
            <Trash2 size={20} /> Очистить историю
          </button>
        )}
      </div>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h2 style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Trophy size={28} color="var(--primary)" /> История прохождений
        </h2>

        {history.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
            Вы еще не проходили ни одного квиза.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {history.map((record, i) => (
              <motion.div 
                key={record.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.02)',
                  padding: '1.2rem',
                  borderRadius: '12px',
                  border: '1px solid var(--surface-border)'
                }}
              >
                <div>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>{record.title}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    <Calendar size={14} /> 
                    {new Date(record.date).toLocaleString('ru-RU')}
                  </div>
                </div>
                
                <div style={{ textAlign: 'right' }}>
                  <div style={{ 
                    fontSize: '1.5rem', 
                    fontWeight: 'bold', 
                    color: record.percentage >= 70 ? 'var(--success)' : record.percentage >= 40 ? '#f59e0b' : 'var(--error)' 
                  }}>
                    {record.percentage}%
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {record.score} / {record.total}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
