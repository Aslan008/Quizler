export interface QuizOption {
  text: string;
  isCorrect: boolean;
  originalText: string;
}

export interface MatchingPair {
  left: string;
  right: string;
}

export interface QuizQuestion {
  id: string;
  text: string;
  hint?: string;
  imageUrl?: string;
  type?: 'choice' | 'matching';
  options: QuizOption[];
  matchingPairs?: MatchingPair[];
  shuffledRightOptions?: string[];
}

export interface QuizData {
  title: string;
  description?: string;
  custom_css?: string;
  answer_marker?: string;
  layout?: 'center' | 'left' | 'right';
  time_limit?: number; // in seconds
  timer_mode?: 'countdown' | 'stopwatch';
  always_multiple_choice?: boolean;
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
  questions: QuizQuestion[];
}

export function parseMarkdownQuiz(markdown: string, overrideAnswerMarker?: string): QuizData {
  const data: QuizData = {
    title: 'Untitled Quiz',
    questions: [],
  };

  const lines = markdown.split('\n');
  let frontmatterLines: string[] = [];
  let currentQuestion: QuizQuestion | null = null;
  let questionRawLines: string[] = [];
  
  let i = 0;
  
  // 1. Parse Frontmatter
  if (lines[0].trim() === '---') {
    i++;
    while (i < lines.length && lines[i].trim() !== '---') {
      frontmatterLines.push(lines[i]);
      i++;
    }
    i++; // skip closing '---'
    
    // Simple YAML-like parser for frontmatter
    frontmatterLines.forEach(line => {
      const match = line.match(/^([a-z_]+):\s*(.*)$/i);
      if (match) {
        const key = match[1].toLowerCase();
        let value = match[2].trim();
        // remove surrounding quotes
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        if (key === 'title') data.title = value;
        if (key === 'description') data.description = value;
        if (key === 'custom_css') data.custom_css = value;
        if (key === 'layout') data.layout = value as any;
        if (key === 'time_limit') data.time_limit = parseInt(value, 10);
        if (key === 'timer_mode') data.timer_mode = value as any;
        if (key === 'always_multiple_choice') data.always_multiple_choice = value === 'true';
        if (key === 'shuffle_questions') data.shuffle_questions = value === 'true';
        if (key === 'shuffle_options') data.shuffle_options = value === 'true';
      }
    });
  }

  // Determine answer marker
  const marker = overrideAnswerMarker || data.answer_marker || '*';

  const finalizeQuestion = (q: QuizQuestion, raw: string[]) => {
    parseQuestionLines(q, raw, marker);
    data.questions.push(q);
  };

  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Header = Question
    if (line.startsWith('#')) {
      if (currentQuestion) {
        finalizeQuestion(currentQuestion, questionRawLines);
      }
      currentQuestion = {
        id: Math.random().toString(36).substring(7),
        text: line, // Pass raw line to parseQuestionLines to clean tag
        options: []
      };
      questionRawLines = [];
    } 
    // Blockquote = Hint
    else if (line.startsWith('>') && currentQuestion) {
      currentQuestion.hint = line.substring(1).trim();
    }
    // Image
    else if (line.startsWith('![') && line.includes('](') && line.endsWith(')') && currentQuestion) {
      const match = line.match(/^!\[.*?\]\((.*?)\)$/);
      if (match) {
        currentQuestion.imageUrl = match[1];
      }
    }
    // Collect raw lines under the question
    else if (currentQuestion) {
      questionRawLines.push(line);
    }
  }

  if (currentQuestion) {
    finalizeQuestion(currentQuestion, questionRawLines);
  }

  return data;
}

