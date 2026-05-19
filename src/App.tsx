import { useState } from 'react';
import { Play, PenTool } from 'lucide-react';
import { motion } from 'framer-motion';
import { QuizPlayer } from './components/QuizPlayer';
import { QuizCreator } from './components/QuizCreator';
import { HistoryViewer } from './components/HistoryViewer';

function App() {
  const [view, setView] = useState<'menu' | 'play' | 'create' | 'history'>('menu');

  return (
    <div className="app-container" style={{ minHeight: '100vh', padding: '2rem', position: 'relative' }}>
      <div className="bg-blobs-container">
        <div className="bg-blob bg-blob-1"></div>
        <div className="bg-blob bg-blob-2"></div>
        <div className="bg-blob bg-blob-3"></div>
      </div>
      {view === 'menu' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel" 
          style={{ maxWidth: '600px', margin: '10vh auto', padding: '3rem', textAlign: 'center' }}
        >
          <h1 className="text-gradient" style={{ fontSize: '3rem', marginBottom: '1rem' }}>Quizler</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '3rem', fontSize: '1.2rem' }}>
            Инструмент для создания и прохождения квизов на основе Markdown.
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button className="btn" onClick={() => setView('play')} style={{ padding: '1rem' }}>
              <Play size={24} />
              Пройти квиз / Тренировка
            </button>
            <button className="btn btn-secondary" onClick={() => setView('create')} style={{ padding: '1rem' }}>
              <PenTool size={24} />
              Создать квиз
            </button>
            <button className="btn btn-secondary" onClick={() => setView('history')} style={{ padding: '1rem' }}>
              История прохождений
            </button>
          </div>
        </motion.div>
      )}

      {view === 'history' && (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <HistoryViewer onBack={() => setView('menu')} />
        </div>
      )}

      {view === 'play' && (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <QuizPlayer onBack={() => setView('menu')} />
        </div>
      )}

      {view === 'create' && (
        <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '4rem' }}>
          <QuizCreator onBack={() => setView('menu')} />
        </div>
      )}
    </div>
  );
}

export default App;
