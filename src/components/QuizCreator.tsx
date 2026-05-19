import { useState } from 'react';
import { Save, Plus, Trash2, ArrowLeft, GripVertical, Image as ImageIcon, Eye, Edit2, Lock, Link2 } from 'lucide-react';
import { type QuizData, type QuizQuestion, type MatchingPair, generateMarkdownQuiz } from '../utils/parser';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { QuizPlayer } from './QuizPlayer';

export function QuizCreator({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  
  const [data, setData] = useState<QuizData>({
    title: 'Новый квиз',
    description: '',
    custom_css: '',
    layout: 'center',
    answer_marker: '*',
    time_limit: 0,
    timer_mode: 'countdown',
    always_multiple_choice: false,
    shuffle_questions: false,
    shuffle_options: false,
    questions: [
      {
        id: Math.random().toString(36).substring(7),
        text: 'Новый вопрос',
        hint: '',
        imageUrl: '',
        options: [
          { text: 'Вариант 1', isCorrect: true, originalText: '*Вариант 1' },
          { text: 'Вариант 2', isCorrect: false, originalText: 'Вариант 2' }
        ]
      }
    ]
  });

  const handleSave = (useInvisibleMarker: boolean = false) => {
    const md = generateMarkdownQuiz(data, useInvisibleMarker);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = useInvisibleMarker 
      ? `${data.title || 'quiz'}_secure.md` 
      : `${data.title || 'quiz'}.md`;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const addQuestion = () => {
    setData({
      ...data,
      questions: [
        ...data.questions,
        {
          id: Math.random().toString(36).substring(7),
          text: 'Новый вопрос',
          options: [{ text: 'Вариант 1', isCorrect: true, originalText: '' }]
        }
      ]
    });
  };

  const updateQuestion = (idx: number, q: Partial<QuizQuestion>) => {
    const newQs = [...data.questions];
    newQs[idx] = { ...newQs[idx], ...q };
    setData({ ...data, questions: newQs });
  };

  const deleteQuestion = (idx: number) => {
    setData({ ...data, questions: data.questions.filter((_, i) => i !== idx) });
  };

  const onDragEnd = (result: any) => {
    if (!result.destination) return;
    const items = Array.from(data.questions);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setData({ ...data, questions: items });
  };

  if (mode === 'preview') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={() => setMode('edit')}>
            <Edit2 size={20} /> Вернуться в редактор
          </button>
        </div>
        <QuizPlayer onBack={() => setMode('edit')} initialMarkdown={generateMarkdownQuiz(data)} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={20} /> В меню
        </button>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={() => setMode('preview')}>
            <Eye size={20} /> Предпросмотр
          </button>
          <button className="btn btn-secondary" onClick={() => handleSave(false)}>
            <Save size={20} /> Скачать обычный .md
          </button>
          <button className="btn" onClick={() => handleSave(true)}>
            <Lock size={20} /> Скачать защищенный .md
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h2 style={{ marginBottom: '1.5rem' }}>Настройки квиза</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Название</label>
            <input 
              type="text" 
              style={{ width: '100%' }} 
              value={data.title} 
              onChange={e => setData({...data, title: e.target.value})} 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Описание</label>
            <input 
              type="text" 
              style={{ width: '100%' }} 
              value={data.description} 
              onChange={e => setData({...data, description: e.target.value})} 
            />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Пользовательский CSS</label>
            <textarea 
              style={{ width: '100%', minHeight: '80px', fontFamily: 'monospace' }} 
              value={data.custom_css} 
              onChange={e => setData({...data, custom_css: e.target.value})}
              placeholder="body { background: red; }"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Выравнивание</label>
            <select 
              style={{ width: '100%' }} 
              value={data.layout || 'center'} 
              onChange={e => setData({...data, layout: e.target.value as any})}
            >
              <option value="left">Слева</option>
              <option value="center">По центру</option>
              <option value="right">Справа</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Маркер ответа</label>
            <input 
              type="text" 
              style={{ width: '100%' }} 
              value={data.answer_marker} 
              onChange={e => setData({...data, answer_marker: e.target.value})} 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Режим таймера</label>
            <select 
              style={{ width: '100%' }} 
              value={data.timer_mode || 'countdown'} 
              onChange={e => setData({...data, timer_mode: e.target.value as any})}
            >
              <option value="countdown">Ограничение времени (Отсчет вниз)</option>
              <option value="stopwatch">Секундомер (Отсчет вверх)</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Лимит времени (сек, 0 - выкл)</label>
            <input 
              type="number" 
              style={{ width: '100%' }} 
              value={data.time_limit || 0} 
              onChange={e => setData({...data, time_limit: parseInt(e.target.value)})} 
              disabled={data.timer_mode === 'stopwatch'}
            />
          </div>
          
          <div style={{ gridColumn: 'span 2', display: 'flex', gap: '2rem', marginTop: '1rem', borderTop: '1px solid var(--surface-border)', paddingTop: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={data.always_multiple_choice} 
                onChange={e => setData({...data, always_multiple_choice: e.target.checked})}
                style={{ width: '18px', height: '18px' }}
              />
              Всегда использовать чекбоксы
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={data.shuffle_questions} 
                onChange={e => setData({...data, shuffle_questions: e.target.checked})}
                style={{ width: '18px', height: '18px' }}
              />
              Случайный порядок вопросов
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={data.shuffle_options} 
                onChange={e => setData({...data, shuffle_options: e.target.checked})}
                style={{ width: '18px', height: '18px' }}
              />
              Случайный порядок ответов
            </label>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2 style={{ paddingLeft: '1rem' }}>Вопросы</h2>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="questions">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {data.questions.map((q, qIdx) => (
                  <Draggable key={q.id} draggableId={q.id} index={qIdx}>
                    {(provided) => (
                      <div 
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className="glass-panel" 
                        style={{ padding: '1.5rem', position: 'relative', display: 'flex', gap: '1rem', ...provided.draggableProps.style }}
                      >
                        <div {...provided.dragHandleProps} style={{ padding: '10px 0', cursor: 'grab', color: 'var(--text-muted)' }}>
                          <GripVertical size={24} />
                        </div>
                        
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', padding: '8px', color: 'var(--error)', borderColor: 'var(--error)' }}
                            onClick={() => deleteQuestion(qIdx)}
                          >
                            <Trash2 size={16} />
                          </button>
                          
                          <div>
                            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Вопрос</label>
                            <input 
                              type="text" 
                              style={{ width: 'calc(100% - 50px)' }} 
                              value={q.text} 
                              onChange={e => updateQuestion(qIdx, { text: e.target.value })} 
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Тип вопроса</label>
                            <select
                              style={{ width: '100%', maxWidth: '250px' }}
                              value={q.type || 'choice'}
                              onChange={e => {
                                const newType = e.target.value as 'choice' | 'matching';
                                if (newType === 'matching') {
                                  updateQuestion(qIdx, {
                                    type: 'matching',
                                    matchingPairs: q.matchingPairs || [
                                      { left: 'Элемент 1', right: 'Ответ 1' },
                                      { left: 'Элемент 2', right: 'Ответ 2' }
                                    ]
                                  });
                                } else {
                                  updateQuestion(qIdx, {
                                    type: 'choice',
                                    options: q.options.length ? q.options : [
                                      { text: 'Вариант 1', isCorrect: true, originalText: '' }
                                    ]
                                  });
                                }
                              }}
                            >
                              <option value="choice">Выбор ответа</option>
                              <option value="matching">Соответствие</option>
                            </select>
                          </div>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Подсказка (опционально)</label>
                              <input 
                                type="text" 
                                style={{ width: '100%' }} 
                                value={q.hint || ''} 
                                onChange={e => updateQuestion(qIdx, { hint: e.target.value })} 
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}><ImageIcon size={14} style={{display: 'inline', verticalAlign: 'middle', marginRight: '4px'}}/> URL Картинки (опционально)</label>
                              <input 
                                type="text" 
                                style={{ width: '100%' }} 
                                value={q.imageUrl || ''} 
                                onChange={e => updateQuestion(qIdx, { imageUrl: e.target.value })} 
                                placeholder="https://example.com/image.png"
                              />
                            </div>
                          </div>

                          {(q.type === 'matching') ? (
                            <div>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', color: 'var(--text-muted)' }}>
                                <Link2 size={14} /> Пары соответствий
                              </label>
                              <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 24px 1fr 40px', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                                <span></span>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 600 }}>Левая часть</span>
                                <span></span>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 600 }}>Правая часть</span>
                                <span></span>
                              </div>
                              {(q.matchingPairs || []).map((pair, pIdx) => (
                                <div key={pIdx} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 24px 1fr 40px', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                                  <span style={{ 
                                    color: 'var(--primary)', 
                                    fontWeight: 'bold', 
                                    fontSize: '0.9rem',
                                    textAlign: 'center',
                                    background: 'rgba(99, 102, 241, 0.15)',
                                    borderRadius: '6px',
                                    padding: '4px 0'
                                  }}>
                                    [{String.fromCharCode(65 + pIdx)}]
                                  </span>
                                  <input 
                                    type="text" 
                                    style={{ width: '100%' }} 
                                    value={pair.left} 
                                    onChange={e => {
                                      const newPairs = [...(q.matchingPairs || [])];
                                      newPairs[pIdx] = { ...pair, left: e.target.value };
                                      updateQuestion(qIdx, { matchingPairs: newPairs });
                                    }}
                                    placeholder="Левый элемент"
                                  />
                                  <span style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '1.1rem' }}>↔</span>
                                  <input 
                                    type="text" 
                                    style={{ width: '100%' }} 
                                    value={pair.right} 
                                    onChange={e => {
                                      const newPairs = [...(q.matchingPairs || [])];
                                      newPairs[pIdx] = { ...pair, right: e.target.value };
                                      updateQuestion(qIdx, { matchingPairs: newPairs });
                                    }}
                                    placeholder="Правый элемент"
                                  />
                                  <button 
                                    className="btn btn-secondary" 
                                    style={{ padding: '6px' }}
                                    onClick={() => {
                                      const newPairs = (q.matchingPairs || []).filter((_, i) => i !== pIdx);
                                      updateQuestion(qIdx, { matchingPairs: newPairs });
                                    }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              ))}
                              <button 
                                className="btn btn-secondary" 
                                style={{ marginTop: '8px', fontSize: '0.9rem', padding: '6px 12px' }}
                                onClick={() => {
                                  const pairCount = (q.matchingPairs || []).length;
                                  const newPairs: MatchingPair[] = [...(q.matchingPairs || []), { left: `Элемент ${pairCount + 1}`, right: `Ответ ${pairCount + 1}` }];
                                  updateQuestion(qIdx, { matchingPairs: newPairs });
                                }}
                              >
                                <Plus size={16} /> Добавить пару
                              </button>
                            </div>
                          ) : (
                            <div>
                              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Варианты ответов</label>
                              {q.options.map((opt, oIdx) => (
                                <div key={oIdx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                                  <input 
                                    type="checkbox" 
                                    checked={opt.isCorrect}
                                    onChange={() => {
                                      const newOpts = [...q.options];
                                      newOpts[oIdx] = { ...opt, isCorrect: !opt.isCorrect };
                                      updateQuestion(qIdx, { options: newOpts });
                                    }}
                                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                  />
                                  <input 
                                    type="text" 
                                    style={{ flex: 1 }} 
                                    value={opt.text} 
                                    onChange={e => {
                                      const newOpts = [...q.options];
                                      newOpts[oIdx] = { ...opt, text: e.target.value };
                                      updateQuestion(qIdx, { options: newOpts });
                                    }} 
                                  />
                                  <button 
                                    className="btn btn-secondary" 
                                    style={{ padding: '8px' }}
                                    onClick={() => {
                                      const newOpts = q.options.filter((_, i) => i !== oIdx);
                                      updateQuestion(qIdx, { options: newOpts });
                                    }}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              ))}
                              <button 
                                className="btn btn-secondary" 
                                style={{ marginTop: '8px', fontSize: '0.9rem', padding: '6px 12px' }}
                                onClick={() => {
                                  const newOpts = [...q.options, { text: `Вариант ${q.options.length + 1}`, isCorrect: false, originalText: '' }];
                                  updateQuestion(qIdx, { options: newOpts });
                                }}
                              >
                                <Plus size={16} /> Добавить вариант
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
        
        <button className="btn" style={{ padding: '1rem', borderStyle: 'dashed', background: 'transparent', borderColor: 'var(--primary)', color: 'var(--primary)' }} onClick={addQuestion}>
          <Plus size={20} /> Добавить вопрос
        </button>
      </div>
    </div>
  );
}
