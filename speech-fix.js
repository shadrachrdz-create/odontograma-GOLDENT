/* GOLDENT voice + caries severity layer v2.2-r9
   Stable one-shot recognition + dental cleanup + local adaptive corrections
   + caries severity (incipient/extensive) in manual and voice workflows.
   Loaded after app.js by the service worker.
*/
(() => {
  const STORAGE_KEY = 'goldent-voice-corrections-v1';
  const micBtn = $('micBtn');
  const micState = $('micState');
  const dictationText = $('dictationText');
  const parseBtn = $('parseDictationBtn');

  if (!micBtn || !micState || !dictationText || !parseBtn) return;

  const cariesSeverityDefs = {
    '': { label: 'Sin especificar', color: conditionDefs.caries.color },
    incipient: { label: 'Caries incipiente', color: '#ef9a94' },
    extensive: { label: 'Caries extensa', color: '#9f2723' }
  };

  if (!('cariesSeverity' in state)) state.cariesSeverity = '';

  if (typeof voiceDigitWords !== 'undefined') voiceDigitWords.unos = '1';

  if (typeof dentalConditionAliases !== 'undefined') {
    const caries = dentalConditionAliases.find(x => x.condition === 'caries');
    if (caries) {
      ['carie','cari','carries','caries dental'].forEach(word => {
        if (!caries.aliases.includes(word)) caries.aliases.push(word);
      });
    }
  }

  if (typeof dentalSurfaceAliases !== 'undefined') {
    if (Array.isArray(dentalSurfaceAliases.m)) {
      ['mesi','mesia','mesial'].forEach(word => {
        if (!dentalSurfaceAliases.m.includes(word)) dentalSurfaceAliases.m.push(word);
      });
    }
    if (Array.isArray(dentalSurfaceAliases.o)) {
      ['oclosal','ocluzal','ocluzar','oclusar','oclusai','isoclusal','pisoclusal','piscoclusal','psiclusal','oclusal dental'].forEach(word => {
        if (!dentalSurfaceAliases.o.includes(word)) dentalSurfaceAliases.o.push(word);
      });
    }
  }

  function loadCorrections(){
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch { return {}; }
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
    let t = String(text).replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();

    for (let i=0; i<4; i++) {
      const previous = t;
      t = t.replace(/\b([a-záéíóúüñ]+)(?:\s+\1\b)+/gi, '$1');
      if (t === previous) break;
    }

    const re = /\b(?:pieza|diente)\s*(\d{2})\b/gi;
    const hits = [...t.matchAll(re)];
    if (hits.length > 1) {
      const numbers = hits.map(x => x[1]);
      if (numbers.every(n => n === numbers[0])) {
        const last = hits[hits.length - 1];
        t = t.slice(last.index).trim();
      }
    }

    t = t
      .replace(/\bcarie\b/gi, 'caries')
      .replace(/\bcari\b/gi, 'caries')
      .replace(/\bmesi\b/gi, 'mesial')
      .replace(/\b(oclosal|ocluzal|pisoclusal|piscoclusal|psiclusal|isoclusal)\b/gi, 'oclusal');

    return applyLearnedCorrections(t);
  }

  function maybeLearnFromEdit(originalText, editedText){
    const a = normalize(cleanTranscript(originalText)).split(/\s+/).filter(Boolean);
    const b = normalize(editedText).split(/\s+/).filter(Boolean);
    if (!a.length || a.length !== b.length) return;

    const differences = [];
    for (let i=0; i<a.length; i++) if (a[i] !== b[i]) differences.push([a[i],b[i]]);
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

  function severityFromText(text=''){
    const t = normalize(text);
    if (/\b(incipiente|inicial|temprana|temprano)\b/.test(t)) return 'incipient';
    if (/\b(extensa|extenso|amplia|amplio|profunda|profundo)\b/.test(t)) return 'extensive';
    return '';
  }

  function severityLabel(severity){
    return cariesSeverityDefs[severity]?.label || cariesSeverityDefs[''].label;
  }

  const originalParseDictation = parseDictation;
  parseDictation = function(text){
    const cleaned = cleanTranscript(text);
    const parsed = originalParseDictation(cleaned);
    parsed.forEach(item => {
      if (item?.ok && item.condition === 'caries') item.severity = severityFromText(item.raw || cleaned);
    });
    return parsed;
  };

  const conditionGrid = $('conditionGrid');
  const toothNote = $('toothNote');
  let severityWrap = $('cariesSeverityWrap');
  let severitySelect = $('cariesSeveritySelect');

  if (!severityWrap && conditionGrid && toothNote) {
    severityWrap = document.createElement('label');
    severityWrap.id = 'cariesSeverityWrap';
    severityWrap.className = 'field caries-severity-field';
    severityWrap.innerHTML = `
      <span>Extensión de caries</span>
      <select id="cariesSeveritySelect">
        <option value="">Sin especificar</option>
        <option value="incipient">Incipiente</option>
        <option value="extensive">Extensa</option>
      </select>
      <small class="microcopy">Se guarda como modificador del hallazgo “Caries”.</small>
    `;
    toothNote.parentNode.insertBefore(severityWrap, toothNote);
    severitySelect = $('cariesSeveritySelect');
  }

  if (severitySelect) {
    severitySelect.value = state.cariesSeverity || '';
    severitySelect.onchange = () => { state.cariesSeverity = severitySelect.value; };
  }

  function syncSeverityVisibility(){
    if (!severityWrap || !severitySelect) return;
    const show = state.selectedCondition === 'caries';
    severityWrap.hidden = !show;
    if (show) severitySelect.value = state.cariesSeverity || '';
  }

  const originalRenderConditionSelection = renderConditionSelection;
  renderConditionSelection = function(){
    originalRenderConditionSelection();
    if (state.selectedCondition !== 'caries') state.cariesSeverity = '';
    syncSeverityVisibility();
  };

  ['upperArch','lowerArch'].forEach(id => {
    const arch = $(id);
    if (!arch) return;
    arch.addEventListener('click', event => {
      const node = event.target.closest('.tooth-item');
      if (!node) return;
      const tooth = node.dataset.tooth;
      const p = getPatient();
      const records = p?.chart?.[state.dentition]?.[tooth]?.records || [];
      const latest = records.at(-1);
      state.cariesSeverity = latest?.condition === 'caries' ? (latest.severity || '') : '';
      setTimeout(syncSeverityVisibility, 0);
    }, true);
  });

  const originalLatestSurfaceColor = latestSurfaceColor;
  latestSurfaceColor = function(records,surface){
    const rec = [...(records || [])].reverse().find(r => (r.surfaces || []).includes(surface));
    if (rec?.condition === 'caries' && rec.severity) {
      return cariesSeverityDefs[rec.severity]?.color || conditionDefs.caries.color;
    }
    return originalLatestSurfaceColor(records,surface);
  };

  const originalRenderArch = renderArch;
  renderArch = function(container,list){
    originalRenderArch(container,list);
    const p = getPatient();
    const chart = p?.chart?.[state.dentition] || {};
    [...container.querySelectorAll('.tooth-item')].forEach(node => {
      const tooth = node.dataset.tooth;
      const records = chart?.[tooth]?.records || [];
      const conditions = [...new Set(records.map(r => r.condition))];
      const cariesIndex = conditions.indexOf('caries');
      if (cariesIndex < 0) return;
      const latestCaries = [...records].reverse().find(r => r.condition === 'caries');
      const dot = node.querySelectorAll('.badge-dot')[cariesIndex];
      if (dot && latestCaries?.severity) {
        dot.style.background = cariesSeverityDefs[latestCaries.severity]?.color || conditionDefs.caries.color;
        dot.title = severityLabel(latestCaries.severity);
      }
    });
  };

  const fullLegend = $('fullLegend');
  if (fullLegend && !fullLegend.querySelector('[data-caries-severity-legend]')) {
    [['incipient','Caries incipiente'],['extensive','Caries extensa']].forEach(([severity,label]) => {
      const el = document.createElement('div');
      el.className = 'legend-entry';
      el.dataset.cariesSeverityLegend = severity;
      el.innerHTML = `<i style="background:${cariesSeverityDefs[severity].color}"></i><span>${label}</span>`;
      fullLegend.appendChild(el);
    });
  }

  const legendStrip = document.querySelector('.legend-strip');
  if (legendStrip && !legendStrip.querySelector('[data-caries-note]')) {
    const note = document.createElement('span');
    note.dataset.cariesNote = 'true';
    note.className = 'caries-legend-note';
    note.innerHTML = `<i class="dot" style="background:${cariesSeverityDefs.incipient.color}"></i>Incipiente <i class="dot" style="background:${cariesSeverityDefs.extensive.color};margin-left:6px"></i>Extensa`;
    legendStrip.insertBefore(note, legendStrip.querySelector('#showLegendBtn'));
  }

  const saveToothBtn = $('saveToothBtn');
  if (saveToothBtn) {
    saveToothBtn.onclick = async () => {
      const p = getPatient();
      if (!p || !state.selectedTooth) return;
      ensurePatientData(p);
      const bucket = p.chart[state.dentition];
      const surfaces = [...state.selectedSurfaces];
      const note = $('toothNote').value.trim();
      const now = new Date().toISOString();
      const severity = state.selectedCondition === 'caries' ? (state.cariesSeverity || '') : '';

      if (state.selectedCondition === 'healthy') {
        bucket[state.selectedTooth] = { records: [{ id:uid(), condition:'healthy', surfaces:[], note, createdAt:now }] };
      } else {
        const existing = bucket[state.selectedTooth]?.records || [];
        const rec = {
          id:uid(), condition:state.selectedCondition, surfaces, note, createdAt:now,
          ...(state.selectedCondition === 'caries' ? { severity } : {})
        };
        bucket[state.selectedTooth] = { records:[...existing.filter(r => r.condition !== 'healthy'), rec] };
      }

      p.chart.updatedAt = now;
      addHistory(p,{
        dentition:state.dentition,
        tooth:state.selectedTooth,
        summary:`${conditionDefs[state.selectedCondition].label}${severity ? ' · '+severityLabel(severity) : ''}${surfaces.length ? ' · '+surfaces.map(s=>surfaceLabels[s]).join(', ') : ''}${note ? ' · '+note : ''}`
      });

      await savePatientRecord(p);
      state.selectedSurfaces = new Set();
      renderOdontogram();
      toast('Hallazgo guardado');
    };
  }

  renderDictationPreview = function(){
    const box = $('dictationPreview');
    box.innerHTML = '';
    if (!state.dictationParsed.length) {
      box.innerHTML = '<div class="dictation-item error">No encontré comandos clínicos. Prueba: “Pieza 14 caries incipiente mesial”.</div>';
      $('applyDictationBtn').hidden = true;
      return;
    }

    state.dictationParsed.forEach(r => {
      const d = document.createElement('div');
      d.className = 'dictation-item' + (r.ok ? '' : ' error');
      d.textContent = r.ok
        ? `✓ Pieza ${r.tooth} · ${conditionDefs[r.condition].label}${r.condition === 'caries' && r.severity ? ' · '+severityLabel(r.severity) : ''}${r.surfaces.length ? ' · '+r.surfaces.map(s=>surfaceLabels[s]).join(' + ') : ''}${r.treatment ? ' · Manejo: '+r.treatment : ''}`
        : `⚠ ${r.error}`;
      box.appendChild(d);
    });

    $('applyDictationBtn').hidden = !state.dictationParsed.some(x => x.ok);
  };

  const applyDictationBtn = $('applyDictationBtn');
  if (applyDictationBtn) {
    applyDictationBtn.onclick = async () => {
      const p = getPatient();
      if (!p) {
        toast('Selecciona un paciente antes de aplicar el dictado.');
        navigate('patients');
        return;
      }

      ensurePatientData(p);
      const bucket = p.chart[state.dentition];

      state.dictationParsed.filter(r => r.ok).forEach(r => {
        const now = new Date().toISOString();
        if (r.condition === 'healthy') {
          bucket[r.tooth] = { records:[{ id:uid(), condition:'healthy', surfaces:[], note:'', createdAt:now, source:'dictation' }] };
        } else {
          const existing = bucket[r.tooth]?.records || [];
          bucket[r.tooth] = {
            records:[...existing.filter(x => x.condition !== 'healthy'), {
              id:uid(), condition:r.condition, surfaces:r.surfaces, note:'', createdAt:now, source:'dictation',
              ...(r.condition === 'caries' ? { severity:r.severity || '' } : {})
            }]
          };
        }

        if (r.treatment) {
          const expBucket = p.exploration[state.dentition];
          const prev = expBucket[r.tooth] || {};
          const previousSuggested = (prev.suggested || '').trim();
          const suggested = previousSuggested && !previousSuggested.toLowerCase().includes(r.treatment.toLowerCase())
            ? `${previousSuggested}; ${r.treatment}`
            : (previousSuggested || r.treatment);
          expBucket[r.tooth] = { ...prev, suggested, updatedAt:now };
        }

        addHistory(p,{
          dentition:state.dentition,
          tooth:r.tooth,
          summary:`Dictado: ${conditionDefs[r.condition].label}${r.condition === 'caries' && r.severity ? ' · '+severityLabel(r.severity) : ''}${r.surfaces.length ? ' · '+r.surfaces.map(s=>surfaceLabels[s]).join(', ') : ''}${r.treatment ? ' · Manejo: '+r.treatment : ''}`
        });
      });

      await savePatientRecord(p);
      toast('Dictado aplicado');
      navigate('chart');
    };
  }

  let lastRawSpeech = '';

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
    syncSeverityVisibility();
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

  micBtn.onclick = () => {
    if (listening) {
      try { rec.stop(); } catch {}
      return;
    }
    try { rec.start(); }
    catch { toast('Espera un momento e intenta nuevamente.'); }
  };

  if (!document.getElementById('goldentCariesSeverityStyle')) {
    const style = document.createElement('style');
    style.id = 'goldentCariesSeverityStyle';
    style.textContent = `
      .caries-severity-field{margin-top:12px}
      .caries-severity-field[hidden]{display:none!important}
      .caries-severity-field select{width:100%}
      .caries-legend-note{display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
    `;
    document.head.appendChild(style);
  }

  syncSeverityVisibility();

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
