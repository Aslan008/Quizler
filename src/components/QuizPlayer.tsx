import { useState, useRef, useEffect } from 'react';
import { Upload, Settings, CheckCircle, XCircle, ChevronRight, HelpCircle, Clock, ArrowLeft, GripVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseMarkdownQuiz, type QuizData, type QuizOption } from '../utils/parser';
import { parseDocxQuiz } from '../utils/docx';
import { playSound } from '../utils/audio';
import { saveHistory } from '../utils/history';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

export function QuizPlayer({ onBack, initialMarkdown }: { onBack: () => void, initialMarkdown?: string }) {
  const [step, setStep] = useState<'upload' | 'setup' | 'play' | 'result'>('upload');
  const [rawFile, setRawFile] = useState<string>('');
  const [fileObj, setFileObj] = useState<File | null>(null);
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [savedQuiz, setSavedQuiz] = useState<QuizData | null>(null);
  
  // Setup settings
  const [marker, setMarker] = useState<string>('*');
  const [simpleMode, setSimpleMode] = useState<boolean>(false);
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean>(true);
  const [shuffleOptions, setShuffleOptions] = useState<boolean>(true);

  // Play state
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
  const [showHint, setShowHint] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Scoring & timer
  const [questionResults, setQuestionResults] = useState<{ points: number, maxPoints: number }[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Matching states
  const [activeLeftIdx, setActiveLeftIdx] = useState<number | null>(null);
  const [activeRightIdx, setActiveRightIdx] = useState<number | null>(null);
  const [matches, setMatches] = useState<Record<number, number>>({});

  // Ordering state
  const [orderedOptions, setOrderedOptions] = useState<(QuizOption & { id: string })[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedStr = localStorage.getItem('quizler_saved_quiz');
    if (savedStr) {
      try {
        setSavedQuiz(JSON.parse(savedStr));
      } catch (e) {
        console.error('Failed to parse saved quiz', e);
      }
    }
  }, []);

  useEffect(() => {
    if (initialMarkdown) {
      setRawFile(initialMarkdown);
      const preliminaryData = parseMarkdownQuiz(initialMarkdown, '*');
      if (preliminaryData.answer_marker) {
        setMarker(preliminaryData.answer_marker);
      }
      setStep('setup');
    }
  }, [initialMarkdown]);

  useEffect(() => {
    if (quizData) {
      const q = quizData.questions[currentQuestionIdx];
      if (q && q.type === 'ordering') {
        const mapped = q.options.map((o, idx) => ({
          ...o,
          id: `opt-${idx}`
        }));
        // Shuffle for ordering question
        setOrderedOptions([...mapped].sort(() => Math.random() - 0.5));
      }
    }
  }, [currentQuestionIdx, quizData]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const startQuizDirectly = async (fileToParse: File | null, rawTextToParse: string, currentMarker: string, isSimple: boolean, preLoadedData?: QuizData) => {
    let data: QuizData;
    if (preLoadedData) {
      data = JSON.parse(JSON.stringify(preLoadedData)); // deep clone
    } else if (fileToParse && fileToParse.name.endsWith('.docx')) {
      data = await parseDocxQuiz(fileToParse, currentMarker);
    } else {
      data = parseMarkdownQuiz(rawTextToParse, currentMarker);
    }
    
    // Save to localStorage if it's a newly parsed quiz
    if (!preLoadedData && data && data.questions && data.questions.length > 0) {
      try {
        localStorage.setItem('quizler_saved_quiz', JSON.stringify(data));
        setSavedQuiz(data);
      } catch (e) {
        console.error('Failed to save quiz to localStorage', e);
      }
    }
    
    const shouldShuffleQuestions = isSimple 
      ? (data.shuffle_questions !== undefined ? data.shuffle_questions : true) 
      : shuffleQuestions;
      
    const shouldShuffleOptions = isSimple 
      ? (data.shuffle_options !== undefined ? data.shuffle_options : true) 
      : shuffleOptions;

    if (shouldShuffleQuestions) {
      data.questions = [...data.questions].sort(() => Math.random() - 0.5);
    }

    if (shouldShuffleOptions) {
      data.questions = data.questions.map(q => {
        if (q.type === 'matching' || q.type === 'ordering') return q;
        return {
          ...q,
          options: [...q.options].sort(() => Math.random() - 0.5)
        };
      });
    }

    // Pre-shuffle matching right options
    data.questions = data.questions.map(q => {
      if (q.type === 'matching' && q.matchingPairs) {
        return {
          ...q,
          shuffledRightOptions: [...q.matchingPairs]
            .map(p => p.right)
            .sort(() => Math.random() - 0.5)
        };
      }
      return q;
    });

    setQuizData(data);
    
    if (data.custom_css && !isSimple) {
      const style = document.createElement('style');
      style.id = 'quiz-custom-css';
      style.innerHTML = data.custom_css;
      document.head.appendChild(style);
    }

    setStep('play');
    setCurrentQuestionIdx(0);
    setQuestionResults([]);
    setElapsedTime(0);
    setAnswered(false);
    setSelectedOptions([]);
    setShowHint(false);
    
    // Clear matching selections
    setActiveLeftIdx(null);
    setActiveRightIdx(null);
    setMatches({});

    // Countdown timer for auto-finish (if configured)
    if (!isSimple && data.time_limit && data.timer_mode === 'countdown') {
      setTimeLeft(data.time_limit);
    } else {
      setTimeLeft(null);
    }
  };

  const processFile = async (file: File) => {
    setFileObj(file);
    if (file.name.endsWith('.docx')) {
      const preliminaryData = await parseDocxQuiz(file, '*');
      const activeMarker = preliminaryData.answer_marker || '*';
      setMarker(activeMarker);
      if (simpleMode) {
        startQuizDirectly(file, '', activeMarker, true);
      } else {
        setShuffleQuestions(preliminaryData.shuffle_questions !== undefined ? preliminaryData.shuffle_questions : true);
        setShuffleOptions(preliminaryData.shuffle_options !== undefined ? preliminaryData.shuffle_options : true);
        setStep('setup');
      }
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        setRawFile(text);
        const preliminaryData = parseMarkdownQuiz(text, '*');
        const activeMarker = preliminaryData.answer_marker || '*';
        setMarker(activeMarker);
        if (simpleMode) {
          startQuizDirectly(null, text, activeMarker, true);
        } else {
          setShuffleQuestions(preliminaryData.shuffle_questions !== undefined ? preliminaryData.shuffle_questions : true);
          setShuffleOptions(preliminaryData.shuffle_options !== undefined ? preliminaryData.shuffle_options : true);
          setStep('setup');
        }
      };
      reader.readAsText(file);
    }
  };

  const startQuiz = () => {
    if (!fileObj && !rawFile && quizData) {
      startQuizDirectly(null, '', marker, simpleMode, quizData);
    } else {
      startQuizDirectly(fileObj, rawFile, marker, simpleMode);
    }
  };

  const restartQuiz = () => {
    const savedStr = localStorage.getItem('quizler_saved_quiz');
    let baseData: QuizData | null = null;
    if (savedStr) {
      try {
        baseData = JSON.parse(savedStr);
      } catch (e) {
        console.error(e);
      }
    }
    if (!baseData && quizData) {
      baseData = quizData;
    }
    if (baseData) {
      startQuizDirectly(null, '', marker, simpleMode, baseData);
    }
  };

  const startSavedQuiz = () => {
    if (!savedQuiz) return;
    if (simpleMode) {
      startQuizDirectly(null, '', savedQuiz.answer_marker || '*', true, savedQuiz);
    } else {
      setQuizData(savedQuiz);
      setMarker(savedQuiz.answer_marker || '*');
      setShuffleQuestions(savedQuiz.shuffle_questions !== undefined ? savedQuiz.shuffle_questions : true);
      setShuffleOptions(savedQuiz.shuffle_options !== undefined ? savedQuiz.shuffle_options : true);
      setStep('setup');
    }
  };

  const clearSavedQuiz = (e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.removeItem('quizler_saved_quiz');
    setSavedQuiz(null);
  };

  // Elapsed time counter (always runs during play)
  useEffect(() => {
    let timer: number;
    if (step === 'play') {
      timer = window.setInterval(() => {
        setElapsedTime(t => t + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step]);

  // Countdown auto-finish
  useEffect(() => {
    if (step === 'play' && timeLeft !== null && quizData) {
      if (timeLeft <= 0) {
        finishQuiz();
      } else {
        const t = window.setTimeout(() => setTimeLeft(tl => (tl !== null ? tl - 1 : null)), 1000);
        return () => clearTimeout(t);
      }
    }
  }, [step, timeLeft, quizData]);

  useEffect(() => {
    return () => {
      const style = document.getElementById('quiz-custom-css');
      if (style) style.remove();
    };
  }, []);

  // Scoring logic
  const calcPoints = (q: typeof quizData extends null ? never : NonNullable<typeof quizData>['questions'][0], sel: number[], m: Record<number, number>): { points: number, maxPoints: number } => {
    if (q.type === 'ordering') {
      const total = orderedOptions.length;
      if (total === 0) return { points: 0, maxPoints: 0 };
      let correct = 0;
      orderedOptions.forEach((opt, idx) => {
        if (opt.correctOrder === idx + 1) {
          correct++;
        }
      });
      if (correct === total) return { points: 2, maxPoints: 2 };
      if (correct >= Math.ceil(total * 2 / 3)) return { points: 1, maxPoints: 2 };
      return { points: 0, maxPoints: 2 };
    }
    if (q.type === 'matching') {
      const total = q.matchingPairs?.length || 0;
      if (total === 0) return { points: 0, maxPoints: 0 };
      let correct = 0;
      q.matchingPairs!.forEach((pair, i) => {
        const ri = m[i];
        if (ri !== undefined && q.shuffledRightOptions?.[ri] === pair.right) correct++;
      });
      if (total === 1) return { points: correct, maxPoints: 1 };
      if (correct === total) return { points: 2, maxPoints: 2 };
      if (correct >= Math.ceil(total * 2 / 3)) return { points: 1, maxPoints: 2 };
      return { points: 0, maxPoints: 2 };
    }
    const totalCorrect = q.options.filter(o => o.isCorrect).length;
    if (totalCorrect <= 1) {
      const ok = sel.length === 1 && q.options[sel[0]]?.isCorrect;
      return { points: ok ? 1 : 0, maxPoints: 1 };
    }
    const correctSel = sel.filter(i => q.options[i]?.isCorrect).length;
    const wrongSel = sel.filter(i => !q.options[i]?.isCorrect).length;
    const net = Math.max(0, correctSel - wrongSel);
    if (net === totalCorrect && wrongSel === 0) return { points: 2, maxPoints: 2 };
    if (net >= Math.ceil(totalCorrect * 2 / 3)) return { points: 1, maxPoints: 2 };
    return { points: 0, maxPoints: 2 };
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination || answered) return;
    const items = Array.from(orderedOptions);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setOrderedOptions(items);
  };

  const evaluateOrderingAnswer = () => {
    if (!quizData) return;
    setAnswered(true);
    const q = quizData.questions[currentQuestionIdx];
    const result = calcPoints(q, [], {});
    setQuestionResults(prev => [...prev, result]);
    playSound(result.points > 0 ? 'correct' : 'incorrect');
  };

  const finishQuiz = (qData: QuizData | null = quizData) => {
    playSound('finish');
    setStep('result');
    if (qData) {
      const totalPts = questionResults.reduce((s, r) => s + r.points, 0);
      saveHistory({
        title: qData.title,
        score: totalPts,
        total: qData.questions.length
      });
    }
  };

  const handleOptionClick = (idx: number, _opt: QuizOption, isMultiple: boolean) => {
    if (answered) return;
    
    if (isMultiple) {
      setSelectedOptions(prev => 
        prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
      );
    } else {
      setSelectedOptions([idx]);
      evaluateAnswer([idx], false);
    }
  };

  const evaluateMatchingAnswer = () => {
    if (!quizData) return;
    setAnswered(true);
    const q = quizData.questions[currentQuestionIdx];
    if (!q.matchingPairs || !q.shuffledRightOptions) return;
    
    const result = calcPoints(q, [], matches);
    setQuestionResults(prev => [...prev, result]);
    playSound(result.points > 0 ? 'correct' : 'incorrect');
  };

  const evaluateAnswer = (selected: number[], _isMultiple: boolean) => {
    if (!quizData) return;
    setAnswered(true);
    const q = quizData.questions[currentQuestionIdx];
    
    const result = calcPoints(q, selected, {});
    setQuestionResults(prev => [...prev, result]);
    playSound(result.points > 0 ? 'correct' : 'incorrect');
  };

  const handleNext = () => {
    if (!quizData) return;
    if (currentQuestionIdx < quizData.questions.length - 1) {
      setCurrentQuestionIdx(idx => idx + 1);
      setAnswered(false);
      setSelectedOptions([]);
      setShowHint(false);
      setActiveLeftIdx(null);
      setActiveRightIdx(null);
      setMatches({});
    } else {
      finishQuiz(quizData);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (step === 'upload') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div>
          <button className="btn btn-secondary" onClick={onBack}>
            <ArrowLeft size={20} /> В меню
          </button>
        </div>
        <div 
          className="glass-panel" 
          style={{ 
            padding: '4rem 2rem', 
            textAlign: 'center',
            border: isDragging ? '2px dashed var(--primary)' : '1px solid var(--surface-border)',
            backgroundColor: isDragging ? 'rgba(99, 102, 241, 0.1)' : 'var(--surface)',
            transition: 'all 0.2s ease',
            cursor: 'pointer'
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={48} color={isDragging ? 'var(--primary)' : 'var(--text-muted)'} style={{ marginBottom: '1rem', transition: 'color 0.2s' }} />
          <h2 style={{ marginBottom: '1rem' }}>{isDragging ? 'Бросайте файл!' : 'Загрузите файл квиза (.md, .docx)'}</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
            Перетащите файл в эту область или кликните для выбора.
          </p>
          <input 
            type="file" 
            accept=".md,.txt,.docx" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            onChange={handleFileUpload}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', cursor: 'pointer', userSelect: 'none' }}>
            <input 
              type="checkbox" 
              checked={simpleMode} 
              onChange={e => setSimpleMode(e.target.checked)}
              style={{ width: '18px', height: '18px' }}
            />
            Быстрый запуск (без настроек и кастомных стилей)
          </label>
        </div>

        {savedQuiz && (
          <div 
            className="glass-panel" 
            style={{ 
              padding: '2rem', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: '1rem', 
              border: '1px solid rgba(99, 102, 241, 0.2)',
              marginTop: '1rem' 
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
              <HelpCircle size={20} color="var(--primary)" />
              <span>Ранее загруженный тест в памяти браузера:</span>
            </div>
            <h3 style={{ fontSize: '1.4rem', margin: 0, color: 'var(--text-main)', textAlign: 'center' }}>{savedQuiz.title}</h3>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Количество вопросов: <strong>{savedQuiz.questions.length}</strong></p>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', width: '100%', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button 
                className="btn" 
                onClick={startSavedQuiz}
                style={{ padding: '8px 24px' }}
              >
                Запустить тест
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={clearSavedQuiz}
                style={{ 
                  padding: '8px 24px', 
                  color: 'var(--error)', 
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  backgroundColor: 'rgba(239, 68, 68, 0.05)'
                }}
              >
                Очистить память
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (step === 'setup') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div>
          <button className="btn btn-secondary" onClick={onBack}>
            <ArrowLeft size={20} /> В меню
          </button>
        </div>
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={24} /> Настройка тренировки
          </h2>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>
              Символ правильного ответа (маркер):
            </label>
            <input 
              type="text" 
              value={marker} 
              onChange={e => setMarker(e.target.value)}
              style={{ width: '100%', maxWidth: '300px' }}
              placeholder="Например: *"
            />
          </div>

          <div style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', cursor: 'pointer', userSelect: 'none' }}>
              <input 
                type="checkbox" 
                checked={shuffleQuestions} 
                onChange={e => setShuffleQuestions(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              Перемешать вопросы
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', cursor: 'pointer', userSelect: 'none' }}>
              <input 
                type="checkbox" 
                checked={shuffleOptions} 
                onChange={e => setShuffleOptions(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              Перемешать варианты ответов
            </label>
          </div>

          <button className="btn" onClick={startQuiz}>
            Начать квиз
          </button>
        </div>
      </div>
    );
  }

  if (step === 'play' && quizData) {
    const q = quizData.questions[currentQuestionIdx];
    const layoutAlign = quizData.layout === 'left' ? 'flex-start' : quizData.layout === 'right' ? 'flex-end' : 'center';
    const textAlign = quizData.layout || 'center';
    const isMultipleChoice = quizData.always_multiple_choice || q.options.filter(o => o.isCorrect).length > 1;
    const isMatching = q.type === 'matching';

    const matchColors = [
      { bg: 'rgba(99, 102, 241, 0.15)', border: 'var(--primary)', text: '#818cf8' },
      { bg: 'rgba(168, 85, 247, 0.15)', border: '#a855f7', text: '#c084fc' },
      { bg: 'rgba(236, 72, 153, 0.15)', border: '#ec4899', text: '#f472b6' },
      { bg: 'rgba(249, 115, 22, 0.15)', border: '#f97316', text: '#fb923c' },
      { bg: 'rgba(20, 184, 166, 0.15)', border: '#20b8a6', text: '#2dd4bf' },
      { bg: 'rgba(234, 179, 8, 0.15)', border: '#eab308', text: '#facc15' },
    ];
    
    const allMatched = isMatching && q.matchingPairs && Object.keys(matches).length === q.matchingPairs.length;

    return (
      <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: layoutAlign, textAlign: textAlign, width: '100%', maxWidth: '800px', margin: '0 auto', position: 'relative' }}>
        
        {/* Top Control Bar */}
        <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={onBack} style={{ padding: '8px 16px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ArrowLeft size={16} /> В меню
            </button>
            <button className="btn btn-secondary" onClick={restartQuiz} style={{ padding: '8px 16px', fontSize: '0.9rem' }}>
              Перезапустить
            </button>
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            <Clock size={16} /> {formatTime(elapsedTime)}
          </span>
        </div>

        <div className="progress-bar-container" style={{ marginBottom: '1.5rem' }}>
          <div className="progress-bar-fill" style={{ width: `${((currentQuestionIdx + 1) / quizData.questions.length) * 100}%` }}></div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestionIdx}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: layoutAlign }}
          >
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              <span>Вопрос {currentQuestionIdx + 1} из {quizData.questions.length}</span>
            </div>

        {q.imageUrl && (
          <img src={q.imageUrl} alt="Question graphic" style={{ maxWidth: '100%', borderRadius: '12px', marginBottom: '1.5rem', maxHeight: '400px', objectFit: 'contain' }} />
        )}

        <h2 style={{ fontSize: '2rem', marginBottom: '1.5rem', width: '100%' }}>{q.text}</h2>

        {q.hint && (
          <div style={{ width: '100%', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: layoutAlign }}>
            {!showHint ? (
              <button className="btn btn-secondary" onClick={() => setShowHint(true)} style={{ padding: '6px 12px', fontSize: '0.9rem' }}>
                <HelpCircle size={16} /> Показать подсказку
              </button>
            ) : (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid var(--primary)', width: '100%' }}>
                {q.hint}
              </motion.div>
            )}
          </div>
        )}

        {q.type === 'ordering' ? (
          <>
            {!answered && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                Перетащите элементы в правильном порядке сверху вниз.
              </p>
            )}

            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="ordering-list">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}
                  >
                    {orderedOptions.map((opt, idx) => {
                      let bgColor = 'var(--surface)';
                      let borderColor = 'var(--surface-border)';
                      if (answered) {
                        if (opt.correctOrder === idx + 1) {
                          bgColor = 'rgba(16, 185, 129, 0.2)';
                          borderColor = 'var(--success)';
                        } else {
                          bgColor = 'rgba(239, 68, 68, 0.2)';
                          borderColor = 'var(--error)';
                        }
                      }
                      return (
                        <Draggable key={opt.id} draggableId={opt.id} index={idx} isDragDisabled={answered}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className="option-item"
                              style={{
                                ...provided.draggableProps.style,
                                background: snapshot.isDragging ? 'var(--surface-hover)' : bgColor,
                                border: `1px solid ${borderColor}`,
                                color: 'var(--text-main)',
                                padding: '16px',
                                borderRadius: '12px',
                                fontSize: '1.1rem',
                                cursor: answered ? 'default' : (snapshot.isDragging ? 'grabbing' : 'grab'),
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                userSelect: 'none'
                              }}
                            >
                              <GripVertical size={20} color={answered ? 'var(--text-muted)' : 'var(--primary)'} style={{ flexShrink: 0 }} />
                              <span style={{ flex: 1 }}>{opt.text}</span>
                              {answered && (
                                <span style={{ 
                                  fontSize: '0.85rem', 
                                  background: 'rgba(255,255,255,0.08)', 
                                  padding: '4px 8px', 
                                  borderRadius: '6px', 
                                  color: opt.correctOrder === idx + 1 ? 'var(--success)' : 'var(--error)' 
                                }}>
                                  Позиция: {idx + 1} (Ожидалось: {opt.correctOrder})
                                </span>
                              )}
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            {!answered && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ width: '100%', marginTop: '2rem', display: 'flex', justifyContent: layoutAlign === 'flex-start' ? 'flex-start' : layoutAlign === 'flex-end' ? 'flex-end' : 'center' }}>
                <button className="btn" onClick={evaluateOrderingAnswer}>
                  Ответить
                </button>
              </motion.div>
            )}
          </>
        ) : q.type === 'matching' ? (
          <div style={{ width: '100%' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', textAlign: 'center' }}>
              Установите соответствие: выберите элемент слева, а затем подходящий элемент справа.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', width: '100%', marginBottom: '2rem' }}>
              {/* Left Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--text-muted)', marginBottom: '8px', textAlign: 'center' }}>Группа A</h3>
                {q.matchingPairs?.map((pair, leftIdx) => {
                  const matchedRightIdx = matches[leftIdx];
                  const isSelected = activeLeftIdx === leftIdx;
                  const hasMatch = matchedRightIdx !== undefined;
                  
                  let style: React.CSSProperties = {
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid var(--surface-border)',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--text-main)',
                    cursor: answered ? 'default' : 'pointer',
                    textAlign: 'left',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s ease',
                    width: '100%'
                  };

                  if (isSelected) {
                    style.borderColor = 'var(--primary)';
                    style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.2)';
                  } else if (hasMatch) {
                    const color = matchColors[leftIdx % matchColors.length];
                    style.backgroundColor = color.bg;
                    style.borderColor = color.border;
                  }

                  if (answered) {
                    const isCorrect = hasMatch && q.shuffledRightOptions?.[matchedRightIdx] === pair.right;
                    style.backgroundColor = isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
                    style.borderColor = isCorrect ? 'var(--success)' : 'var(--error)';
                  }

                  return (
                    <div key={leftIdx} style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                      <button
                        disabled={answered}
                        className="matching-btn"
                        onClick={() => {
                          if (activeRightIdx !== null) {
                            setMatches(prev => ({ ...prev, [leftIdx]: activeRightIdx }));
                            setActiveLeftIdx(null);
                            setActiveRightIdx(null);
                            playSound('click');
                          } else {
                            setActiveLeftIdx(isSelected ? null : leftIdx);
                          }
                        }}
                        style={style}
                      >
                        <span style={{ fontSize: '0.95rem' }}>{pair.left}</span>
                        {hasMatch && (
                          <span style={{ 
                            backgroundColor: matchColors[leftIdx % matchColors.length].border, 
                            color: 'white', 
                            borderRadius: '50%', 
                            width: '24px', 
                            height: '24px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            fontSize: '0.8rem',
                            fontWeight: 'bold',
                            flexShrink: 0
                          }}>
                            {leftIdx + 1}
                          </span>
                        )}
                      </button>
                      {answered && q.shuffledRightOptions?.[matchedRightIdx] !== pair.right && (
                        <span style={{ fontSize: '0.85rem', color: 'var(--success)', marginLeft: '8px', marginTop: '2px', textAlign: 'left' }}>
                          Правильно: {pair.right}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Right Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--text-muted)', marginBottom: '8px', textAlign: 'center' }}>Группа B</h3>
                {q.shuffledRightOptions?.map((rightText, rightIdx) => {
                  const leftIdxStr = Object.keys(matches).find(k => matches[parseInt(k)] === rightIdx);
                  const isSelected = activeRightIdx === rightIdx;
                  const hasMatch = leftIdxStr !== undefined;
                  const leftIndexInt = leftIdxStr !== undefined ? parseInt(leftIdxStr) : -1;

                  let style: React.CSSProperties = {
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid var(--surface-border)',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--text-main)',
                    cursor: answered ? 'default' : 'pointer',
                    textAlign: 'left',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s ease',
                    width: '100%'
                  };

                  if (isSelected) {
                    style.borderColor = 'var(--primary)';
                    style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.2)';
                  } else if (hasMatch) {
                    const color = matchColors[leftIndexInt % matchColors.length];
                    style.backgroundColor = color.bg;
                    style.borderColor = color.border;
                  }

                  if (answered && hasMatch) {
                    const isCorrect = q.matchingPairs?.[leftIndexInt].right === rightText;
                    style.backgroundColor = isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
                    style.borderColor = isCorrect ? 'var(--success)' : 'var(--error)';
                  }

                  return (
                    <button
                      key={rightIdx}
                      className="matching-btn"
                      disabled={answered}
                      onClick={() => {
                        if (activeLeftIdx !== null) {
                          setMatches(prev => ({ ...prev, [activeLeftIdx]: rightIdx }));
                          setActiveLeftIdx(null);
                          setActiveRightIdx(null);
                          playSound('click');
                        } else {
                          setActiveRightIdx(isSelected ? null : rightIdx);
                        }
                      }}
                      style={style}
                    >
                      <span style={{ fontSize: '0.95rem' }}>{rightText}</span>
                      {hasMatch && (
                        <span style={{ 
                          backgroundColor: matchColors[leftIndexInt % matchColors.length].border, 
                          color: 'white', 
                          borderRadius: '50%', 
                          width: '24px', 
                          height: '24px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          fontSize: '0.8rem',
                          fontWeight: 'bold',
                          flexShrink: 0
                        }}>
                          {leftIndexInt + 1}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {!answered && Object.keys(matches).length > 0 && (
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
                <button className="btn btn-secondary" onClick={() => setMatches({})}>
                  Сбросить связи
                </button>
                {allMatched && (
                  <button className="btn" onClick={evaluateMatchingAnswer}>
                    Ответить
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            {isMultipleChoice && !answered && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>Выберите один или несколько вариантов ответа.</p>
            )}

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <AnimatePresence>
                {q.options.map((opt, idx) => {
                  let bgColor = 'var(--surface)';
                  let borderColor = 'var(--surface-border)';
                  const isSelected = selectedOptions.includes(idx);
                  
                  if (answered) {
                    if (opt.isCorrect) {
                      bgColor = 'rgba(16, 185, 129, 0.2)'; // success
                      borderColor = 'var(--success)';
                    } else if (isSelected) {
                      bgColor = 'rgba(239, 68, 68, 0.2)'; // error
                      borderColor = 'var(--error)';
                    }
                  } else if (isSelected) {
                    borderColor = 'var(--primary)';
                  }

                  return (
                    <motion.button
                      key={idx}
                      className="option-item"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      disabled={answered}
                      onClick={() => handleOptionClick(idx, opt, isMultipleChoice)}
                      style={{
                        background: bgColor,
                        border: `1px solid ${borderColor}`,
                        color: 'var(--text-main)',
                        padding: '16px',
                        borderRadius: '12px',
                        fontSize: '1.1rem',
                        textAlign: 'left',
                        cursor: answered ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        gap: '12px'
                      }}
                    >
                      {isMultipleChoice && (
                        <div 
                          className={`led-indicator ${isSelected ? 'selected' : ''} ${
                            answered ? (opt.isCorrect ? 'correct' : (isSelected ? 'incorrect' : '')) : ''
                          }`}
                        >
                          <div className="led-dot" />
                        </div>
                      )}
                      <span style={{ flex: 1 }}>{opt.text}</span>
                      {answered && opt.isCorrect && <CheckCircle color="var(--success)" size={20} />}
                      {answered && !opt.isCorrect && isSelected && <XCircle color="var(--error)" size={20} />}
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>

            {isMultipleChoice && !answered && selectedOptions.length > 0 && (
               <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ width: '100%', marginTop: '2rem', display: 'flex', justifyContent: layoutAlign === 'flex-start' ? 'flex-start' : layoutAlign === 'flex-end' ? 'flex-end' : 'center' }}>
                <button className="btn" onClick={() => evaluateAnswer(selectedOptions, true)}>
                  Ответить
                </button>
               </motion.div>
            )}
          </>
        )}

        {answered && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ width: '100%', marginTop: '2rem', display: 'flex', justifyContent: layoutAlign === 'flex-start' ? 'flex-start' : layoutAlign === 'flex-end' ? 'flex-end' : 'center' }}>
            <button className="btn" onClick={handleNext}>
              {currentQuestionIdx < quizData.questions.length - 1 ? 'Следующий вопрос' : 'Завершить'} 
              <ChevronRight size={20} />
            </button>
          </motion.div>
        )}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  if (step === 'result' && quizData) {
    const totalPoints = questionResults.reduce((s, r) => s + r.points, 0);
    const maxPoints = questionResults.reduce((s, r) => s + r.maxPoints, 0);
    const percentage = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0;
    const getGrade = (p: number) => p >= 90 ? 'Отлично' : p >= 70 ? 'Хорошо' : p >= 50 ? 'Удовлетворительно' : 'Неудовлетворительно';
    const gradeColor = (p: number) => p >= 70 ? 'var(--success)' : p >= 50 ? '#f59e0b' : 'var(--error)';
    return (
      <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
        <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Результат</h2>
        <div style={{ fontSize: '4rem', fontWeight: 'bold', color: gradeColor(percentage), marginBottom: '0.5rem' }}>
          {percentage}%
        </div>
        <p style={{ fontSize: '1.5rem', fontWeight: 600, color: gradeColor(percentage), marginBottom: '1.5rem' }}>
          {getGrade(percentage)}
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '1rem 1.5rem', border: '1px solid var(--surface-border)' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{totalPoints} / {maxPoints}</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Баллов</div>
          </div>
          <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '1rem 1.5rem', border: '1px solid var(--surface-border)' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{formatTime(elapsedTime)}</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Время</div>
          </div>
          <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '1rem 1.5rem', border: '1px solid var(--surface-border)' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{quizData.questions.length}</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Вопросов</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn" onClick={restartQuiz}>
            Пройти заново
          </button>
          <button className="btn btn-secondary" onClick={onBack}>
            В главное меню
          </button>
        </div>
      </div>
    );
  }

  return null;
}
