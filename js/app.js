/**
 * APLICACIÓN PRINCIPAL (APP CONTROLLER)
 * Single Page Application de Alto Rendimiento para AWS SAP-C02
 * Estilo AWS Cloudscape Dark • Validación Inmediata • Copia Rápida para IA • Active Recall
 */

class App {
  constructor() {
    this.currentView = "dashboard"; // "dashboard" | "test" | "failures"
    this.activeSession = {
      type: "block", // "block" | "recall_24h" | "single"
      mode: "practice",
      blockNumber: 1,
      title: "",
      questions: [],
      currentIndex: 0,
      userSelected: [], // Array de letras seleccionadas para la pregunta actual (ej: ['A'] o ['A','C'])
      sessionAnswers: {}
    };

    // Instancia del Cronómetro de Foco (35 min con corte en pico)
    this.pomodoro = new PomodoroTimer({
      focusDuration: 35 * 60,
      breakDuration: 5 * 60,
      onTick: (data) => this.renderPomodoroWidget(data),
      onPeak: () => this.showToast("🔥 ¡PICO DE RENDIMIENTO! Quedan 5 min de máxima retención. Acelera el ritmo antes del corte.", "warning", 6000),
      onComplete: (mode) => {
        if (mode === "focus") {
          store.addCompletedFocusSession(35);
          this.showToast("🔔 ¡Bloque de Foco de 35 min completado! Tómate 5 min de descanso para consolidación neuronal.", "success", 8000);
        } else {
          this.showToast("⚡ Descanso finalizado. Listo para el siguiente bloque de alta intensidad.", "info", 5000);
        }
      }
    });

    this.init();
  }

  async init() {
    if (store.ensureQuestionsLoaded) store.ensureQuestionsLoaded();
    // Si no hay preguntas en el store local, cargar el dump preprocesado por defecto
    if (!store.questions || store.questions.length === 0) {
      await this.loadDefaultQuestions();
    }
    if (store.migratePendingExams) store.migratePendingExams();

    this.setupEventListeners();
    this.setupKeyboardShortcuts();
    this.render();
    this.renderPomodoroWidget(this.pomodoro.getTimeData());
  }

  async loadDefaultQuestions() {
    if (typeof window !== "undefined" && Array.isArray(window.DEFAULT_QUESTIONS) && window.DEFAULT_QUESTIONS.length > 0) {
      store.setQuestions(window.DEFAULT_QUESTIONS);
      console.log(`Cargadas ${window.DEFAULT_QUESTIONS.length} preguntas locales de SAP-C02.`);
      return;
    }
    try {
      const resp = await fetch("data/sap_c02_questions.json");
      if (resp.ok) {
        const data = await resp.json();
        store.setQuestions(data);
        console.log(`Cargadas ${data.length} preguntas preprocesadas de SAP-C02.`);
      }
    } catch (err) {
      console.warn("No se pudo cargar el archivo data/sap_c02_questions.json automáticamente:", err);
    }
  }

  setupEventListeners() {
    // Navegación por hash o botones
    window.addEventListener("hashchange", () => {
      const hash = window.location.hash.replace("#", "");
      if (["dashboard", "failures"].includes(hash)) {
        this.navigate(hash);
      }
    });

    // Suscribir al store para re-renderizar métricas cuando cambie
    store.subscribe(() => {
      if (this.currentView === "dashboard") {
        this.renderDashboard();
      } else if (this.currentView === "failures") {
        this.renderFailuresView();
      }
    });
  }

  setupKeyboardShortcuts() {
    window.addEventListener("keydown", (e) => {
      // Ignorar si el usuario está escribiendo en un input o textarea
      if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;

      // Atajos activos en el Simulador de Test
      if (this.currentView === "test" && this.activeSession.questions.length > 0) {
        const q = this.activeSession.questions[this.activeSession.currentIndex];
        const qId = String(q.id);
        const sessionAns = this.activeSession.sessionAnswers ? this.activeSession.sessionAnswers[qId] : null;
        const isGraded = !!(sessionAns && typeof sessionAns.isCorrect === "boolean");
        const letters = ["A", "B", "C", "D", "E", "F"];

        // Teclas 1-6 o A-F para seleccionar opciones (si aún no está validada)
        const keyUpper = e.key.toUpperCase();
        let letterPicked = null;
        if (["1", "2", "3", "4", "5", "6"].includes(e.key)) {
          const idx = parseInt(e.key) - 1;
          if (idx < Object.keys(q.choices).length) letterPicked = letters[idx];
        } else if (letters.includes(keyUpper) && q.choices[keyUpper]) {
          letterPicked = keyUpper;
        }

        if (letterPicked && !e.ctrlKey && !e.metaKey && !e.altKey) {
          if (isGraded) return;
          e.preventDefault();
          this.toggleOptionSelection(letterPicked);
          return;
        }

        // Espacio o Enter: Si no está validada y hay selección -> Validar pregunta; si ya está validada -> Siguiente pregunta
        if (e.key === "Enter" || e.code === "Space") {
          e.preventDefault();
          if (!isGraded && this.activeSession.userSelected.length > 0) {
            this.confirmAnswer();
          } else if (isGraded) {
            this.nextQuestion();
          }
          return;
        }

        // Flecha Derecha o N: Siguiente pregunta
        if (e.key === "ArrowRight" || keyUpper === "N") {
          e.preventDefault();
          this.nextQuestion();
          return;
        }

        // Flecha Izquierda o P: Pregunta anterior
        if (e.key === "ArrowLeft" || keyUpper === "P") {
          e.preventDefault();
          this.prevQuestion();
          return;
        }

        // Tecla D: Marcar/Desmarcar como Dudosa (Amarilla)
        if (keyUpper === "D") {
          e.preventDefault();
          this.toggleCurrentDoubt();
          return;
        }

        // Tecla K: Copiar pregunta y respuesta para IA
        if (keyUpper === "K") {
          e.preventDefault();
          this.copyQuestionForAI(q.id);
          return;
        }

        // Tecla Z: Modo Zen
        if (keyUpper === "Z") {
          e.preventDefault();
          this.toggleZenMode();
          return;
        }

        // Tecla T: Alternar Cronómetro de Foco
        if (keyUpper === "T") {
          e.preventDefault();
          this.pomodoro.toggle();
          return;
        }
      }
    });
  }