function getPairKey(text: string): { cleanText: string, key: string } {
  let str = text.trim();
  if (/^[-•]\s+/.test(str)) {
    str = str.replace(/^[-•]\s+/, '');
  }
  
  // 1. Check for [X] bracket keys: [A], [Б], [1], etc.
  const bracketMatch = str.match(/^\[([A-Za-zА-Яа-яЁё0-9]+)\]\s*/);
  if (bracketMatch) {
    return {
      cleanText: str.replace(/^\[[A-Za-zА-Яа-яЁё0-9]+\]\s*/, '').trim(),
      key: bracketMatch[1].toUpperCase()
    };
  }
  
  // 2. Count zero-width spaces anywhere
  const zwspCount = (str.match(/\u200B/g) || []).length;
  if (zwspCount > 0) {
    return {
      cleanText: str.replace(/\u200B/g, '').trim(),
      key: `z${zwspCount}`
    };
  }
  
  // 3. Count leading asterisks (backward compat)
  // Strip list marker '- ' first if present for asterisk detection
  let strForAsterisks = str;
  if (/^[-]\s+/.test(strForAsterisks)) {
    strForAsterisks = strForAsterisks.replace(/^[-]\s+/, '');
  }
  const asteriskMatch = strForAsterisks.match(/^\*+/);
  if (asteriskMatch) {
    return {
      cleanText: strForAsterisks.replace(/^\*+/, '').trim(),
      key: `s${asteriskMatch[0].length}`
    };
  }
  
  return {
    cleanText: str,
    key: ''
  };
}

