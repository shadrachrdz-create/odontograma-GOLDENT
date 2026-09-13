/* GOLDENT voice layer v2.2-r8
   Stable one-shot recognition + dental cleanup + local adaptive corrections.
   Loaded after app.js by the service worker.
*/
(() => {
  const STORAGE_KEY = 'goldent-voice-corrections-v1';
  const micBtn = $('micBtn');
  const micState = $('micState');
  const dictationText = $('dictationText');
  const parseBtn = $('parseDictationBtn');

  if (!micBtn || !micState || !dictationText || !parseBtn) return;

  // Expand the parser tolerance for frequent Android/Spanish transcription variants.
  if (typeof voiceDigitWords !== 'undefined') {
    voiceDigitWords.unos = '1';
  }

  if (typeof dentalConditionAliases !== 'undefined') {
    const caries = dentalConditionAliases.find(x => x.condition === 'caries');
    if (caries) {
      ['carie','cari','carries','caries dental'].forEach(word => {
        if (!caries.aliases.includes(word)) caries.aliases.push(word);
      });
    }
  }

  if (typeof dentalSurfaceAliases !== 'undefined' && Array.isArray(dentalSurfaceAliases.o)) {
    [
      'oclosal','ocluzal','ocluzar','oclusar','oclusai','oclusai',
      'isoclusal','pisoclusal','piscoclusal','psiclusal','oclusal dental'
    ].forEach(word => {
      if (!dentalSurfaceAliases.o.includes(word)) dentalSurfaceAliases.o.push(word);
    });
  }

  function loadCorrections(){
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  function saveCorrections(map){
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch {}
  }

  function escapeRegExp(value=''){
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function applyLearnedCorrections(text=''){
    let result = String(text);
    const corrections = loadCorrections();
    Object.entries(corrections)
      .sort((a,b) => b[0].length - a[0].length)
      .forEach(([wrong,right]) => {
        if (!wrong || !right) return;
        const re = new RegExp(`\\b${escapeRegExp(wrong)}\\b`, 'gi');
        result = result.replace(re, right);
      });
    return result;
  }

  function cleanTranscript(text=''){
    let t = String(text)
      .replace(/[\n\r]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Collapse immediate word loops: “pieza pieza pieza” -> “pieza”.
    for (let i=0; i<4; i++) {
      const previous = t;
      t = t.replace(/\b([a-záéíóúüñ]+)(?:\s+\1\b)+/gi, '$1');
      if (t === previous) break;
    }

    // If Android repeats the same FDI command several times, keep the final one.
    // Example: “pieza 16 pieza 16 pieza 16 carie oclusal” -> “pieza 16 carie oclusal”.
    const re = /\b(?:pieza|diente)\s*(\d{2})\b/gi;
    const hits = [...t.matchAll(re)];
    if (hits.length > 1) {
      const numbers = hits.map(x => x[1]);
      const sameTooth = numbers.every(n => n === numbers[0]);
      if (sameTooth) {
        const last = hits[hits.length - 1];
        t = t.slice(last.index).trim();
      }
    }

    // Common clinically safe transcription normalizations.
    t = t
      .replace(/\bcarie\b/gi, 'caries')
      .replace(/\bcari\b/gi, 'caries')
      .replace(/\b(oclosal|ocluzal|pisoclusal|piscoclusal|psiclusal|isoclusal)\b/gi, 'oclusal');

    return applyLearnedCorrections(t);
  }

  function maybeLearnFromEdit(originalText, editedText){
    const a = normalize(cleanTranscript(originalText)).split(/\s+/).filter(Boolean);
    const b = normalize(editedText).split(/\s+/).filter(Boolean);
    if (!a.length || a.length !== b.length) return;

    const differences = [];
    for (let i=0; i<a.length; i++) {
      if (a[i] !== b[i]) differences.push([a[i],b[i]]);
    }

    // Conservative learning: only small manual corrections, never structural words/numbers.
    if (!differences.length || differences.length > 2) return;
    const blocked = new Set(['pieza','diente','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve']);
    const map = loadCorrections();
    let changed = false;

    differences.forEach(([wrong,right]) => {
      if (wrong.length < 3 || right.length < 3) return;
      if (blocked.has(wrong) || blocked.has(right)) return;
      if (/^\d+$/.test(wrong) || /^\d+$/.test(right)) return;
      map[wrong] = right;
      changed = true;
    });

    if (changed) saveCorrections(map);
  }

  // Wrap the existing parser so learned/common corrections also work when the user types manually.
  const originalParseDictation = parseDictation;
  parseDictation = function(text){
    return originalParseDictation(cleanTranscript(text));
  };

  let lastRawSpeech = '';

  // Rebind Interpretar so a manual correction can teach the local dictionary.
  parseBtn.onclick = () => {
    const edited = dictationText.value.trim();
    if (lastRawSpeech && edited && normalize(cleanTranscript(lastRawSpeech)) !== normalize(edited)) {
      maybeLearnFromEdit(lastRawSpeech, edited);
    }
    const cleaned = cleanTranscript(edited);
    dictationText.value = cleaned;
    state.dictationParsed = parseDictation(cleaned);
    renderDictationPreview();
  };

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    micState.textContent = 'Usa el dictado del teclado';
    micBtn.onclick = () => {
      dictationText.focus();
      toast('En este navegador usa el micrófono del teclado.');
    };
    return;
  }

  const rec = new SR();
  rec.lang = 'es-MX';
  rec.continuous = false;
  rec.interimResults = false;
  rec.maxAlternatives = 1;

  let listening = false;

  rec.onstart = () => {
    listening = true;
    micBtn.classList.add('listening');
    micState.textContent = 'Escuchando…';
  };

  rec.onresult = event => {
    const result = event.results[event.results.length - 1];
    const raw = (result?.[0]?.transcript || '').trim();
    lastRawSpeech = raw;

    const cleaned = cleanTranscript(raw);
    dictationText.value = cleaned;
    state.dictationParsed = parseDictation(cleaned);
    renderDictationPreview();
    micState.textContent = 'Texto reconocido';
  };

  rec.onerror = event => {
    listening = false;
    micBtn.classList.remove('listening');

    if (event.error === 'no-speech') {
      micState.textContent = 'No detecté voz · intenta otra vez';
      return;
    }
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      micState.textContent = 'Permite el acceso al micrófono';
      toast('Debes permitir el micrófono en Chrome.');
      return;
    }
    if (event.error === 'audio-capture') {
      micState.textContent = 'No encuentro el micrófono';
      return;
    }
    if (event.error !== 'aborted') toast(`Dictado: ${event.error}`);
  };

  rec.onend = () => {
    listening = false;
    micBtn.classList.remove('listening');
    if (micState.textContent === 'Escuchando…') micState.textContent = 'Toca para dictar';
  };

  // Critical fix: one tap = one utterance. No automatic restart and no interim concatenation.
  micBtn.onclick = () => {
    if (listening) {
      try { rec.stop(); } catch {}
      return;
    }
    try {
      rec.start();
    } catch {
      toast('Espera un momento e intenta nuevamente.');
    }
  };

  // Small public helper for future debugging without changing the UI.
  window.GOLDENTVoice = {
    clean: cleanTranscript,
    corrections: () => ({...loadCorrections()}),
    learn: (wrong,right) => {
      const map = loadCorrections();
      map[normalize(wrong)] = normalize(right);
      saveCorrections(map);
    },
    resetLearning: () => {
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
    }
  };
})();