  navigate(viewName) {
    this.currentView = viewName;
    if (typeof window !== "undefined" && window.location) {
      window.location.hash = viewName;
    }
    if (typeof document !== "undefined" && document.body) {
      document.body.classList.toggle("view-test", viewName === "test");
    }
    this.render();
    if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
      window.scrollTo(0, 0);
    }
  }

  // =========================================================================
  // COPIADO RÁPIDO AL PORTAPAPELES PARA IA (PREGUNTA + OPCIONES + RESPUESTA)
  // =========================================================================

  copyTextToClipboard(text, successMessage = "Copiado al portapapeles") {
    const fallbackCopy = (str) => {
      try {
        const ta = document.createElement("textarea");
        ta.value = str;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "-9999px";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, str.length);
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch (err) {
        return false;
      }
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast(successMessage, "success");
      }).catch(() => {
        if (fallbackCopy(text)) {
          this.showToast(successMessage, "success");
        } else {
          this.showToast("No se pudo copiar automáticamente.", "error");
        }
      });
    } else {
      if (fallbackCopy(text)) {
        this.showToast(successMessage, "success");
      } else {
        this.showToast("No se pudo copiar automáticamente.", "error");
      }
    }
  }

  copyQuestionForAI(questionId = null, btnEl = null) {
    let q = null;
    if (questionId !== null && questionId !== undefined) {
      q = store.questions.find(item => String(item.id) === String(questionId));
    }
    if (!q && this.activeSession && this.activeSession.questions) {
      q = this.activeSession.questions[this.activeSession.currentIndex];
    }
    if (!q) return;

    const qId = String(q.id);
    const effectiveCorrect = store.getEffectiveCorrectAnswer(q);
    const officialAns = store.getOfficialAnswer(q);
    const commVote = q.communityVote || "";
    const choicesEntries = Object.entries(q.choices || {});

    // Respuesta seleccionada por el usuario si existe
    let userSelected = [];
    if (this.currentView === "test" && this.activeSession) {
      const sessionAns = this.activeSession.sessionAnswers ? this.activeSession.sessionAnswers[qId] : null;
      if (sessionAns && sessionAns.selected && sessionAns.selected.length > 0) {
        userSelected = sessionAns.selected;
      } else if (this.activeSession.userSelected && this.activeSession.userSelected.length > 0) {
        userSelected = this.activeSession.userSelected;
      }
    } else if (store.answers && store.answers[qId] && store.answers[qId].selected) {
      userSelected = store.answers[qId].selected;
    }

    const optionsFormatted = choicesEntries
      .map(([letter, text]) => `${letter}) ${text}`)
      .join("\n\n");

    const correctFullTexts = effectiveCorrect
      .split("")
      .map(letter => (q.choices && q.choices[letter]) ? `- ${letter}) ${q.choices[letter]}` : `- ${letter}`)
      .join("\n");

    const lines = [
      `Actúa como un Arquitecto de Soluciones AWS Senior (certificación SAP-C02). Analiza esta pregunta de examen:`,
      ``,
      `PREGUNTA Q#${q.questionNumber} (Bloque ${q.blockNumber}):`,
      `${q.question}`,
      ``,
      `OPCIONES:`,
      `${optionsFormatted}`,
      ``,
      `RESPUESTA CORRECTA: ${effectiveCorrect}`,
      `${correctFullTexts}`,
      commVote ? `(Consenso comunidad: ${commVote} | Clave oficial dump: ${officialAns})` : `(Clave oficial dump: ${officialAns})`
    ];

    if (userSelected && userSelected.length > 0) {
      const userStr = [...userSelected].sort().join("");
      if (userStr !== effectiveCorrect) {
        lines.push(`Mi respuesta marcada fue: ${userStr}`);
      }
    }

    lines.push(
      ``,
      `Explícame en español de forma clara y directa:`,
      `1. Palabras clave / requisitos críticos del enunciado.`,
      `2. Por qué la opción ${effectiveCorrect} es la correcta arquitectónicamente.`,
      `3. Por qué se descartan las demás opciones.`
    );

    const fullPrompt = lines.join("\n");
    this.copyTextToClipboard(fullPrompt, `🤖 Pregunta Q#${q.questionNumber} y respuesta copiadas para pegar en IA`);

    if (btnEl) {
      const origHTML = btnEl.innerHTML;
      btnEl.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400"></i><span class="text-emerald-300">¡Copiado para IA!</span>`;
      if (window.lucide) window.lucide.createIcons();
      setTimeout(() => {
        if (btnEl) {
          btnEl.innerHTML = origHTML;
          if (window.lucide) window.lucide.createIcons();
        }
      }, 1800);
    }
  }

  // =========================================================================
  // CONTROLADOR DE SESIONES DE TEST (VALIDACIÓN INMEDIATA PREGUNTA A PREGUNTA)
  // =========================================================================

  async startBlockSession(blockNumber) {
    if (store.ensureQuestionsLoaded) store.ensureQuestionsLoaded();
    if (!store.questions || store.questions.length === 0) {
      await this.loadDefaultQuestions();
    }

    const startIdx = (blockNumber - 1) * 25;
    const endIdx = Math.min(blockNumber * 25, store.questions.length);
    const questions = store.questions.slice(startIdx, endIdx);

    if (questions.length === 0) {
      this.showToast("No hay preguntas disponibles en este bloque.", "error");
      return;
    }

    // Cargar respuestas ya validadas en este bloque
    const sessionAnswers = {};
    questions.forEach(q => {
      const saved = store.answers[String(q.id)];
      if (saved && saved.selected && saved.selected.length > 0 && typeof saved.isCorrect === "boolean") {
        sessionAnswers[String(q.id)] = { ...saved };
      }
    });

    // Posicionar en la primera pregunta sin responder del bloque (o en la 0 si todas están respondidas)
    const firstUnansweredIdx = questions.findIndex(q => !sessionAnswers[String(q.id)]);
    const initialIndex = firstUnansweredIdx !== -1 ? firstUnansweredIdx : 0;

    const firstQ = questions[initialIndex];
    const firstSaved = firstQ ? sessionAnswers[String(firstQ.id)] : null;

    this.activeSession = {
      type: "block",
      mode: "practice",
      blockNumber: blockNumber,
      title: `Bloque ${blockNumber}: Q${startIdx + 1} - Q${endIdx}`,
      questions: questions,
      currentIndex: initialIndex,
      userSelected: firstSaved ? [...firstSaved.selected] : [],
      sessionAnswers: sessionAnswers,
      startedAt: new Date().toISOString()
    };

    this.navigate("test");
  }

  startRecallSession() {
    const recallQuestions = store.getRecallQuestions();
    if (recallQuestions.length === 0) {
      this.showToast("¡Excelente! No tienes preguntas falladas ni dudosas pendientes de repaso.", "success");
      return;
    }

    this.activeSession = {
      type: "recall_24h",
      mode: "practice",
      blockNumber: 0,
      title: `Active Recall: ${recallQuestions.length} Preguntas Críticas`,
      questions: recallQuestions,
      currentIndex: 0,
      userSelected: [],
      sessionAnswers: {},
      startedAt: new Date().toISOString(),
      initialNetScore: store.getGlobalStats().netScore
    };

    this.navigate("test");
  }

  toggleOptionSelection(letter) {
    const q = this.activeSession.questions[this.activeSession.currentIndex];
    if (!q) return;

    const qId = String(q.id);
    const sessionAns = this.activeSession.sessionAnswers ? this.activeSession.sessionAnswers[qId] : null;
    const isGraded = !!(sessionAns && typeof sessionAns.isCorrect === "boolean");

    // Si la pregunta ya ha sido validada, no cambiar selección a menos que pulse Reintentar
    if (isGraded) return;

    const isMulti = (q.multiSelectCount || 1) > 1;

    if (isMulti) {
      if (this.activeSession.userSelected.includes(letter)) {
        this.activeSession.userSelected = this.activeSession.userSelected.filter(l => l !== letter);
      } else {
        if (this.activeSession.userSelected.length < q.multiSelectCount) {
          this.activeSession.userSelected.push(letter);
        } else {
          this.activeSession.userSelected.shift();
          this.activeSession.userSelected.push(letter);
        }
      }
    } else {
      this.activeSession.userSelected = [letter];
    }

    this.renderTestView();
  }

  confirmAnswer() {
    const q = this.activeSession.questions[this.activeSession.currentIndex];
    if (!q) return;

    if (!this.activeSession.userSelected || this.activeSession.userSelected.length === 0) {
      this.showToast("Selecciona una opción antes de validar la pregunta.", "warning");
      return;
    }

    const qId = String(q.id);
    const selectedSorted = [...this.activeSession.userSelected].sort().join("");
    const effectiveCorrect = store.getEffectiveCorrectAnswer(q);
    const isCorrect = selectedSorted === effectiveCorrect;

    // Guardar en sessionAnswers de la sesión activa (validación inmediata)
    if (!this.activeSession.sessionAnswers) this.activeSession.sessionAnswers = {};
    this.activeSession.sessionAnswers[qId] = {
      selected: [...this.activeSession.userSelected],
      isCorrect: isCorrect,
      timestamp: new Date().toISOString()
    };

    // Registrar en el Store persistente inmediatamente
    if (this.activeSession.type === "recall_24h") {
      store.recordRecallAnswer(q.id, this.activeSession.userSelected, isCorrect, q.question.slice(0, 100));
    } else {
      store.recordAnswer(q.id, this.activeSession.userSelected, isCorrect, q.question.slice(0, 100));

      // Si estamos en un bloque y con esta respuesta se completan todas las del bloque, marcar bloque completado
      if (this.activeSession.type === "block") {
        const allAnswered = this.activeSession.questions.every(item => {
          const a = this.activeSession.sessionAnswers[String(item.id)];
          return a && a.selected && a.selected.length > 0 && typeof a.isCorrect === "boolean";
        });
        if (allAnswered) {
          let correctCount = 0;
          let failedCount = 0;
          this.activeSession.questions.forEach(item => {
            const a = this.activeSession.sessionAnswers[String(item.id)];
            if (a && a.isCorrect) correctCount++;
            else failedCount++;
          });
          const totalQ = this.activeSession.questions.length;
          const accuracy = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0;
          const netScore = Math.max(0, +(correctCount - (failedCount / 3)).toFixed(1));
          store.markBlockCompleted(this.activeSession.blockNumber, {
            totalQuestions: totalQ,
            correctCount,
            failedCount,
            unansweredCount: 0,
            accuracy,
            netScore
          });
        }
      }
    }

    // Feedback sonoro sintético
    if (store.settings.soundEnabled) {
      if (isCorrect) {
        this.pomodoro.playTone(880, "sine", 0.12, 0.08);
      } else {
        this.pomodoro.playTone(220, "sawtooth", 0.25, 0.1);
      }
    }

    // Mostrar inmediatamente la respuesta y explicación sin saltar de pregunta
    this.renderTestView();
  }

  retryCurrentQuestion() {
    const q = this.activeSession.questions[this.activeSession.currentIndex];
    if (!q) return;
    const qId = String(q.id);
    if (this.activeSession.sessionAnswers) {
      delete this.activeSession.sessionAnswers[qId];
    }
    this.activeSession.userSelected = [];
    this.renderTestView();
  }

  nextQuestion() {
    if (this.activeSession.currentIndex < this.activeSession.questions.length - 1) {
      this.activeSession.currentIndex++;
      const nextQ = this.activeSession.questions[this.activeSession.currentIndex];
      const sessionAns = this.activeSession.sessionAnswers ? this.activeSession.sessionAnswers[String(nextQ.id)] : null;
      this.activeSession.userSelected = sessionAns ? [...sessionAns.selected] : [];
      this.renderTestView();
      window.scrollTo(0, 0);
    } else {
      // Si está en la última pregunta, mostrar resumen de sesión
      this.requestFinishSession();
    }
  }

  prevQuestion() {
    if (this.activeSession.currentIndex > 0) {
      this.activeSession.currentIndex--;
      const prevQ = this.activeSession.questions[this.activeSession.currentIndex];
      const sessionAns = this.activeSession.sessionAnswers ? this.activeSession.sessionAnswers[String(prevQ.id)] : null;
      this.activeSession.userSelected = sessionAns ? [...sessionAns.selected] : [];
      this.renderTestView();
      window.scrollTo(0, 0);
    }
  }

  jumpToQuestion(index) {
    if (index >= 0 && index < this.activeSession.questions.length) {
      this.activeSession.currentIndex = index;
      const targetQ = this.activeSession.questions[this.activeSession.currentIndex];
      const sessionAns = this.activeSession.sessionAnswers ? this.activeSession.sessionAnswers[String(targetQ.id)] : null;
      this.activeSession.userSelected = sessionAns ? [...sessionAns.selected] : [];
      this.renderTestView();
      window.scrollTo(0, 0);
    }
  }

  requestFinishSession() {
    if (this.activeSession.type === "single") {
      this.navigate("failures");
      return;
    }
    this.finishSession();
  }

  finishSession() {
    const isRecall = this.activeSession.type === "recall_24h";
    const totalQ = this.activeSession.questions.length;
    const sessionAnswers = this.activeSession.sessionAnswers || {};

    if (isRecall) {
      let correctCount = 0;
      let failedCount = 0;
      let unansweredCount = 0;

      this.activeSession.questions.forEach(q => {
        const qId = String(q.id);
        const ans = sessionAnswers[qId];
        if (ans && ans.selected && ans.selected.length > 0 && typeof ans.isCorrect === "boolean") {
          if (ans.isCorrect) correctCount++;
          else failedCount++;
        } else {
          unansweredCount++;
        }
      });

      if (correctCount > 0 && window.confetti) {
        window.confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
      }

      const initialNet = this.activeSession.initialNetScore || 0;
      const currentNet = store.getGlobalStats().netScore;
      const netGain = +(currentNet - initialNet).toFixed(1);

      const summary = {
        totalQuestions: totalQ,
        resolvedCount: correctCount,
        failedCount: failedCount,
        unansweredCount: unansweredCount,
        netScoreBefore: initialNet,
        netScoreAfter: currentNet,
        netScoreGain: netGain
      };

      store.saveRecallSessionSummary(summary);
      this.showRecallCompletionModal(summary);
    } else {
      // Resumen del bloque con las preguntas validadas
      const blockNum = this.activeSession.blockNumber;
      let correctCount = 0;
      let failedCount = 0;
      let unansweredCount = 0;

      this.activeSession.questions.forEach(q => {
        const qId = String(q.id);
        const ans = sessionAnswers[qId] || store.answers[qId];
        if (ans && ans.selected && ans.selected.length > 0 && typeof ans.isCorrect === "boolean") {
          if (ans.isCorrect) correctCount++;
          else failedCount++;
        } else {
          unansweredCount++;
        }
      });

      const evaluatedCount = correctCount + failedCount;
      const accuracy = evaluatedCount > 0 ? Math.round((correctCount / evaluatedCount) * 100) : 0;
      const netScore = Math.max(0, +(correctCount - (failedCount / 3)).toFixed(1));

      if (unansweredCount === 0 && totalQ > 0) {
        store.markBlockCompleted(blockNum, {
          totalQuestions: totalQ,
          correctCount,
          failedCount,
          unansweredCount: 0,
          accuracy,
          netScore
        });
        if (window.confetti) {
          window.confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        }
      }

      this.showBlockCompletionModal({
        blockNumber: blockNum,
        totalQuestions: totalQ,
        answeredCount: evaluatedCount,
        correctCount,
        failedCount,
        unansweredCount,
        accuracy,
        netScore
      });
    }
  }

  openCompletionModal(htmlContent) {
    const modal = document.getElementById("completion-modal");
    const container = document.getElementById("completion-modal-content");
    if (modal && container) {
      container.innerHTML = htmlContent;
      modal.classList.remove("hidden");
      modal.classList.add("flex");
      modal.style.display = "flex";
      if (window.lucide) window.lucide.createIcons();
    }
  }

  closeCompletionModal() {
    const modal = document.getElementById("completion-modal");
    if (modal) {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
      modal.style.display = "none";
    }
  }

  showBlockCompletionModal(data) {
    const isFull = data.unansweredCount === 0;
    const content = `
      <div class="text-center space-y-4">
        <div class="w-16 h-16 rounded-3xl ${isFull ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-[#ff9900]/20 text-[#ff9900] border-[#ff9900]/30'} flex items-center justify-center mx-auto border">
          <i data-lucide="${isFull ? 'award' : 'bar-chart-3'}" class="w-8 h-8"></i>
        </div>

        <div>
          <span class="text-xs font-mono font-bold text-[#ff9900] uppercase tracking-wider">Bloque ${data.blockNumber} • ${data.answeredCount}/${data.totalQuestions} Validadas</span>
          <h2 class="text-2xl font-black text-white mt-1">${isFull ? '¡Bloque Completado!' : 'Resumen de Progreso del Bloque'}</h2>
          <p class="text-xs text-slate-400 mt-1">
            ${isFull ? 'Has validado las 25 preguntas de este bloque.' : `Llevas ${data.answeredCount} preguntas validadas. Tu progreso queda guardado automáticamente.`}
          </p>
        </div>

        <!-- Grid de Estadísticas del Bloque -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div class="bg-[#0b121c] p-3 rounded-2xl border border-[#26354a] text-center">
            <span class="text-[10px] uppercase font-bold text-slate-400 block">Punt. Neta</span>
            <span class="text-xl font-extrabold text-[#ff9900] font-mono">${data.netScore}</span>
          </div>
          <div class="bg-[#0b121c] p-3 rounded-2xl border border-[#26354a] text-center">
            <span class="text-[10px] uppercase font-bold text-slate-400 block">Precisión</span>
            <span class="text-xl font-extrabold ${data.accuracy >= 75 ? 'text-emerald-400' : 'text-amber-400'} font-mono">${data.accuracy}%</span>
          </div>
          <div class="bg-[#0b121c] p-3 rounded-2xl border border-[#26354a] text-center">
            <span class="text-[10px] uppercase font-bold text-slate-400 block">Aciertos</span>
            <span class="text-xl font-extrabold text-emerald-400 font-mono">${data.correctCount}</span>
          </div>
          <div class="bg-[#0b121c] p-3 rounded-2xl border border-[#26354a] text-center">
            <span class="text-[10px] uppercase font-bold text-slate-400 block">Fallos</span>
            <span class="text-xl font-extrabold text-rose-400 font-mono">${data.failedCount}</span>
          </div>
        </div>

        ${data.unansweredCount > 0 ? `
          <div class="text-[11px] text-amber-300 bg-amber-950/30 border border-amber-500/30 p-2.5 rounded-xl">
            Quedan ${data.unansweredCount} pregunta(s) pendientes de validar en este bloque. Puedes continuarlas cuando quieras.
          </div>
        ` : ''}

        <!-- Botones de Acción -->
        <div class="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 border-t border-[#26354a]">
          <button onclick="app.closeCompletionModal()" class="btn-aws-primary w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs">
            <i data-lucide="eye" class="w-4 h-4"></i>
            <span>Seguir en el Bloque</span>
          </button>
          <button onclick="app.closeCompletionModal(); app.navigate('dashboard')" class="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#1c283a] hover:bg-[#26354a] text-slate-200 font-bold px-5 py-2.5 rounded-xl text-xs border border-[#26354a] transition">
            <i data-lucide="layout-dashboard" class="w-4 h-4"></i>
            <span>Ir al Dashboard</span>
          </button>
          <button onclick="app.closeCompletionModal(); app.openSyncModal()" class="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#00a1c9]/15 hover:bg-[#00a1c9]/25 text-[#38bdf8] font-bold px-5 py-2.5 rounded-xl text-xs border border-[#00a1c9]/40 transition">
            <i data-lucide="cloud-upload" class="w-4 h-4"></i>
            <span>Subir a Drive</span>
          </button>
        </div>
      </div>
    `;
    this.openCompletionModal(content);
  }

  showRecallCompletionModal(data) {
    const content = `
      <div class="text-center space-y-4">
        <div class="w-16 h-16 rounded-3xl bg-[#ff9900]/20 text-[#ff9900] flex items-center justify-center mx-auto border border-[#ff9900]/30">
          <i data-lucide="flame" class="w-8 h-8 text-[#ff9900]"></i>
        </div>

        <div>
          <span class="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Simulacro Dinámico de Errores</span>
          <h2 class="text-2xl font-black text-white mt-1">¡Sesión Active Recall!</h2>
          <p class="text-xs text-slate-400 mt-1">Resumen de consolidación sobre ${data.totalQuestions} preguntas críticas.</p>
        </div>

        <!-- Tarjetas de Consolidación -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div class="bg-emerald-950/30 border border-emerald-500/40 p-4 rounded-2xl text-center">
            <span class="text-2xl font-black text-emerald-400 font-mono block">${data.resolvedCount}</span>
            <span class="text-xs font-bold text-emerald-300 block mt-1">Errores Superados</span>
            <span class="text-[10px] text-slate-400 block mt-0.5">Eliminados de Base Roja</span>
          </div>

          <div class="bg-rose-950/30 border border-rose-500/40 p-4 rounded-2xl text-center">
            <span class="text-2xl font-black text-rose-400 font-mono block">${data.failedCount}</span>
            <span class="text-xs font-bold text-rose-300 block mt-1">Errores Persistentes</span>
            <span class="text-[10px] text-slate-400 block mt-0.5">Siguen en Base de Fallos</span>
          </div>

          <div class="bg-[#ff9900]/10 border border-[#ff9900]/40 p-4 rounded-2xl text-center">
            <span class="text-2xl font-black text-[#ff9900] font-mono block">${data.netScoreGain >= 0 ? '+' : ''}${data.netScoreGain}</span>
            <span class="text-xs font-bold text-[#ffad33] block mt-1">Puntuación Neta</span>
            <span class="text-[10px] text-slate-400 block mt-0.5">Recuperada en el total</span>
          </div>
        </div>

        <!-- Botones de Acción -->
        <div class="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 border-t border-[#26354a]">
          <button onclick="app.closeCompletionModal()" class="btn-aws-primary w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs">
            <i data-lucide="eye" class="w-4 h-4"></i>
            <span>Continuar Revisando</span>
          </button>
          <button onclick="app.closeCompletionModal(); app.navigate('failures')" class="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#1c283a] hover:bg-[#26354a] text-rose-300 font-bold px-5 py-2.5 rounded-xl text-xs border border-[#26354a] transition">
            <i data-lucide="alert-octagon" class="w-4 h-4"></i>
            <span>Base de Fallos</span>
          </button>
          <button onclick="app.closeCompletionModal(); app.navigate('dashboard')" class="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#1c283a] hover:bg-[#26354a] text-slate-200 font-bold px-5 py-2.5 rounded-xl text-xs border border-[#26354a] transition">
            <i data-lucide="layout-dashboard" class="w-4 h-4"></i>
            <span>Dashboard</span>
          </button>
        </div>
      </div>
    `;
    this.openCompletionModal(content);
  }

  toggleCurrentDoubt() {
    const q = this.activeSession.questions[this.activeSession.currentIndex];
    store.toggleDoubt(q.id);
    this.renderTestView();
  }

  toggleZenMode() {
    store.settings.zenMode = !store.settings.zenMode;
    document.body.classList.toggle("zen-mode", store.settings.zenMode);
    store.saveToStorage();
    this.renderTestView();
  }

  saveCurrentMnemonic(text, lockerNum) {
    const q = this.activeSession.questions[this.activeSession.currentIndex];
    store.saveMnemonic(q.id, text, lockerNum);
    this.showToast("Nota técnica guardada correctamente.", "success");
    this.renderTestView();
  }

  confirmResetBlock(blockNumber) {
    if (confirm(`¿Estás seguro de que deseas reiniciar el Bloque ${blockNumber}? Se eliminarán las respuestas y fallos de este bloque para practicarlo desde cero.`)) {
      store.resetBlock(blockNumber);
      this.showToast(`Bloque ${blockNumber} reiniciado desde cero.`, "info");
      if (this.currentView === "test" && this.activeSession.blockNumber === blockNumber) {
        this.startBlockSession(blockNumber);
      } else {
        this.render();
      }
    }
  }

  forceCorrectAnswer(questionId) {
    this.openForceAnswerModal(questionId);
  }

  revertCorrectAnswer(questionId) {
    this.resetForcedAnswer(questionId);
  }

  openForceAnswerModal(questionId) {
    const qId = String(questionId);
    let q = null;
    if (this.activeSession && this.activeSession.questions) {
      q = this.activeSession.questions.find(item => String(item.id) === qId);
    }
    if (!q) {
      q = store.questions.find(item => String(item.id) === qId);
    }
    if (!q) return;

    const commVote = store.getCommunityVoteAnswer(q);
    const officialAns = store.getOfficialAnswer(q);
    const currentEffective = store.getEffectiveCorrectAnswer(q);
    const hasCustom = store.hasCustomCorrectAnswer(q.id);
    const isMulti = (q.multiSelectCount || 1) > 1;

    let modal = document.getElementById("force-answer-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "force-answer-modal";
      document.body.appendChild(modal);
    }

    const choicesEntries = Object.entries(q.choices || {});
    let selectedModalLetters = currentEffective.split("");

    const renderModalContent = () => {
      modal.className = "fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b121c]/85 backdrop-blur-sm animate-fadeIn";
      modal.innerHTML = `
        <div class="bg-[#141d2b] border border-[#26354a] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          
          <!-- Modal Header -->
          <div class="p-5 border-b border-[#26354a] flex items-center justify-between bg-[#161e2d]">
            <div class="flex items-center gap-2.5">
              <span class="p-2 rounded-xl bg-[#ff9900]/20 text-[#ff9900] border border-[#ff9900]/30">
                <i data-lucide="sliders" class="w-5 h-5"></i>
              </span>
              <div>
                <h3 class="text-base font-bold text-white tracking-tight">
                  Elegir / Forzar Respuesta Válida para Q#${q.questionNumber || q.id}
                </h3>
                <span class="text-xs text-slate-400">
                  ${isMulti ? `Selecciona las ${q.multiSelectCount} opciones correctas` : 'Selecciona la opción que debe considerarse correcta'}
                </span>
              </div>
            </div>
            <button onclick="app.closeForceAnswerModal()" class="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-[#1c283a] transition">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>

          <!-- Modal Body -->
          <div class="p-5 space-y-4 overflow-y-auto flex-1">
            
            <!-- Estado Actual -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div class="bg-[#0b121c] p-3 rounded-xl border border-[#26354a] space-y-1">
                <span class="text-slate-400 block text-[10px] uppercase font-semibold">Consenso Comunidad:</span>
                <span class="font-mono font-bold text-emerald-400 text-sm">${commVote || 'N/A'}</span>
                ${q.communityVote ? `<div class="text-[10px] text-slate-500 truncate">${q.communityVote}</div>` : ''}
              </div>
              <div class="bg-[#0b121c] p-3 rounded-xl border border-[#26354a] space-y-1">
                <span class="text-slate-400 block text-[10px] uppercase font-semibold">Clave Oficial Examen:</span>
                <span class="font-mono font-bold text-slate-200 text-sm">${officialAns}</span>
                <div class="text-[10px] text-slate-500">Dump / oficial original</div>
              </div>
              <div class="bg-[#0b121c] p-3 rounded-xl border ${hasCustom ? 'border-[#ff9900]/50 bg-[#ff9900]/10' : 'border-[#26354a]'} space-y-1">
                <span class="text-slate-400 block text-[10px] uppercase font-semibold">Activa en tu Sistema:</span>
                <div class="flex items-center gap-1.5">
                  <span class="font-mono font-bold ${hasCustom ? 'text-[#ff9900]' : 'text-emerald-400'} text-sm">${currentEffective}</span>
                  <span class="text-[9px] px-1.5 py-0.5 rounded ${hasCustom ? 'bg-[#ff9900]/20 text-[#ff9900]' : 'bg-emerald-500/20 text-emerald-300'}">
                    ${hasCustom ? 'Personalizada' : 'Por Defecto'}
                  </span>
                </div>
              </div>
            </div>

            <!-- Enunciado corto -->
            <div class="text-xs text-slate-300 bg-[#0b121c]/70 p-3 rounded-xl border border-[#26354a]">
              <strong class="text-slate-400 block mb-1">Enunciado:</strong>
              <p class="line-clamp-2">${q.question}</p>
            </div>

            <!-- Opciones Interactivas -->
            <div class="space-y-2">
              <label class="text-xs font-semibold text-slate-300 block">Elige la opción o combinación que consideras correcta:</label>
              ${choicesEntries.map(([letter, text]) => {
                const isChecked = selectedModalLetters.includes(letter);
                const isComm = commVote && commVote.includes(letter);
                const isOff = officialAns && officialAns.includes(letter);

                return `
                  <div onclick="app.toggleModalLetter('${letter}', ${isMulti})" class="flex items-start gap-3 p-3 rounded-xl border ${isChecked ? 'border-[#ff9900] bg-[#ff9900]/15 ring-1 ring-[#ff9900]/40' : 'border-[#26354a] bg-[#0b121c]/60 hover:bg-[#1c283a]/60'} cursor-pointer transition">
                    <div class="w-5 h-5 rounded-md flex items-center justify-center font-mono text-xs font-bold ${isChecked ? 'bg-[#ff9900] text-[#0f141a]' : 'bg-[#1c283a] text-slate-300'} mt-0.5">
                      ${letter}
                    </div>
                    <div class="flex-1 text-xs text-slate-200 leading-relaxed">
                      ${text}
                      <div class="flex items-center gap-2 mt-1.5">
                        ${isComm ? '<span class="text-[10px] text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono">Consenso Comunidad</span>' : ''}
                        ${isOff ? '<span class="text-[10px] text-slate-300 bg-[#1c283a] border border-[#26354a] px-1.5 py-0.5 rounded font-mono">Clave Oficial</span>' : ''}
                      </div>
                    </div>
                    ${isChecked ? '<i data-lucide="check" class="w-4 h-4 text-[#ff9900] flex-shrink-0 mt-1"></i>' : ''}
                  </div>
                `;
              }).join("")}
            </div>

          </div>

          <!-- Modal Footer / Acciones Rápidas -->
          <div class="p-4 bg-[#0b121c] border-t border-[#26354a] flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              ${commVote ? `
                <button onclick="app.applyModalAnswer('${q.id}', '${commVote}')" class="text-xs bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 px-3 py-1.5 rounded-xl font-semibold transition">
                  Usar Comunidad (${commVote})
                </button>
              ` : ''}
              <button onclick="app.applyModalAnswer('${q.id}', '${officialAns}')" class="text-xs bg-[#1c283a] hover:bg-[#26354a] text-slate-300 border border-[#26354a] px-3 py-1.5 rounded-xl font-semibold transition">
                Usar Oficial (${officialAns})
              </button>
              ${hasCustom ? `
                <button onclick="app.resetForcedAnswer('${q.id}')" class="text-xs text-rose-400 hover:text-rose-300 underline px-2 py-1">
                  Restablecer
                </button>
              ` : ''}
            </div>

            <div class="flex items-center gap-2">
              <button onclick="app.closeForceAnswerModal()" class="text-xs text-slate-400 hover:text-white px-3 py-2 rounded-xl transition">
                Cancelar
              </button>
              <button onclick="app.saveCustomModalSelection('${q.id}')" class="btn-aws-primary text-xs px-4 py-2 rounded-xl flex items-center gap-1.5">
                <i data-lucide="check-check" class="w-4 h-4"></i>
                <span>Aplicar Selección</span>
              </button>
            </div>
          </div>

        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
    };

    this._modalSelectedLetters = selectedModalLetters;
    this._modalQuestion = q;
    this._modalIsMulti = isMulti;
    this._renderModalContent = renderModalContent;
    renderModalContent();
  }

  toggleModalLetter(letter, isMulti) {
    if (!this._modalSelectedLetters) this._modalSelectedLetters = [];
    if (!isMulti) {
      this._modalSelectedLetters = [letter];
    } else {
      if (this._modalSelectedLetters.includes(letter)) {
        this._modalSelectedLetters = this._modalSelectedLetters.filter(l => l !== letter);
      } else {
        this._modalSelectedLetters.push(letter);
      }
    }
    if (this._renderModalContent) this._renderModalContent();
  }

  saveCustomModalSelection(questionId) {
    const letters = (this._modalSelectedLetters || []).sort().join("");
    if (!letters) {
      this.showToast("Selecciona al menos una opción.", "warning");
      return;
    }
    this.applyModalAnswer(questionId, letters);
  }

  applyModalAnswer(questionId, letters) {
    const qId = String(questionId);
    store.setCustomCorrectAnswer(qId, letters, "Selección manual del usuario");

    // Sincronizar sesión activa si está abierta
    if (this.activeSession && this.activeSession.sessionAnswers && this.activeSession.sessionAnswers[qId]) {
      const q = (this.activeSession.questions || []).find(item => String(item.id) === qId);
      const effective = q ? store.getEffectiveCorrectAnswer(q) : letters;
      const userSelectedSorted = [...(this.activeSession.sessionAnswers[qId].selected || [])].sort().join("");
      this.activeSession.sessionAnswers[qId].isCorrect = userSelectedSorted === effective;
      this.activeSession.sessionAnswers[qId].forcedCorrect = true;
    }

    if (store.settings.soundEnabled && this.pomodoro) {
      this.pomodoro.playTone(880, "sine", 0.12, 0.08);
    }
    this.showToast(`✓ Respuesta válida establecida como: ${letters}`, "success");
    this.closeForceAnswerModal();
    if (this.currentView === "test") {
      this.renderTestView();
    } else if (this.currentView === "failures") {
      this.renderFailuresView();
    } else {
      this.render();
    }
  }

  resetForcedAnswer(questionId) {
    const qId = String(questionId);
    store.resetCustomCorrectAnswer(questionId);

    // Sincronizar sesión activa
    if (this.activeSession && this.activeSession.sessionAnswers && this.activeSession.sessionAnswers[qId]) {
      const q = (this.activeSession.questions || []).find(item => String(item.id) === qId);
      const effective = q ? store.getEffectiveCorrectAnswer(q) : "";
      const userSelectedSorted = [...(this.activeSession.sessionAnswers[qId].selected || [])].sort().join("");
      this.activeSession.sessionAnswers[qId].isCorrect = userSelectedSorted === effective;
      delete this.activeSession.sessionAnswers[qId].forcedCorrect;
    }

    this.showToast("Respuesta restablecida al consenso por defecto.", "info");
    this.closeForceAnswerModal();
    if (this.currentView === "test") {
      this.renderTestView();
    } else if (this.currentView === "failures") {
      this.renderFailuresView();
    } else {
      this.render();
    }
  }

  closeForceAnswerModal() {
    const modal = document.getElementById("force-answer-modal");
    if (modal) {
      modal.remove();
    }
    this._modalSelectedLetters = null;
    this._modalQuestion = null;
    this._renderModalContent = null;
  }

  // =========================================================================
  // GESTIÓN DE EXPORTACIÓN E IMPORTACIÓN
  // =========================================================================

  exportBackup() {
    const jsonStr = store.exportStateJSON();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `estudia_aws_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast("Copia de seguridad exportada correctamente.", "success");
  }

  importBackup(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const res = store.importStateJSON(e.target.result);
      if (res.success) {
        this.showToast(res.message, "success");
        this.render();
      } else {
        this.showToast("Error al importar: " + res.error, "error");
      }
    };
    reader.readAsText(file);
  }

  // =========================================================================
  // SINCRONIZACIÓN EN LA NUBE (GOOGLE DRIVE / SHEETS 2-WAY SYNC)
  // =========================================================================

  getAppsScriptTemplate() {
    return `/**
 * BACKEND GOOGLE APPS SCRIPT - ESTUDIA AWS SAP-C02
 * Sincronización Manual y Automática con Google Sheets / Drive
 */

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var backupSheet = ss.getSheetByName("Backup_State") || ss.insertSheet("Backup_State");
  var lastRow = backupSheet.getLastRow();
  
  if (lastRow === 0) {
    return ContentService.createTextOutput(JSON.stringify({ empty: true, message: "Sin datos guardados aún" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  var values = backupSheet.getRange(1, 1, lastRow, 1).getValues();
  var jsonStr = values.map(function(r) { return r[0]; }).join("");
  
  return ContentService.createTextOutput(jsonStr)
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var backupSheet = ss.getSheetByName("Backup_State") || ss.insertSheet("Backup_State");
    var payload = e.postData.contents;
    
    backupSheet.clear();
    var chunkSize = 30000;
    var numChunks = Math.ceil(payload.length / chunkSize);
    var chunks = [];
    for (var i = 0; i < numChunks; i++) {
      chunks.push([payload.substr(i * chunkSize, chunkSize)]);
    }
    backupSheet.getRange(1, 1, chunks.length, 1).setValues(chunks);
    
    var data = JSON.parse(payload);
    var summarySheet = ss.getSheetByName("Resumen_Estudio") || ss.insertSheet("Resumen_Estudio");
    summarySheet.clear();
    
    summarySheet.appendRow(["ESTUDIA AWS SAP-C02", "ESTADÍSTICAS Y SINCRONIZACIÓN"]);
    summarySheet.appendRow(["Última Sincronización", new Date().toLocaleString("es-ES")]);
    summarySheet.appendRow(["Total Preguntas Respondidas", Object.keys(data.answers || {}).length]);
    
    if (data.stats) {
      summarySheet.appendRow(["Puntuación Neta Global", data.stats.netScore || 0]);
      summarySheet.appendRow(["Precisión (%)", (data.stats.accuracy || 0) + "%"]);
      summarySheet.appendRow(["Aciertos Totales", data.stats.totalCorrect || 0]);
      summarySheet.appendRow(["Fallos Registrados", data.stats.totalFailed || 0]);
      summarySheet.appendRow(["Preguntas en Duda", data.stats.totalDoubtful || 0]);
      summarySheet.appendRow(["Sesiones de Foco", ((data.focusStats || data.pomodoroStats) && (data.focusStats || data.pomodoroStats).completedSessions) || 0]);
      if (data.resolvedFailures) {
        summarySheet.appendRow(["Errores Consolidados/Superados", Object.keys(data.resolvedFailures).length]);
      }
      if (data.recallHistory) {
        summarySheet.appendRow(["Simulacros de Errores Realizados", data.recallHistory.length]);
      }
    }
    
    summarySheet.getRange("A1:B1").setFontWeight("bold").setBackground("#232f3e").setFontColor("#ff9900");
    summarySheet.setColumnWidth(1, 260);
    summarySheet.setColumnWidth(2, 220);
    
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "success", 
      message: "Progreso sincronizado en Google Sheets con éxito",
      timestamp: new Date().toISOString() 
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "error", 
      error: err.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;
  }

  openSyncModal() {
    try {
      const modal = document.getElementById("sync-modal");
      if (!modal) return;
      
      const input = document.getElementById("sync-url-input");
      if (input) {
        const currentUrl = (store.getGoogleSyncUrl ? store.getGoogleSyncUrl() : (store.settings && store.settings.googleSyncUrl)) || "";
        input.value = currentUrl;
      }
      
      const snippetEl = document.getElementById("apps-script-code-snippet");
      if (snippetEl) {
        snippetEl.textContent = this.getAppsScriptTemplate();
      }
      
      this.updateSyncModalStatus();
      modal.classList.remove("hidden");
      modal.classList.add("flex");
      modal.style.display = "flex";
      
      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      console.error("Error abriendo modal de sincronización:", err);
    }
  }

  closeSyncModal() {
    const modal = document.getElementById("sync-modal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    modal.style.display = "none";
  }

  updateSyncModalStatus() {
    try {
      const url = (store.getGoogleSyncUrl ? store.getGoogleSyncUrl() : (store.settings && store.settings.googleSyncUrl)) || "";
      const lastSync = (store.getLastCloudSync ? store.getLastCloudSync() : (store.settings && store.settings.lastCloudSync)) || null;
      const dot = document.getElementById("sync-status-dot");
      const label = document.getElementById("sync-status-label");
      const dateEl = document.getElementById("sync-last-date");

      if (!dot || !label || !dateEl) return;

      if (url && url.startsWith("http")) {
        dot.className = "w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse";
        label.textContent = "Google Sheet Vinculado";
        label.className = "font-bold text-emerald-300";
      } else {
        dot.className = "w-2.5 h-2.5 rounded-full bg-[#ff9900]";
        label.textContent = "Google Sheet no configurado";
        label.className = "font-bold text-slate-200";
      }

      if (lastSync) {
        const d = new Date(lastSync);
        dateEl.textContent = "Última sincronización: " + d.toLocaleDateString("es-ES") + " a las " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
      } else {
        dateEl.textContent = "Última sincronización: Nunca";
      }
    } catch (err) {
      console.warn("Error en updateSyncModalStatus:", err);
    }
  }

  saveGoogleSyncUrl() {
    const input = document.getElementById("sync-url-input");
    if (!input) return;
    const url = input.value.trim();
    if (!url) {
      this.showToast("Introduce una URL de sincronización.", "warning");
      return;
    }
    if (!url.startsWith("http")) {
      this.showToast("La URL debe comenzar con https://", "error");
      return;
    }
    if (url.includes("docs.google.com/spreadsheets")) {
      this.showToast("❌ Has pegado el enlace de la hoja (docs.google.com). Debes pegar la URL de la Web App de Apps Script (script.google.com/.../exec).", "error", 9000);
      return;
    }
    if (url.includes("/dev")) {
      this.showToast("⚠️ La URL termina en /dev. Debe terminar en /exec para permitir sincronización.", "warning", 8000);
    }
    if (store.setGoogleSyncUrl) {
      store.setGoogleSyncUrl(url);
    } else {
      if (!store.settings) store.settings = {};
      store.settings.googleSyncUrl = url;
      store.saveToStorage();
    }
    this.updateSyncModalStatus();
    this.showToast("URL de sincronización guardada correctamente.", "success");
  }

  copyAppsScriptCode() {
    const code = this.getAppsScriptTemplate();
    this.copyTextToClipboard(code, "Código Apps Script copiado al portapapeles.");
  }

  async syncUploadToGoogleSheet() {
    let url = (store.getGoogleSyncUrl ? store.getGoogleSyncUrl() : (store.settings && store.settings.googleSyncUrl)) || "";
    const input = document.getElementById("sync-url-input");
    if (!url && input && input.value.trim()) {
      url = input.value.trim();
      if (store.setGoogleSyncUrl) store.setGoogleSyncUrl(url);
      this.updateSyncModalStatus();
    }

    if (!url) {
      this.showToast("Debes introducir primero la URL de tu Google Apps Script abajo.", "warning");
      if (input) {
        input.focus();
        input.classList.add("ring-2", "ring-[#ff9900]");
        setTimeout(() => input.classList.remove("ring-2", "ring-[#ff9900]"), 2500);
      }
      return;
    }

    if (url.includes("docs.google.com/spreadsheets")) {
      this.showToast("❌ Has pegado la URL de la hoja (docs.google.com). Necesitas la URL de la Web App (script.google.com/.../exec).", "error", 9000);
      return;
    }

    const btn = document.getElementById("btn-sync-upload");
    const originalHTML = btn ? btn.innerHTML : "";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Subiendo a Google Sheets...</span>`;
      if (window.lucide) window.lucide.createIcons();
    }

    try {
      const payload = store.exportStateJSON();
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: payload,
        redirect: "follow"
      });

      const res = await resp.json();
      if (res.status === "success" || res.status === "ok") {
        if (store.setLastCloudSync) {
          store.setLastCloudSync(new Date().toISOString());
        }
        this.updateSyncModalStatus();
        this.showToast("¡Progreso guardado en tu Google Sheet con éxito!", "success");
        if (typeof confetti === "function") confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 } });
      } else {
        throw new Error(res.error || "Respuesta no esperada del script");
      }
    } catch (err) {
      console.error("Error subiendo a Google Sheets:", err);
      let errorMsg = "Error al sincronizar: " + (err.message || "Fallo de conexión");
      if (err.message && (err.message.toLowerCase().includes("fetch") || err.message.toLowerCase().includes("network"))) {
        errorMsg = "Error 'Failed to fetch': Comprueba que en Apps Script 'Quién tiene acceso' sea 'Cualquier usuario' (Anyone) y no 'Solo yo'.";
      }
      this.showToast(errorMsg, "error", 10000);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
        if (window.lucide) window.lucide.createIcons();
      }
    }
  }

  async syncDownloadFromGoogleSheet() {
    let url = (store.getGoogleSyncUrl ? store.getGoogleSyncUrl() : (store.settings && store.settings.googleSyncUrl)) || "";
    const input = document.getElementById("sync-url-input");
    if (!url && input && input.value.trim()) {
      url = input.value.trim();
      if (store.setGoogleSyncUrl) store.setGoogleSyncUrl(url);
      this.updateSyncModalStatus();
    }

    if (!url) {
      this.showToast("Debes introducir primero la URL de tu Google Apps Script abajo.", "warning");
      if (input) {
        input.focus();
        input.classList.add("ring-2", "ring-[#ff9900]");
        setTimeout(() => input.classList.remove("ring-2", "ring-[#ff9900]"), 2500);
      }
      return;
    }

    if (url.includes("docs.google.com/spreadsheets")) {
      this.showToast("❌ Has pegado la URL de la hoja (docs.google.com). Necesitas la URL de la Web App (script.google.com/.../exec).", "error", 9000);
      return;
    }

    const btn = document.getElementById("btn-sync-download");
    const originalHTML = btn ? btn.innerHTML : "";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Descargando de Drive...</span>`;
      if (window.lucide) window.lucide.createIcons();
    }

    try {
      const cacheBuster = (url.includes("?") ? "&" : "?") + "t=" + Date.now();
      const resp = await fetch(url + cacheBuster, {
        method: "GET",
        redirect: "follow"
      });
      const data = await resp.json();

      if (data.empty) {
        this.showToast("La hoja de Google Sheets está vacía aún. Sube tu progreso primero.", "info");
        return;
      }

      const importResult = store.importStateJSON(data);
      if (importResult.success) {
        if (store.setLastCloudSync) {
          store.setLastCloudSync(new Date().toISOString());
        }
        this.updateSyncModalStatus();
        this.showToast("¡Progreso y estadísticas recuperados desde Google Sheets!", "success");
        this.render();
      } else {
        throw new Error(importResult.error || "Formato de datos no compatible");
      }
    } catch (err) {
      console.error("Error descargando de Google Sheets:", err);
      let errorMsg = "Error al descargar: " + (err.message || "Fallo de conexión");
      if (err.message && (err.message.toLowerCase().includes("fetch") || err.message.toLowerCase().includes("network"))) {
        errorMsg = "Error 'Failed to fetch': Comprueba que la URL termine en /exec y que 'Quién tiene acceso' sea 'Cualquier usuario' (Anyone).";
      }
      this.showToast(errorMsg, "error", 10000);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
        if (window.lucide) window.lucide.createIcons();
      }
    }
  }

  // =========================================================================
  // RENDERIZADO GENERAL & VISTAS
  // =========================================================================

  render() {
    const container = document.getElementById("view-container");
    if (!container) return;

    if (typeof document !== "undefined" && document.body) {
      document.body.classList.toggle("view-test", this.currentView === "test");
    }

    if (this.currentView === "dashboard") {
      this.renderDashboard();
    } else if (this.currentView === "test") {
      this.renderTestView();
    } else if (this.currentView === "failures") {
      this.renderFailuresView();
    } else {
      this.currentView = "dashboard";
      this.renderDashboard();
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  renderFocusWidget(data) {
    return this.renderPomodoroWidget(data);
  }

  renderPomodoroWidget(data) {
    const el = document.getElementById("focus-display") || document.getElementById("pomodoro-display");
    if (el) {
      const modeLabel = data.mode === "focus" ? "Foco 35m" : "Descanso";
      const playIcon = data.isRunning ? "pause" : "play";

      el.innerHTML = `
        <div class="flex items-center gap-1.5 sm:gap-2.5 bg-[#0b121c]/90 border border-[#26354a] rounded-xl px-2.5 sm:px-3 py-1 sm:py-1.5 shadow-md ${data.isRunning && data.mode === 'focus' ? 'focus-active-pulse border-[#ff9900]/50' : ''}">
          <div class="flex flex-col">
            <div class="flex items-center gap-1.5">
              <span class="inline-block w-2 h-2 rounded-full ${data.isRunning ? 'bg-[#ff9900] animate-pulse' : 'bg-slate-500'}"></span>
              <span class="text-xs sm:text-sm font-mono font-bold tracking-tight text-white">${data.formatted}</span>
            </div>
            <span class="hidden sm:inline text-[9px] uppercase tracking-wider font-bold text-slate-400">${modeLabel}</span>
          </div>
          <div class="flex items-center gap-1">
            <button onclick="app.pomodoro.toggle()" class="p-1 sm:p-1.5 rounded-lg bg-[#1c283a] hover:bg-[#26354a] text-[#ff9900] transition" title="${data.isRunning ? 'Pausar Foco' : 'Iniciar Foco Intenso'}">
              <i data-lucide="${playIcon}" class="w-3.5 h-3.5"></i>
            </button>
            <button onclick="app.pomodoro.reset()" class="hidden sm:inline-flex p-1.5 rounded-lg bg-[#1c283a] hover:bg-[#26354a] text-slate-400 hover:text-slate-200 transition" title="Reiniciar">
              <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      `;
    }

    const testFocusBtn = document.getElementById("test-focus-btn") || document.getElementById("test-pomo-btn");
    if (testFocusBtn) {
      testFocusBtn.innerHTML = `
        <i data-lucide="${data.isRunning ? 'pause' : 'play'}" class="w-3.5 h-3.5 ${data.isRunning ? 'text-[#ff9900]' : ''}"></i>
        <span class="font-mono text-xs font-bold">${data.formatted}</span>
        <span class="hidden xl:inline text-[10px] uppercase font-semibold text-slate-400 ml-0.5">${data.mode === 'focus' ? 'Foco' : 'Descanso'}</span>
        <span class="key-badge ml-1 hidden lg:inline-flex">T</span>
      `;
      testFocusBtn.className = `flex items-center gap-1.5 text-xs font-semibold py-1.5 px-2.5 rounded-lg border transition ${data.isRunning ? 'bg-[#ff9900]/15 text-[#ff9900] border-[#ff9900]/50 focus-active-pulse' : 'bg-[#1c283a] text-slate-300 border-[#26354a] hover:text-white'}`;
      testFocusBtn.title = `${data.isRunning ? 'Pausar Foco Intenso' : 'Activar Foco Intenso Manualmente'} [T]`;
    }

    if (window.lucide) window.lucide.createIcons();
  }

  // =========================================================================
  // VISTA 1: DASHBOARD GENERAL (BLOQUES & MÉTRICAS AWS CLOUDSCAPE)
  // =========================================================================

  renderDashboard() {
    const container = document.getElementById("view-container");
    const stats = store.getGlobalStats();
    const blocks = store.getBlocksSummary();
    const recallCount = store.getRecallQuestions().length;
    const overallPct = Math.round((stats.answered / (stats.totalQuestions || 1)) * 100);

    container.innerHTML = `
      <div class="max-w-7xl mx-auto space-y-8 animate-fadeIn">
        
        <!-- Banner Principal Estilo AWS Console -->
        <div class="relative overflow-hidden bg-gradient-to-r from-[#161e2d] via-[#1c283a] to-[#161e2d] p-5 sm:p-7 rounded-2xl border border-[#26354a] shadow-2xl">
          <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#ff9900] via-[#ffad33] to-[#00a1c9]"></div>
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div class="space-y-1.5">
              <div class="flex items-center gap-2 text-[#ff9900] font-bold text-xs uppercase tracking-wider">
                <i data-lucide="award" class="w-4 h-4"></i>
                <span>AWS Certified Solutions Architect – Professional</span>
              </div>
              <h1 class="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Entrenamiento Intensivo <span class="text-[#ff9900] font-mono">SAP-C02</span>
              </h1>
              <p class="text-slate-300 text-xs sm:text-sm max-w-2xl">
                Validación instantánea pregunta a pregunta, copia directa con prompt para IA y repetición activa sobre base de fallos.
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full md:w-auto">
              <button onclick="app.openSyncModal()" class="flex-1 sm:flex-initial justify-center flex items-center gap-2 bg-[#00a1c9]/15 hover:bg-[#00a1c9]/25 text-[#38bdf8] border border-[#00a1c9]/40 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition shadow-sm">
                <i data-lucide="cloud" class="w-4 h-4 text-[#38bdf8]"></i>
                <span>Drive Sync</span>
              </button>

              <button onclick="app.openIngestModal()" class="flex-1 sm:flex-initial justify-center flex items-center gap-2 bg-[#1c283a] hover:bg-[#26354a] text-slate-200 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold border border-[#26354a] transition shadow-sm">
                <i data-lucide="upload-cloud" class="w-4 h-4 text-[#ff9900]"></i>
                <span>Cargar Dump</span>
              </button>

              <button onclick="app.startRecallSession()" class="w-full sm:w-auto justify-center flex items-center gap-2 ${recallCount > 0 ? 'btn-aws-primary' : 'bg-[#1c283a] text-slate-400 border border-[#26354a]'} px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition">
                <i data-lucide="flame" class="w-4 h-4"></i>
                <span>Active Recall (${recallCount})</span>
              </button>
            </div>
          </div>

          <!-- Barra de Progreso Global del Banco -->
          <div class="mt-5 pt-4 border-t border-[#26354a]/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div class="flex items-center gap-3 text-slate-300">
              <span class="font-bold text-white">Progreso Global: ${stats.answered} / ${stats.totalQuestions} preguntas (${overallPct}%)</span>
              <span class="text-slate-500">•</span>
              <span class="text-emerald-400 font-semibold">${stats.correct} aciertos</span>
              <span class="text-slate-500">•</span>
              <span class="text-rose-400 font-semibold">${stats.failed} fallos</span>
            </div>
            <div class="w-full sm:w-64 bg-[#0b121c] h-2 rounded-full overflow-hidden border border-[#26354a]">
              <div class="bg-gradient-to-r from-[#ff9900] to-emerald-400 h-full rounded-full transition-all duration-500" style="width: ${overallPct}%"></div>
            </div>
          </div>
        </div>

        <!-- Tarjetas de Métricas de Examen Oficial -->
        <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <!-- Total Preguntas -->
          <div class="aws-card p-4 rounded-xl border-t-2 border-t-[#ff9900]">
            <div class="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
              <span>Banco Total</span>
              <i data-lucide="layers" class="w-4 h-4 text-[#ff9900]"></i>
            </div>
            <div class="mt-2 text-2xl sm:text-3xl font-black text-white font-mono">
              ${stats.totalQuestions}
            </div>
            <div class="text-xs text-slate-400 mt-1">
              ${stats.answered} validadas (${overallPct}%)
            </div>
          </div>

          <!-- Precisión Bruta -->
          <div class="aws-card p-4 rounded-xl border-t-2 border-t-emerald-500">
            <div class="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
              <span>Precisión Actual</span>
              <i data-lucide="target" class="w-4 h-4 text-emerald-400"></i>
            </div>
            <div class="mt-2 text-2xl sm:text-3xl font-black ${stats.accuracy >= 75 ? 'text-emerald-400' : 'text-[#ff9900]'} font-mono">
              ${stats.accuracy}%
            </div>
            <div class="text-xs text-slate-400 mt-1">
              Meta SAP-C02: ≥ 75%
            </div>
          </div>

          <!-- Puntuación Neta -->
          <div class="aws-card p-4 rounded-xl border-t-2 border-t-[#00a1c9]">
            <div class="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
              <span>Puntuación Neta</span>
              <i data-lucide="award" class="w-4 h-4 text-[#38bdf8]"></i>
            </div>
            <div class="mt-2 text-2xl sm:text-3xl font-black text-[#38bdf8] font-mono">
              ${stats.netScore}
            </div>
            <div class="text-xs text-slate-400 mt-1" title="Fórmula oficial: Aciertos - (Fallos / 3)">
              Aciertos - (Fallos / 3)
            </div>
          </div>

          <!-- Base de Fallos (Rojas) -->
          <div class="aws-card p-4 rounded-xl border-t-2 border-t-rose-500 cursor-pointer hover:border-rose-500/50 transition" onclick="app.navigate('failures')">
            <div class="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
              <span>Base de Fallos</span>
              <i data-lucide="alert-triangle" class="w-4 h-4 text-rose-400"></i>
            </div>
            <div class="mt-2 text-2xl sm:text-3xl font-black text-rose-400 font-mono">
              ${stats.totalFailuresInDb}
            </div>
            <div class="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <span>Pendientes de repaso</span>
              <i data-lucide="arrow-right" class="w-3 h-3 text-rose-400"></i>
            </div>
          </div>

          <!-- Sesiones de Enfoque (Foco Intenso) -->
          <div class="col-span-2 lg:col-span-1 aws-card p-4 rounded-xl border-t-2 border-t-amber-400">
            <div class="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
              <span>Foco Intenso</span>
              <i data-lucide="clock" class="w-4 h-4 text-[#ff9900]"></i>
            </div>
            <div class="mt-2 text-2xl sm:text-3xl font-black text-[#ff9900] font-mono">
              ${stats.completedFocusSessions || stats.completedPomodoros} <span class="text-sm font-normal text-slate-400">sesiones</span>
            </div>
            <div class="text-xs text-slate-400 mt-1">
              ${stats.totalFocusMinutes} min acumulados
            </div>
          </div>
        </div>

        <!-- Grid de Sesiones / Bloques de Entrenamiento (25 Preguntas Cada Una) -->
        <div>
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 class="text-xl font-black text-white tracking-tight flex items-center gap-2">
                <i data-lucide="layout-grid" class="w-5 h-5 text-[#ff9900]"></i>
                <span>Bloques de Entrenamiento (25 Preguntas por Bloque)</span>
              </h2>
              <p class="text-xs text-slate-400 mt-0.5">
                Valida cada pregunta al instante, consulta el consenso de la comunidad y copia cualquier pregunta con 1 clic para analizarla en tu IA.
              </p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            ${blocks.map(b => this.renderBlockCard(b)).join("")}
          </div>
        </div>

      </div>
    `;
  }

  renderBlockCard(b) {
    const statusStyles = {
      completed: "border-emerald-500/50 bg-[#141d2b]",
      in_progress: "border-[#ff9900]/60 bg-[#141d2b] shadow-lg shadow-[#ff9900]/5",
      pending: "border-[#26354a] bg-[#141d2b]/80"
    }[b.status];

    const statusBadge = {
      completed: `<span class="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase">Completado</span>`,
      in_progress: `<span class="bg-[#ff9900]/15 text-[#ff9900] border border-[#ff9900]/40 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase">En Curso</span>`,
      pending: `<span class="bg-[#1c283a] text-slate-400 border border-[#26354a] text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase">Pendiente</span>`
    }[b.status];

    const correctPct = b.total > 0 ? (b.correct / b.total) * 100 : 0;
    const failedPct = b.total > 0 ? (b.failed / b.total) * 100 : 0;

    return `
      <div class="aws-card-interactive flex flex-col justify-between border ${statusStyles} rounded-2xl p-4 sm:p-5">
        <div>
          <div class="flex items-center justify-between mb-2.5">
            <span class="text-xs font-mono font-bold text-[#ff9900]">BLOQUE ${String(b.blockNumber).padStart(2, "0")}</span>
            ${statusBadge}
          </div>
          
          <h3 class="text-base font-extrabold text-white mb-3 flex items-center justify-between">
            <span>Sesión ${b.blockNumber}</span>
            <span class="text-slate-400 font-mono text-xs font-semibold bg-[#0b121c] px-2 py-0.5 rounded-lg border border-[#26354a]">${b.rangeLabel}</span>
          </h3>

          <!-- Píldoras de Estadísticas del Bloque -->
          <div class="grid grid-cols-3 gap-1.5 mb-3 text-center">
            <div class="bg-[#0b121c]/80 border border-[#26354a] rounded-xl py-1.5 px-2">
              <span class="text-[10px] text-slate-400 block">Aciertos</span>
              <span class="text-xs font-mono font-bold text-emerald-400">${b.correct}</span>
            </div>
            <div class="bg-[#0b121c]/80 border border-[#26354a] rounded-xl py-1.5 px-2">
              <span class="text-[10px] text-slate-400 block">Fallos</span>
              <span class="text-xs font-mono font-bold text-rose-400">${b.failed}</span>
            </div>
            <div class="bg-[#0b121c]/80 border border-[#26354a] rounded-xl py-1.5 px-2">
              <span class="text-[10px] text-slate-400 block">Precisión</span>
              <span class="text-xs font-mono font-bold ${b.answered > 0 ? (b.accuracy >= 75 ? 'text-emerald-400' : 'text-[#ff9900]') : 'text-slate-500'}">${b.answered > 0 ? b.accuracy + '%' : '—'}</span>
            </div>
          </div>

          <!-- Barra de Progreso Segmentada del Bloque -->
          <div class="space-y-1.5 mb-4">
            <div class="flex justify-between text-[11px] text-slate-400">
              <span>Validadas: <strong class="text-slate-200 font-mono">${b.answered}/${b.total}</strong></span>
              ${b.answered > 0 ? `<span class="font-mono font-semibold text-[#38bdf8]">Neto: ${b.netScore}</span>` : `<span class="text-slate-500">Sin empezar</span>`}
            </div>
            <div class="w-full bg-[#0b121c] h-2 rounded-full overflow-hidden flex border border-[#26354a]/80">
              <div class="bg-emerald-500 h-full transition-all duration-500" style="width: ${correctPct}%"></div>
              <div class="bg-rose-500 h-full transition-all duration-500" style="width: ${failedPct}%"></div>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 pt-3 border-t border-[#26354a]/80">
          <button onclick="app.startBlockSession(${b.blockNumber})" class="flex-1 flex items-center justify-center gap-1.5 ${b.status === 'completed' ? 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold' : 'btn-aws-primary'} py-2.5 px-3 rounded-xl text-xs transition">
            <i data-lucide="${b.status === 'completed' ? 'rotate-cw' : 'play'}" class="w-3.5 h-3.5"></i>
            <span>${b.status === 'completed' ? 'Repasar Bloque' : (b.status === 'in_progress' ? `Continuar (${b.answered}/${b.total})` : 'Empezar Bloque')}</span>
          </button>

          ${b.answered > 0 ? `
            <button onclick="app.confirmResetBlock(${b.blockNumber})" class="p-2.5 rounded-xl bg-[#1c283a] hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-[#26354a] hover:border-rose-500/40 transition" title="Reiniciar Bloque desde cero">
              <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  // =========================================================================
  // VISTA 2: SIMULADOR DE TEST (VALIDACIÓN INSTANTÁNEA & COPIA RÁPIDA IA)
  // =========================================================================

  renderTestView() {
    const container = document.getElementById("view-container");
    if (!container || this.activeSession.questions.length === 0) return;

    const q = this.activeSession.questions[this.activeSession.currentIndex];
    const totalQ = this.activeSession.questions.length;
    const qId = String(q.id);
    const isBlock = this.activeSession.type === "block";

    const sessionAns = this.activeSession.sessionAnswers ? this.activeSession.sessionAnswers[qId] : null;
    const existingAnswer = sessionAns;
    const answeredSelected = sessionAns ? (sessionAns.selected || []) : [];
    const isGraded = !!(sessionAns && typeof sessionAns.isCorrect === "boolean");
    const isDoubt = store.isDoubt(q.id);
    const userMnemonic = store.getMnemonic(q.id);

    const isMulti = (q.multiSelectCount || 1) > 1;
    const choicesEntries = Object.entries(q.choices || {});
    const effectiveCorrect = store.getEffectiveCorrectAnswer(q);
    const effectiveCorrectLetters = (effectiveCorrect || "").split("");
    const hasCustomOverride = store.hasCustomCorrectAnswer(q.id);
    const commVoteAns = store.getCommunityVoteAnswer(q);
    const officialAns = store.getOfficialAnswer(q);

    container.innerHTML = `
      <div class="max-w-4xl mx-auto space-y-4 pb-20 animate-fadeIn">
        
        <!-- Barra de Control del Test (Header Estilo AWS) -->
        <div class="test-header-bar flex items-center justify-between bg-[#161e2d]/95 border border-[#26354a] p-2.5 sm:p-3.5 rounded-2xl shadow-xl sticky top-2 sm:top-3 z-30 backdrop-blur-md">
          <div class="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 mr-2">
            <button onclick="app.navigate('${this.activeSession.type === 'single' ? 'failures' : 'dashboard'}')" class="flex-shrink-0 flex items-center gap-1.5 text-slate-300 hover:text-white text-xs font-bold p-2 sm:px-3 sm:py-1.5 rounded-xl bg-[#1c283a] hover:bg-[#26354a] border border-[#26354a] transition" title="Volver">
              <i data-lucide="arrow-left" class="w-4 h-4 sm:w-3.5 sm:h-3.5 text-[#ff9900]"></i>
              <span class="hidden sm:inline">${this.activeSession.type === 'single' ? 'Fallos' : 'Dashboard'}</span>
            </button>

            <div class="flex flex-col min-w-0">
              <div class="flex items-center gap-1.5 sm:gap-2">
                <span class="text-xs sm:text-sm font-extrabold text-white tracking-tight truncate">${this.activeSession.title}</span>
              </div>
              <span class="text-[10px] sm:text-[11px] text-slate-400 truncate">
                Pregunta <strong class="text-[#ff9900] font-mono">${this.activeSession.currentIndex + 1}</strong> de ${totalQ} ${isMulti ? `• <span class="text-[#38bdf8] font-semibold">Elige ${q.multiSelectCount} opciones</span>` : ''}
              </span>
            </div>
          </div>

          <div class="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <!-- Botón Copiar Rápido para IA (Siempre visible en cabecera del test) -->
            <button onclick="app.copyQuestionForAI('${q.id}', this)" class="flex items-center gap-1.5 text-xs font-bold py-1.5 px-2.5 sm:px-3 rounded-xl bg-[#00a1c9]/15 hover:bg-[#00a1c9]/25 text-[#38bdf8] border border-[#00a1c9]/40 transition shadow-sm" title="Copiar Pregunta y Respuesta al portapapeles para pegar en IA [K]">
              <i data-lucide="sparkles" class="w-3.5 h-3.5 text-[#ff9900]"></i>
              <span class="hidden sm:inline">Copiar para IA</span>
              <span class="sm:hidden">IA</span>
            </button>

            <!-- Botón de Duda (Amarilla) -->
            <button onclick="app.toggleCurrentDoubt()" class="flex items-center gap-1 text-xs font-bold py-1.5 px-2.5 sm:px-3 rounded-xl border transition ${isDoubt ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' : 'bg-[#1c283a] text-slate-300 border-[#26354a] hover:text-white'}" title="Marcar como Dudosa [D]">
              <i data-lucide="bookmark" class="w-3.5 h-3.5 ${isDoubt ? 'text-amber-400 fill-amber-400' : ''}"></i>
              <span class="hidden md:inline">${isDoubt ? 'En Duda' : 'Duda'}</span>
            </button>

            <!-- Botón Resumen / Finalizar -->
            ${this.activeSession.type !== 'single' ? `
              <button onclick="app.requestFinishSession()" class="flex items-center gap-1 text-xs font-bold py-1.5 px-2.5 sm:px-3 rounded-xl bg-[#1c283a] hover:bg-[#26354a] text-slate-200 border border-[#26354a] transition" title="Ver Resumen de la Sesión">
                <i data-lucide="bar-chart-2" class="w-3.5 h-3.5 text-[#ff9900]"></i>
                <span class="hidden sm:inline">Resumen</span>
              </button>
            ` : ''}

            <!-- Botón Reiniciar Bloque (solo sm+) -->
            ${isBlock ? `
              <button onclick="app.confirmResetBlock(${this.activeSession.blockNumber})" class="hidden lg:flex items-center gap-1 text-xs font-semibold py-1.5 px-2.5 rounded-xl bg-[#1c283a] hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-[#26354a] transition" title="Reiniciar este Bloque desde cero">
                <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
              </button>
            ` : ''}

            <!-- Modo Zen -->
            <button onclick="app.toggleZenMode()" class="p-1.5 sm:p-2 rounded-xl bg-[#1c283a] hover:bg-[#26354a] text-slate-400 hover:text-white border border-[#26354a] transition" title="Modo Zen [Z]">
              <i data-lucide="${store.settings.zenMode ? 'minimize-2' : 'maximize-2'}" class="w-3.5 h-3.5 sm:w-4 sm:h-4"></i>
            </button>
          </div>
        </div>

        <!-- Selector Compacto de Preguntas del Bloque -->
        ${totalQ > 1 ? `
          <div class="flex items-center justify-center w-full overflow-hidden px-1">
            <div class="inline-flex flex-wrap items-center justify-center gap-1 bg-[#141d2b] border border-[#26354a] px-2.5 py-1.5 rounded-xl shadow-md max-w-full">
              ${this.activeSession.questions.map((item, idx) => {
                const itemAns = this.activeSession.sessionAnswers ? this.activeSession.sessionAnswers[String(item.id)] : null;
                const itemGraded = !!(itemAns && typeof itemAns.isCorrect === "boolean");
                const itemDoubt = store.isDoubt(item.id);
                const isCurrent = idx === this.activeSession.currentIndex;

                let dotColor = "bg-[#1c283a] text-slate-400 border-[#26354a] hover:text-white hover:border-slate-500";
                if (itemGraded) {
                  if (itemAns.isCorrect) dotColor = "bg-emerald-600/80 border-emerald-500 text-white font-bold";
                  else dotColor = "bg-rose-600/80 border-rose-500 text-white font-bold";
                } else if (itemDoubt) {
                  dotColor = "bg-amber-500/30 border-amber-500/70 text-amber-300 font-bold";
                }

                return `
                  <button onclick="app.jumpToQuestion(${idx})" class="w-6 h-6 rounded-md text-[10px] font-mono flex items-center justify-center border transition-all ${dotColor} ${isCurrent ? 'ring-2 ring-[#ff9900] scale-110 z-10 font-black !bg-[#ff9900] !border-[#ff9900] !text-[#0f141a] shadow-sm' : ''}" title="Ir a pregunta ${idx + 1}">
                    ${idx + 1}
                  </button>
                `;
              }).join("")}
            </div>
          </div>
        ` : ''}

        <!-- Tarjeta Central de la Pregunta (Estilo AWS Cloudscape) -->
        <div class="aws-card rounded-2xl sm:rounded-3xl p-4 sm:p-8 space-y-5 border border-[#26354a]">
          
          <!-- Encabezado de Pregunta -->
          <div class="flex items-center justify-between text-xs text-slate-400 pb-3.5 border-b border-[#26354a] flex-wrap gap-2">
            <div class="flex items-center gap-2">
              <span class="font-mono font-black text-[#0f141a] bg-[#ff9900] px-2.5 py-0.5 rounded-md text-xs uppercase tracking-wider">Q#${q.questionNumber}</span>
              <span class="bg-[#1c283a] text-slate-300 border border-[#26354a] px-2.5 py-0.5 rounded-md text-[11px] font-mono">Bloque ${q.blockNumber}</span>
              <span class="bg-[#0b121c] text-slate-400 border border-[#26354a] px-2.5 py-0.5 rounded-md text-[11px] font-medium">
                ${isMulti ? `Selección múltiple (${q.multiSelectCount})` : 'Selección única'}
              </span>
            </div>

            <div class="flex items-center gap-2">
              ${isGraded && q.communityVote ? `
                <span class="bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-semibold">
                  Comunidad: ${q.communityVote}
                </span>
              ` : ''}
              <button onclick="app.copyQuestionForAI('${q.id}', this)" class="text-[11px] font-bold text-[#38bdf8] hover:text-white bg-[#0b121c] hover:bg-[#1c283a] border border-[#26354a] px-2.5 py-1 rounded-lg transition flex items-center gap-1.5" title="Copiar enunciado, opciones y respuesta para pegar en ChatGPT / Claude / Gemini [K]">
                <i data-lucide="copy" class="w-3 h-3 text-[#ff9900]"></i>
                <span>Copiar Pregunta + Respuesta (IA)</span>
              </button>
            </div>
          </div>

          <!-- Enunciado de la Pregunta con Resaltado Inteligente -->
          <div class="question-body text-slate-100 text-base sm:text-lg">
            ${Highlighter.highlight(q.question)}
          </div>

          <!-- Opciones de Respuesta A, B, C, D... -->
          <div class="space-y-3 pt-1">
            ${choicesEntries.map(([letter, text]) => {
              const isSelected = isGraded
                ? answeredSelected.includes(letter)
                : this.activeSession.userSelected.includes(letter);
              const isEffectiveCorrect = effectiveCorrectLetters.includes(letter);
              let optionClass = "border-[#26354a] bg-[#0b121c]/70 hover:bg-[#1c283a]/90 hover:border-[#3b506e] text-slate-200";

              if (isGraded) {
                if (isEffectiveCorrect) {
                  optionClass = "border-emerald-500/80 bg-emerald-950/35 text-emerald-50 ring-1 ring-emerald-500/50 option-correct-anim";
                } else if (isSelected && !isEffectiveCorrect) {
                  optionClass = "border-rose-500/80 bg-rose-950/35 text-rose-100 ring-1 ring-rose-500/50 option-wrong-anim";
                } else {
                  optionClass = "border-[#26354a]/50 bg-[#0b121c]/40 text-slate-400 opacity-65";
                }
              } else if (isSelected) {
                optionClass = "border-[#ff9900] bg-[#ff9900]/10 text-white ring-2 ring-[#ff9900]/40 shadow-md";
              }

              const badgeColor = isSelected
                ? (isGraded && isEffectiveCorrect
                    ? 'bg-emerald-500 text-[#0f141a]'
                    : (isGraded && !isEffectiveCorrect ? 'bg-rose-500 text-white' : 'bg-[#ff9900] text-[#0f141a]'))
                : (isGraded && isEffectiveCorrect
                    ? 'bg-emerald-500 text-[#0f141a]'
                    : 'bg-[#1c283a] text-slate-300 border border-[#26354a]');

              return `
                <div onclick="app.toggleOptionSelection('${letter}')" class="flex items-start gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-2xl border ${optionClass} ${isGraded ? 'cursor-default' : 'cursor-pointer'} transition-all">
                  <div class="flex-shrink-0 pt-0.5">
                    <span class="w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-black ${badgeColor}">
                      ${letter}
                    </span>
                  </div>
                  <div class="flex-1 text-sm sm:text-base leading-relaxed">
                    ${Highlighter.highlight(text)}
                    ${isGraded && isEffectiveCorrect && hasCustomOverride ? '<span class="ml-2 inline-flex items-center gap-1 text-[11px] text-[#ff9900] font-bold bg-[#ff9900]/15 px-2 py-0.5 rounded border border-[#ff9900]/40">✓ Personalizada</span>' : ''}
                    ${isGraded && isEffectiveCorrect && !hasCustomOverride && commVoteAns && commVoteAns !== officialAns ? '<span class="ml-2 inline-flex items-center gap-1 text-[11px] text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">✓ Consenso comunidad</span>' : ''}
                  </div>
                  ${isGraded && isEffectiveCorrect ? '<i data-lucide="check-circle-2" class="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5"></i>' : ''}
                  ${isGraded && isSelected && !isEffectiveCorrect ? '<i data-lucide="x-circle" class="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5"></i>' : ''}
                </div>
              `;
            }).join("")}
          </div>

          <!-- Barra de Acción: Validar Pregunta / Siguiente Pregunta -->
          <div class="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#26354a]">
            <div class="text-xs text-slate-400 hidden sm:flex items-center gap-2">
              <span class="key-badge">1-6</span> elegir
              <span class="key-badge">Enter</span> ${isGraded ? 'siguiente' : 'validar'}
              <span class="key-badge">K</span> copiar IA
            </div>

            <div class="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              ${this.activeSession.currentIndex > 0 ? `
                <button onclick="app.prevQuestion()" class="flex items-center gap-1.5 bg-[#1c283a] hover:bg-[#26354a] text-slate-200 border border-[#26354a] px-4 py-2.5 rounded-xl text-xs font-bold transition" title="Pregunta anterior [←]">
                  <i data-lucide="arrow-left" class="w-4 h-4"></i>
                  <span>Anterior</span>
                </button>
              ` : ''}

              ${!isGraded ? `
                <button onclick="app.confirmAnswer()" ${this.activeSession.userSelected.length === 0 ? 'disabled' : ''} class="btn-aws-primary flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm">
                  <i data-lucide="check-circle" class="w-4 h-4"></i>
                  <span>Validar Pregunta</span>
                </button>
                ${this.activeSession.currentIndex < totalQ - 1 ? `
                  <button onclick="app.nextQuestion()" class="flex items-center gap-1 bg-[#1c283a] hover:bg-[#26354a] text-slate-300 border border-[#26354a] px-3.5 py-2.5 rounded-xl text-xs font-bold transition" title="Saltar sin validar [→]">
                    <span class="hidden sm:inline">Saltar</span>
                    <i data-lucide="arrow-right" class="w-4 h-4"></i>
                  </button>
                ` : ''}
              ` : `
                <button onclick="app.retryCurrentQuestion()" class="flex items-center gap-1.5 bg-[#1c283a] hover:bg-[#26354a] text-slate-300 border border-[#26354a] px-3.5 py-2.5 rounded-xl text-xs font-bold transition" title="Volver a responder esta pregunta">
                  <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                  <span class="hidden sm:inline">Reintentar</span>
                </button>

                ${this.activeSession.currentIndex < totalQ - 1 ? `
                  <button onclick="app.nextQuestion()" class="btn-aws-primary flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm">
                    <span>Siguiente Pregunta</span>
                    <i data-lucide="arrow-right" class="w-4 h-4"></i>
                  </button>
                ` : `
                  <button onclick="app.requestFinishSession()" class="btn-aws-primary flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm">
                    <i data-lucide="award" class="w-4 h-4"></i>
                    <span>${this.activeSession.type === 'single' ? 'Volver a Base de Fallos' : 'Ver Resumen Final'}</span>
                  </button>
                `}
              `}
            </div>
          </div>

          <!-- Panel de Respuesta Validada, Copia para IA y Nota Técnica -->
          ${isGraded ? this.renderAnswerFeedback(q, existingAnswer, userMnemonic) : ''}

        </div>

      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  }

  renderAnswerFeedback(q, answer, userMnemonic) {
    const isCorrect = answer.isCorrect;
    const effectiveCorrect = store.getEffectiveCorrectAnswer(q);
    const hasCustomOverride = store.hasCustomCorrectAnswer(q.id);
    const commVoteAns = store.getCommunityVoteAnswer(q);
    const officialAns = store.getOfficialAnswer(q);
    const userSelectedStr = (answer.selected || []).join("");

    return `
      <div class="mt-6 p-5 sm:p-6 rounded-2xl border ${isCorrect ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-rose-500/50 bg-rose-950/20'} space-y-5 animate-fadeIn">
        
        <!-- Encabezado de Estado de Respuesta + Botón Copiar para IA -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b ${isCorrect ? 'border-emerald-500/30' : 'border-rose-500/30'}">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isCorrect ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'}">
              <i data-lucide="${isCorrect ? 'check-circle-2' : 'alert-triangle'}" class="w-5 h-5"></i>
            </div>
            <div>
              <h4 class="text-base font-black ${isCorrect ? 'text-emerald-300' : 'text-rose-300'}">
                ${isCorrect ? '¡Respuesta Correcta!' : `Respuesta Incorrecta (Marcaste ${userSelectedStr || 'ninguna'})`}
              </h4>
              <span class="text-xs text-slate-300">
                La respuesta válida es la opción <strong class="text-emerald-400 font-mono text-sm">${effectiveCorrect}</strong>
              </span>
            </div>
          </div>

          <!-- Botón Destacado: Copiar Pregunta y Respuesta para IA -->
          <button onclick="app.copyQuestionForAI('${q.id}', this)" class="flex items-center justify-center gap-2 bg-[#ff9900] hover:bg-[#ffac31] text-[#0f141a] font-extrabold px-4 py-2.5 rounded-xl text-xs transition shadow-md">
            <i data-lucide="sparkles" class="w-4 h-4"></i>
            <span>Copiar Pregunta y Respuesta para IA</span>
          </button>
        </div>

        <!-- Consenso de la Comunidad & Selector de Respuesta Forzada -->
        <div class="flex flex-wrap items-center justify-between gap-3 bg-[#0b121c]/90 p-4 rounded-xl border border-[#26354a]">
          <div class="space-y-1">
            <div class="flex items-center gap-2 text-xs">
              <span class="text-slate-400 font-semibold">Criterio de Corrección:</span>
              <span class="font-mono text-sm font-black ${isCorrect ? 'text-emerald-400' : 'text-[#ff9900]'} bg-[#141d2b] px-2.5 py-0.5 rounded-lg border border-[#26354a]">
                ${effectiveCorrect}
              </span>
              ${hasCustomOverride ? `
                <span class="bg-[#ff9900]/20 text-[#ff9900] border border-[#ff9900]/40 text-[10px] font-bold px-2 py-0.5 rounded-md">
                  Personalizada por ti
                </span>
              ` : (commVoteAns ? `
                <span class="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-md">
                  Consenso Comunidad
                </span>
              ` : `
                <span class="bg-[#1c283a] text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-md">
                  Clave Oficial
                </span>
              `)}
            </div>
            <div class="text-[11px] text-slate-400 flex items-center gap-3">
              <span>Voto Comunidad: <strong class="font-mono text-emerald-400">${commVoteAns || 'N/A'}</strong> ${q.communityVote ? `(${q.communityVote})` : ''}</span>
              <span>•</span>
              <span>Clave Oficial Dump: <strong class="font-mono text-slate-200">${officialAns}</strong></span>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button onclick="app.openForceAnswerModal('${q.id}')" class="flex items-center gap-1.5 bg-[#1c283a] hover:bg-[#26354a] text-slate-200 border border-[#26354a] px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm">
              <i data-lucide="sliders" class="w-3.5 h-3.5 text-[#ff9900]"></i>
              <span>Cambiar / Forzar Respuesta Válida</span>
            </button>
            ${hasCustomOverride ? `
              <button onclick="app.resetForcedAnswer('${q.id}')" class="text-xs text-slate-400 hover:text-rose-400 underline transition px-2 py-1">
                Restablecer
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Bloque de Nota Técnica Personal -->
        <div class="bg-[#0b121c]/80 border border-[#26354a] p-4 rounded-xl space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 text-[#ff9900] font-bold text-xs uppercase tracking-wider">
              <i data-lucide="edit-3" class="w-4 h-4"></i>
              <span>Nota Técnica Personal & Regla de Descarte</span>
            </div>
            <span class="text-[11px] text-slate-400">Guardada en Q#${q.questionNumber}</span>
          </div>

          <div class="flex flex-col sm:flex-row gap-2">
            <input id="mnemonic-input" type="text" placeholder="Anota tu resumen o pega aquí la clave que te dio la IA para esta pregunta..." value="${userMnemonic ? userMnemonic.text : ''}" class="flex-1 bg-[#141d2b] border border-[#26354a] rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#ff9900]">
            <button onclick="app.saveCurrentMnemonic(document.getElementById('mnemonic-input').value)" class="bg-[#1c283a] hover:bg-[#26354a] text-[#ff9900] border border-[#ff9900]/40 text-xs font-bold px-4 py-2 rounded-xl transition flex items-center justify-center gap-1.5">
              <i data-lucide="save" class="w-3.5 h-3.5"></i>
              <span>Guardar Nota</span>
            </button>
          </div>
        </div>

      </div>
    `;
  }

  // =========================================================================
  // VISTA 3: BASE DE DATOS DE FALLOS (PREGUNTAS ROJAS & AMARILLAS)
  // =========================================================================

  renderFailuresView() {
    const container = document.getElementById("view-container");
    const failures = Object.values(store.failures);
    const resolvedFailures = Object.values(store.resolvedFailures || {});
    const recallHistory = store.recallHistory || [];
    const doubts = Object.keys(store.doubts);

    container.innerHTML = `
      <div class="max-w-7xl mx-auto space-y-8 animate-fadeIn">
        
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 aws-card p-5 sm:p-6 rounded-2xl border-t-2 border-t-rose-500">
          <div>
            <div class="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider mb-1">
              <i data-lucide="alert-octagon" class="w-4 h-4"></i>
              <span>Gestión de Errores & Active Recall</span>
            </div>
            <h1 class="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Base de Datos de Fallos <span class="text-rose-400 font-mono">(${failures.length} Pendientes, ${resolvedFailures.length} Superados)</span>
            </h1>
            <p class="text-slate-400 text-sm mt-1">
              Repasa tus preguntas falladas, cópialas con un clic para analizarlas en IA o lanza un simulacro dinámico de consolidación.
            </p>
          </div>

          <div class="flex items-center gap-3 w-full sm:w-auto">
            <button onclick="app.startRecallSession()" ${failures.length === 0 && doubts.length === 0 ? 'disabled' : ''} class="btn-aws-primary w-full sm:w-auto justify-center flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm">
              <i data-lucide="flame" class="w-4 h-4"></i>
              <span>Practicar Fallos y Dudas (${failures.length + doubts.length})</span>
            </button>
          </div>
        </div>

        <!-- Métricas Rápidas de Consolidación -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="aws-card p-4 rounded-2xl flex items-center gap-3.5">
            <div class="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
              <i data-lucide="alert-circle" class="w-5 h-5"></i>
            </div>
            <div>
              <span class="text-xs text-slate-400 block font-semibold">Errores Pendientes</span>
              <span class="text-2xl font-black text-rose-400 font-mono">${failures.length}</span>
            </div>
          </div>

          <div class="aws-card p-4 rounded-2xl flex items-center gap-3.5">
            <div class="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <i data-lucide="check-circle" class="w-5 h-5"></i>
            </div>
            <div>
              <span class="text-xs text-slate-400 block font-semibold">Errores Consolidados</span>
              <span class="text-2xl font-black text-emerald-400 font-mono">${resolvedFailures.length}</span>
            </div>
          </div>

          <div class="aws-card p-4 rounded-2xl flex items-center gap-3.5">
            <div class="w-10 h-10 rounded-xl bg-[#ff9900]/20 text-[#ff9900] flex items-center justify-center border border-[#ff9900]/30">
              <i data-lucide="history" class="w-5 h-5"></i>
            </div>
            <div>
              <span class="text-xs text-slate-400 block font-semibold">Simulacros Ejecutados</span>
              <span class="text-2xl font-black text-[#ff9900] font-mono">${recallHistory.length}</span>
            </div>
          </div>
        </div>

        <!-- Lista de Preguntas Falladas -->
        ${failures.length === 0 ? `
          <div class="text-center py-16 aws-card rounded-2xl">
            <i data-lucide="check-circle-2" class="w-12 h-12 text-emerald-400 mx-auto mb-3"></i>
            <h3 class="text-lg font-bold text-white">${resolvedFailures.length > 0 ? '¡Todos los Errores Han Sido Consolidados!' : '¡Base de Fallos Vacía!'}</h3>
            <p class="text-sm text-slate-400 max-w-md mx-auto mt-1">
              ${resolvedFailures.length > 0 ? `Has superado con éxito ${resolvedFailures.length} preguntas en tus repasos.` : 'No tienes preguntas registradas en la base de fallos. Sigue practicando los bloques.'}
            </p>
          </div>
        ` : `
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${failures.map(f => {
              const q = store.questions.find(item => String(item.id) === String(f.questionId));
              const mnemonic = store.getMnemonic(f.questionId);
              if (!q) return "";
              return `
                <div class="aws-card border-rose-500/30 p-5 rounded-2xl flex flex-col justify-between space-y-3">
                  <div>
                    <div class="flex items-center justify-between text-xs text-slate-400 mb-2">
                      <span class="font-mono font-bold text-[#ff9900]">Pregunta Q#${q.questionNumber} (Bloque ${q.blockNumber})</span>
                      <span class="bg-rose-950/80 text-rose-300 border border-rose-500/40 text-[10px] px-2.5 py-0.5 rounded-full font-bold">Fallada ${f.failureCount}x</span>
                    </div>
                    <p class="text-sm text-slate-200 line-clamp-3">
                      ${q.question}
                    </p>
                    <div class="text-xs text-slate-400 mt-2.5 flex flex-wrap items-center gap-2">
                      <span class="text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">Válida: ${store.getEffectiveCorrectAnswer(q)}</span>
                      ${store.hasCustomCorrectAnswer(q.id) ? '<span class="text-[10px] text-[#ff9900] bg-[#ff9900]/15 px-1.5 py-0.5 rounded">Personalizada</span>' : ''}
                      ${q.communityVote ? `<span class="text-slate-400 font-medium">(Comunidad: ${store.getCommunityVoteAnswer(q) || 'N/A'})</span>` : ''}
                      <span class="text-slate-500 font-normal">Oficial: ${q.correctAnswer}</span>
                    </div>
                    ${mnemonic ? `
                      <div class="mt-2.5 p-2.5 rounded-lg bg-[#0b121c] border border-[#ff9900]/30 text-xs text-[#ffad33]">
                        <span class="font-bold">💡 Nota:</span> ${mnemonic.text}
                      </div>
                    ` : ''}
                  </div>

                  <div class="flex items-center justify-between pt-3 border-t border-[#26354a] flex-wrap gap-2">
                    <div class="flex items-center gap-2.5">
                      <button onclick="app.launchSingleQuestionReview(${q.id})" class="text-xs font-bold text-[#ff9900] hover:text-[#ffac31] flex items-center gap-1">
                        <span>Practicar</span>
                        <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
                      </button>
                      <button onclick="app.copyQuestionForAI('${q.id}', this)" class="text-xs font-bold text-[#38bdf8] hover:text-white bg-[#0b121c] border border-[#26354a] px-2.5 py-1 rounded-lg flex items-center gap-1 transition">
                        <i data-lucide="sparkles" class="w-3 h-3 text-[#ff9900]"></i>
                        <span>Copiar IA</span>
                      </button>
                      <button onclick="app.openForceAnswerModal('${q.id}')" class="text-xs text-slate-300 hover:text-white flex items-center gap-1 font-semibold" title="Elegir o forzar respuesta válida">
                        <i data-lucide="sliders" class="w-3.5 h-3.5"></i>
                        <span>Forzar</span>
                      </button>
                    </div>
                    <button onclick="store.removeFailure(${q.id}); app.renderFailuresView()" class="text-xs text-slate-500 hover:text-rose-400 transition" title="Marcar como superada">
                      Eliminar
                    </button>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        `}

      </div>
    `;
  }

  launchSingleQuestionReview(questionId) {
    const q = store.questions.find(item => String(item.id) === String(questionId));
    if (!q) return;

    this.activeSession = {
      type: "single",
      mode: "practice",
      blockNumber: q.blockNumber,
      title: `Práctica Directa: Pregunta Q#${q.questionNumber}`,
      questions: [q],
      currentIndex: 0,
      userSelected: [],
      sessionAnswers: {}
    };

    this.navigate("test");
  }

  // =========================================================================
  // MODAL DE INGESTA Y PARSEO (PDF / JSON)
  // =========================================================================

  openIngestModal() {
    const modal = document.getElementById("ingest-modal");
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }

  closeIngestModal() {
    const modal = document.getElementById("ingest-modal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }

  async handlePDFUpload(file) {
    const progressContainer = document.getElementById("ingest-progress-container");
    const progressBar = document.getElementById("ingest-progress-bar");
    const progressText = document.getElementById("ingest-progress-text");

    if (progressContainer) progressContainer.classList.remove("hidden");

    try {
      const buffer = await file.arrayBuffer();
      const rawText = await DumpParser.extractTextFromPDF(buffer, (cur, total, pct) => {
        if (progressBar) progressBar.style.width = pct + "%";
        if (progressText) progressText.textContent = `Procesando página ${cur} de ${total} (${pct}%)...`;
      });

      const parsedQuestions = DumpParser.parseRawText(rawText);

      if (parsedQuestions.length === 0) {
        this.showToast("No se detectaron preguntas válidas en el PDF.", "error");
        return;
      }

      this.pendingParsedQuestions = parsedQuestions;
      this.showIngestPreview(parsedQuestions);
      this.showToast(`¡Extracción completada! ${parsedQuestions.length} preguntas detectadas.`, "success");
    } catch (err) {
      console.error(err);
      this.showToast("Error procesando PDF: " + err.message, "error");
    }
  }

  handleJSONUpload(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target.result);
        const normalized = DumpParser.validateAndNormalizeQuestions(raw);
        this.pendingParsedQuestions = normalized;
        this.showIngestPreview(normalized);
        this.showToast(`¡JSON validado! ${normalized.length} preguntas listas.`, "success");
      } catch (err) {
        this.showToast("Error en formato JSON: " + err.message, "error");
      }
    };
    reader.readAsText(file);
  }

  showIngestPreview(questions) {
    const previewContainer = document.getElementById("ingest-preview");
    if (!previewContainer) return;
    previewContainer.classList.remove("hidden");

    const sample = questions.slice(0, 3);
    previewContainer.innerHTML = `
      <div class="space-y-3">
        <div class="flex items-center justify-between text-xs text-slate-300">
          <span>Vista Previa (${questions.length} preguntas totales encontradas):</span>
          <span class="text-emerald-400 font-bold">${Math.ceil(questions.length / 25)} Bloques de Estudio</span>
        </div>
        <div class="space-y-2 max-h-48 overflow-y-auto p-2 bg-[#0b121c] rounded-xl border border-[#26354a] text-xs">
          ${sample.map(q => `
            <div class="p-2 border-b border-[#26354a] last:border-none">
              <span class="font-bold text-[#ff9900]">Q#${q.questionNumber}:</span> ${q.question.slice(0, 100)}...
              <div class="text-[10px] text-emerald-400 font-mono mt-0.5">Resp: ${q.correctAnswer} | Opciones: ${Object.keys(q.choices).join(", ")}</div>
            </div>
          `).join("")}
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button onclick="app.confirmAndSaveDump()" class="btn-aws-primary text-xs px-4 py-2 rounded-xl">
            Confirmar y Guardar en Banco Local
          </button>
        </div>
      </div>
    `;
  }

  confirmAndSaveDump() {
    if (this.pendingParsedQuestions && this.pendingParsedQuestions.length > 0) {
      store.setQuestions(this.pendingParsedQuestions);
      this.showToast(`Banco de preguntas actualizado: ${this.pendingParsedQuestions.length} preguntas guardadas.`, "success");
      this.closeIngestModal();
      this.render();
    }
  }

  // =========================================================================
  // TOAST NOTIFICATIONS
  // =========================================================================

  showToast(message, type = "info", duration = 4000) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    const colors = {
      success: "bg-emerald-600 text-white border-emerald-400 shadow-emerald-950/50",
      error: "bg-rose-600 text-white border-rose-400 shadow-rose-950/50",
      warning: "bg-[#ff9900] text-[#0f141a] border-[#ffad33] shadow-amber-950/50",
      info: "bg-[#161e2d] text-slate-100 border-[#ff9900]/50 shadow-slate-950/50"
    }[type] || "bg-[#161e2d] text-white border-[#26354a]";

    toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-xl text-xs font-bold animate-fadeIn ${colors}`;
    toast.innerHTML = `<span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("opacity-0", "transition-opacity", "duration-300");
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
}

// Inicialización global
if (typeof window !== "undefined" && typeof document !== "undefined" && typeof store !== "undefined" && (typeof module === "undefined" || !module.exports)) {
  window.app = new App();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { App };
}