function parseQuestionLines(question: QuizQuestion, rawLines: string[], marker: string) {
  // 1. Clean question title and detect if matching
  const originalTitle = question.text;
  const titleLower = originalTitle.toLowerCase();
  const hasMatchingTag = titleLower.includes('[соответствие]') || 
                         titleLower.includes('[matching]') || 
                         titleLower.includes('[соотношение]');
  
  let hasArrow = false;
  let hasColumns = false;
  let hasBracketKeys = false;
  
  rawLines.forEach(line => {
    if (line.includes('->') || line.includes('=>')) {
      hasArrow = true;
    }
    if (/\[[A-Za-zА-Яа-яЁё0-9]+\]/.test(line)) {
      hasBracketKeys = true;
    }
    const cols = line.split(/\t|\s{3,}/);
    if (cols.length >= 2) {
      hasColumns = true;
    }
  });

  const isMatching = hasMatchingTag || hasArrow || (hasColumns && (hasBracketKeys || rawLines.some(line => line.includes('*') || line.includes('\u200B'))));

  if (isMatching) {
    question.type = 'matching';
    question.text = originalTitle
      .replace(/^#+\s*/, '')
      .replace(/\[(соответствие|matching|соотношение)\]/gi, '')
      .trim();
    
    question.matchingPairs = [];
    
    const leftList: { text: string, key: string }[] = [];
    const rightList: { text: string, key: string }[] = [];
    const directPairs: MatchingPair[] = [];
    let hasKeys = false;

    rawLines.forEach(line => {
      // Check arrow format
      if (line.includes('->') || line.includes('=>')) {
        const cleanLine = /^[-*•]\s+/.test(line.trim()) ? line.trim().replace(/^[-*•]\s+/, '') : line.trim();
        const parts = cleanLine.split(/\s*->\s*|\s*=>\s*/);
        if (parts.length >= 2) {
          directPairs.push({
            left: parts[0].trim(),
            right: parts[1].trim()
          });
        }
      } else {
        const cols = line.split(/\t|\s{2,}/);
        if (cols.length >= 2) {
          const leftRes = getPairKey(cols[0]);
          const rightRes = getPairKey(cols[1]);
          
          if (leftRes.key || rightRes.key) {
            hasKeys = true;
          }
          
          leftList.push({ text: leftRes.cleanText, key: leftRes.key });
          rightList.push({ text: rightRes.cleanText, key: rightRes.key });
        }
      }
    });

    if (directPairs.length > 0) {
      question.matchingPairs = directPairs;
    } else {
      if (hasKeys) {
        leftList.forEach(l => {
          if (l.key) {
            const r = rightList.find(ri => ri.key === l.key);
            if (r) {
              question.matchingPairs!.push({
                left: l.text,
                right: r.text
              });
            }
          }
        });
      } else {
        // Direct rows without keys (e.g. no asterisks but two columns per row)
        // Skip header if it is present
        let startIndex = 0;
        if (leftList.length > 1 && 
            (leftList[0].text.toLowerCase().includes('структура') || 
             leftList[0].text.toLowerCase().includes('группа') ||
             leftList[0].text.toLowerCase().includes('столбец') ||
             leftList[0].text.toLowerCase().includes('лево') ||
             leftList[0].text.toLowerCase().includes('название'))) {
          startIndex = 1;
        }
        
        for (let idx = startIndex; idx < leftList.length; idx++) {
          const l = leftList[idx];
          const r = rightList[idx];
          if (r) {
            question.matchingPairs!.push({
              left: l.text,
              right: r.text
            });
          }
        }
      }
    }
  } else {
    // Normal Choice Question
    question.type = 'choice';
    question.text = originalTitle.replace(/^#+\s*/, '').trim();
    question.options = [];
    rawLines.forEach(line => {
      let optionText = /^[-*•]\s+/.test(line.trim()) ? line.trim().replace(/^[-*•]\s+/, '') : line.trim();
      let isCorrect = false;
      
      // ZWSP
      if (optionText.includes('\u200B')) {
        isCorrect = true;
        optionText = optionText.replace(/\u200B/g, '');
      }
      
      // Marker
      if (optionText.startsWith(marker)) {
        isCorrect = true;
        optionText = optionText.substring(marker.length).trim();
      }

      question.options.push({
        text: optionText,
        isCorrect,
        originalText: line.trim()
      });
    });
  }
}

export function generateMarkdownQuiz(data: QuizData, useInvisibleMarker: boolean = false): string {
  let md = '---\n';
  md += `title: "${data.title}"\n`;
  if (data.description) md += `description: "${data.description}"\n`;
  if (data.custom_css) md += `custom_css: "${data.custom_css.replace(/"/g, '\\"')}"\n`;
  if (data.answer_marker) md += `answer_marker: "${data.answer_marker}"\n`;
  if (data.time_limit !== undefined) md += `time_limit: ${data.time_limit}\n`;
  if (data.timer_mode) md += `timer_mode: "${data.timer_mode}"\n`;
  if (data.always_multiple_choice !== undefined) md += `always_multiple_choice: ${data.always_multiple_choice}\n`;
  if (data.shuffle_questions !== undefined) md += `shuffle_questions: ${data.shuffle_questions}\n`;
  if (data.shuffle_options !== undefined) md += `shuffle_options: ${data.shuffle_options}\n`;
  md += '---\n\n';

  data.questions.forEach((q) => {
    // Add [соответствие] tag to the header if it's matching
    const headerPrefix = q.type === 'matching' ? '[Соответствие] ' : '';
    md += `# ${headerPrefix}${q.text}\n`;
    if (q.hint) {
      md += `> ${q.hint}\n`;
    }
    if (q.imageUrl) {
      md += `![](${q.imageUrl})\n`;
    }
    if (q.type === 'matching' && q.matchingPairs) {
      if (useInvisibleMarker) {
        const lefts = q.matchingPairs.map((pair, idx) => ({
          text: pair.left,
          key: '\u200B'.repeat(idx + 1)
        }));
        const rights = q.matchingPairs.map((pair, idx) => ({
          text: pair.right,
          key: '\u200B'.repeat(idx + 1)
        }));
        const shuffledRights = [...rights].sort(() => Math.random() - 0.5);
        
        lefts.forEach((l, idx) => {
          const r = shuffledRights[idx];
          md += `${l.text}${l.key}\t${r.text}${r.key}\n`;
        });
      } else {
        // Use [A]/[B]/... tag format with shuffled right column
        const keys = q.matchingPairs.map((_, idx) => String.fromCharCode(65 + (idx % 26)));
        const shuffledRightPairs = q.matchingPairs
          .map((pair, idx) => ({ text: pair.right, key: keys[idx] }))
          .sort(() => Math.random() - 0.5);
        
        q.matchingPairs.forEach((pair, idx) => {
          const rightEntry = shuffledRightPairs[idx];
          md += `[${keys[idx]}] ${pair.left}\t[${rightEntry.key}] ${rightEntry.text}\n`;
        });
      }
    } else {
      q.options.forEach(opt => {
        if (useInvisibleMarker) {
          const marker = opt.isCorrect ? '\u200B' : '';
          md += `- ${opt.text}${marker}\n`;
        } else {
          const marker = opt.isCorrect ? (data.answer_marker || '*') : '';
          md += `- ${marker}${opt.text}\n`;
        }
      });
    }
    md += '\n';
  });

  return md.trim();
}
