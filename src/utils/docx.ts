import mammoth from 'mammoth';
import { type QuizData, type QuizQuestion } from './parser';

export async function parseDocxQuiz(file: File, answerMarker: string = '*'): Promise<QuizData> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value;

  const data: QuizData = {
    title: file.name.replace('.docx', ''),
    questions: []
  };

  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  let currentQuestion: QuizQuestion | null = null;
  let matchingLines: string[] = [];
  let isCollectingMatching = false;

  // Regex patterns
  // Вопросы: либо начинаются с длинного текста (предложение с "?"), 
  // либо с "Установите", "Выберите", "Расположите", "Укажите", "Какой", "Какая", "Какие", "Какое", "Какую", "Что", "В каком", "Как", "При", "Пациент"
  const questionStartRegex = /^(Установите|Выберите|Расположите|Укажите|Какой|Какая|Какие|Какое|Какую|Какова|Что |В каком|В какой|В какую|В каких|Как |За счёт|За счет|Какому|Недостаток|При |Пациент|Человеку)/i;
  
  // Варианты ответа: A), B), *C), [A]1), [B]А), etc.
  const optionRegex = /^(\**)(\[([A-Za-zА-Яа-яЁё0-9]+)\])?\s*([A-Za-zА-ЯА-Яа-я][\.\)]\s*)(.*)/;
  // Matching lines: start with [X] followed by number) or letter)
  const matchingLineRegex = /^\[([A-Za-zА-Яа-яЁё0-9]+)\]\s*(\d+\)|[А-Яа-яA-Za-z]\))\s*(.*)/;
  
  // Detect matching question trigger words
  const isMatchingQuestion = (text: string): boolean => {
    const lower = text.toLowerCase();
    return lower.includes('установите соответствие') || 
           lower.includes('соотнесите') ||
           lower.includes('[соответствие]') ||
           lower.includes('[matching]');
  };

  // Header lines to skip in matching questions (column titles)
  const isHeaderLine = (line: string): boolean => {
    // Short lines that describe columns
    return (line.length < 60 && !line.includes(')') && !line.startsWith('*') && !line.startsWith('['));
  };

  const finalizeQuestion = () => {
    if (!currentQuestion) return;
    
    if (isCollectingMatching && matchingLines.length > 0) {
      // Process matching lines
      currentQuestion.type = 'matching';
      currentQuestion.matchingPairs = [];
      
      // Collect all [X]-tagged items
      const taggedItems: { key: string, text: string }[] = [];
      
      matchingLines.forEach(line => {
        const match = line.match(matchingLineRegex);
        if (match) {
          taggedItems.push({
            key: match[1].toUpperCase(),
            text: `${match[2]} ${match[3]}`.trim()
          });
        }
      });
      
      // Separate into left (numbered: 1), 2), 3)...) and right (lettered: А), Б), В)...)
      const leftItems: { key: string, text: string }[] = [];
      const rightItems: { key: string, text: string }[] = [];
      
      taggedItems.forEach(item => {
        // Check if text starts with a digit (left column) or letter (right column)
        if (/^\d+\)/.test(item.text)) {
          leftItems.push(item);
        } else {
          rightItems.push(item);
        }
      });
      
      // Match by key
      leftItems.forEach(left => {
        const right = rightItems.find(r => r.key === left.key);
        if (right) {
          currentQuestion!.matchingPairs!.push({
            left: left.text,
            right: right.text
          });
        }
      });
      
      if (currentQuestion.matchingPairs.length > 0) {
        data.questions.push(currentQuestion);
      }
    } else if (currentQuestion.options.length > 0) {
      data.questions.push(currentQuestion);
    }
    
    currentQuestion = null;
    matchingLines = [];
    isCollectingMatching = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this is a question start
    if (questionStartRegex.test(line) && !line.match(matchingLineRegex)) {
      finalizeQuestion();
      
      currentQuestion = {
        id: Math.random().toString(36).substring(7),
        text: line,
        options: []
      };
      
      if (isMatchingQuestion(line)) {
        isCollectingMatching = true;
      }
      
      continue;
    }
    
    if (!currentQuestion) continue;
    
    // If collecting matching question
    if (isCollectingMatching) {
      const matchLine = line.match(matchingLineRegex);
      if (matchLine) {
        matchingLines.push(line);
        continue;
      }
      // Skip header lines in matching (e.g. "Зоны чувствительности", "Доли коры")
      if (isHeaderLine(line) && matchingLines.length === 0) {
        continue;
      }
      // If we already have matching lines and hit a non-matching line, 
      // this might be the next question
      if (matchingLines.length > 0 && !matchLine) {
        // Check if it's a new question
        if (questionStartRegex.test(line)) {
          finalizeQuestion();
          currentQuestion = {
            id: Math.random().toString(36).substring(7),
            text: line,
            options: []
          };
          if (isMatchingQuestion(line)) {
            isCollectingMatching = true;
          }
          continue;
        }
        // Otherwise skip (could be header line between matching groups)
        if (isHeaderLine(line)) continue;
      }
      continue;
    }
    
    // Try to match as an option line
    const oMatch = line.match(optionRegex);
    if (oMatch) {
      const asterisks = oMatch[1]; // Leading asterisks
      const optText = oMatch[5];
      
      let isCorrect = false;
      
      // Check ZWSP
      if (line.includes('\u200B')) {
        isCorrect = true;
      }
      // Check asterisk marker
      else if (asterisks.length > 0) {
        isCorrect = true;
      }
      
      currentQuestion.options.push({
        text: optText,
        isCorrect,
        originalText: line
      });
      continue;
    }
    
    // Check for lines starting with marker followed by letter option
    if (line.startsWith(answerMarker) && answerMarker !== '*') {
      let cleanLine = line.substring(answerMarker.length).trim();
      const letterMatch = cleanLine.match(/^([a-zA-Zа-яА-Я][.\)]\s*)(.*)/);
      if (letterMatch) {
        currentQuestion.options.push({
          text: letterMatch[2],
          isCorrect: true,
          originalText: line
        });
        continue;
      }
    }
    
    // If no options yet, this might be a continuation of the question text
    if (currentQuestion.options.length === 0 && matchingLines.length === 0) {
      // Check if it's a hint
      if (line.toLowerCase().startsWith('подсказка:')) {
        currentQuestion.hint = line.substring(10).trim();
      } else {
        // Continuation of question text
        currentQuestion.text += ' ' + line;
      }
    }
  }

  finalizeQuestion();

  return data;
}
