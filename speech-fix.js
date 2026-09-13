/* GOLDENT speech stability patch v2.2-r7
   Runs after app.js and replaces only the microphone behavior.
*/
(() => {
  // Extra tolerance for common Spanish/Android transcription errors.
  if (typeof voiceDigitWords !== 'undefined') {
    voiceDigitWords.unos = '1';
  }

  if (typeof dentalSurfaceAliases !== 'undefined' && Array.isArray(dentalSurfaceAliases.o)) {
    [
      'oclosal',
      'ocluzal',
      'isoclusal',
      'pisoclusal',
      'piscoclusal',
      'psiclusal'
    ].forEach(word => {
      if (!dentalSurfaceAliases.o.includes(word)) dentalSurfaceAliases.o.push(word);
    });
  }

  const micBtn = $('micBtn');
  const micState = $('micState');
  const dictationText = $('dictationText');

  if (!micBtn || !micState || !dictationText) return;

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
    let text = (result?.[0]?.transcript || '').trim();

    // Remove obvious recognition loops such as “pieza pieza pieza”.
    text = text.replace(/\b(\w+)(?:\s+\1\b)+/gi, '$1');

    dictationText.value = text;
    state.dictationParsed = parseDictation(text);
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
    if (micState.textContent === 'Escuchando…') {
      micState.textContent = 'Toca para dictar';
    }
  };

  // This overwrites the previous continuous microphone click handler.
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
})();
