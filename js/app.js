/**
 * APLICACIÓN PRINCIPAL (APP CONTROLLER)
 * Single Page Application de Alto Rendimiento para AWS SAP-C02
 * Metodología: Active Recall, Descarte Rápido 2x2, Bloques Parkinson y Repaso Espaciado
 */

class App {
  constructor() {
    this.currentView = "dashboard"; // "dashboard" | "test" | "repemill" | "failures"
    this.activeSession = {
      type: "block", // "block" | "recall_24h"
      blockNumber: 1,
      title: "",
      questions: [],
      currentIndex: 0,
      userSelected: [] // Array de letras seleccionadas para la pregunta actual (ej: ['A'] o ['A','C'])
    };

    // Instancia del Cronómetro Pomodoro (35 min con corte en pico)
    this.pomodoro = new PomodoroTimer({
      focusDuration: 35 * 60,
      breakDuration: 5 * 60,
      onTick: (data) => this.renderPomodoroWidget(data),
      onPeak: () => this.showToast("🔥 ¡PICO DE RENDIMIENTO! Quedan 5 min de máxima retención. Acelera el ritmo antes del corte.", "warning", 6000),
      onComplete: (mode) => {
        if (mode === "focus") {
          store.addCompletedPomodoro(35);
          this.showToast("🔔 ¡Bloque Pomodoro de 35 min completado! Tómate 5 min de descanso para consolidación neuronal.", "success", 8000);
        } else {
          this.showToast("⚡ Descanso finalizado. Listo para el siguiente bloque de alta intensidad.", "info", 5000);
        }
      }
    });

    this.init();
  }

  async init() {
    // Si no hay preguntas en el store local, cargar el dump preprocesado por defecto
    if (!store.questions || store.questions.length === 0) {
      await this.loadDefaultQuestions();
    }

    this.setupEventListeners();
    this.setupKeyboardShortcuts();
    this.render();
  }

  async loadDefaultQuestions() {
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
      if (["dashboard", "repemill", "failures"].includes(hash)) {
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
        const letters = ["A", "B", "C", "D", "E", "F"];

        // Teclas 1-6 o A-F para seleccionar opciones
        const keyUpper = e.key.toUpperCase();
        let letterPicked = null;
        if (["1", "2", "3", "4", "5", "6"].includes(e.key)) {
          const idx = parseInt(e.key) - 1;
          if (idx < Object.keys(q.choices).length) letterPicked = letters[idx];
        } else if (letters.includes(keyUpper) && q.choices[keyUpper]) {
          letterPicked = keyUpper;
        }

        if (letterPicked) {
          e.preventDefault();
          this.toggleOptionSelection(letterPicked);
          return;
        }

        // Espacio o Enter: Confirmar respuesta si no ha respondido aún
        if (e.key === "Enter" || e.code === "Space") {
          e.preventDefault();
          const qId = String(q.id);
          const alreadyAnswered = !!store.answers[qId];
          if (!alreadyAnswered && this.activeSession.userSelected.length > 0) {
            this.confirmAnswer();
          } else if (alreadyAnswered) {
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

        // Tecla Z: Modo Zen
        if (keyUpper === "Z") {
          e.preventDefault();
          this.toggleZenMode();
          return;
        }
      }
    });
  }

  navigate(viewName) {
    this.currentView = viewName;
    window.location.hash = viewName;
    this.render();
    window.scrollTo(0, 0);
  }

  // =========================================================================
  // CONTROLADOR DE SESIONES DE TEST (PARKINSON & ACTIVE RECALL)
  // =========================================================================

  startBlockSession(blockNumber) {
    const startIdx = (blockNumber - 1) * 25;
    const endIdx = Math.min(blockNumber * 25, store.questions.length);
    const questions = store.questions.slice(startIdx, endIdx);

    if (questions.length === 0) {
      this.showToast("No hay preguntas disponibles en este bloque.", "error");
      return;
    }

    this.activeSession = {
      type: "block",
      blockNumber: blockNumber,
      title: `Sesión ${blockNumber}: Preguntas Q${startIdx + 1} - Q${endIdx}`,
      questions: questions,
      currentIndex: 0,
      userSelected: []
    };

    // Cargar si la primera pregunta ya tenía respuesta guardada
    const firstQ = questions[0];
    const saved = store.answers[String(firstQ.id)];
    if (saved) {
      this.activeSession.userSelected = [...saved.selected];
    }

    this.pomodoro.start();
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
      blockNumber: 0,
      title: `Active Recall 24h: ${recallQuestions.length} Preguntas Críticas`,
      questions: recallQuestions,
      currentIndex: 0,
      userSelected: []
    };

    const firstQ = recallQuestions[0];
    const saved = store.answers[String(firstQ.id)];
    if (saved) {
      this.activeSession.userSelected = [...saved.selected];
    }

    this.pomodoro.start();
    this.navigate("test");
  }

  toggleOptionSelection(letter) {
    const q = this.activeSession.questions[this.activeSession.currentIndex];
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
    const selectedSorted = [...this.activeSession.userSelected].sort().join("");
    const correctSorted = q.correctAnswer.split("").sort().join("");
    const isCorrect = selectedSorted === correctSorted;

    // Registrar en el Store persistente
    store.recordAnswer(q.id, this.activeSession.userSelected, isCorrect, q.question.slice(0, 100));

    // Feedback sonoro sintético
    if (store.settings.soundEnabled) {
      if (isCorrect) {
        this.pomodoro.playTone(880, "sine", 0.12, 0.08); // La alto agradable
      } else {
        this.pomodoro.playTone(220, "sawtooth", 0.25, 0.1); // Tono grave de error
      }
    }

    this.renderTestView();

    // Avance rápido automático si acierta y está configurado
    if (isCorrect && store.settings.autoAdvanceOnCorrect) {
      setTimeout(() => {
        // Solo avanzar si sigue en la misma pregunta y no ha hecho clic en otro lado
        if (this.activeSession.questions[this.activeSession.currentIndex].id === q.id) {
          this.nextQuestion();
        }
      }, 900);
    }
  }

  nextQuestion() {
    if (this.activeSession.currentIndex < this.activeSession.questions.length - 1) {
      this.activeSession.currentIndex++;
      const nextQ = this.activeSession.questions[this.activeSession.currentIndex];
      const saved = store.answers[String(nextQ.id)];
      this.activeSession.userSelected = saved ? [...saved.selected] : [];
      this.renderTestView();
      window.scrollTo(0, 0);
    } else {
      // Fin del bloque: Celebración de Parkinson
      if (window.confetti) {
        window.confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }
      this.showToast("🎉 ¡Bloque de 25 preguntas finalizado! Has completado el ciclo de Parkinson.", "success", 6000);
      this.navigate("dashboard");
    }
  }

  prevQuestion() {
    if (this.activeSession.currentIndex > 0) {
      this.activeSession.currentIndex--;
      const prevQ = this.activeSession.questions[this.activeSession.currentIndex];
      const saved = store.answers[String(prevQ.id)];
      this.activeSession.userSelected = saved ? [...saved.selected] : [];
      this.renderTestView();
      window.scrollTo(0, 0);
    }
  }

  jumpToQuestion(index) {
    if (index >= 0 && index < this.activeSession.questions.length) {
      this.activeSession.currentIndex = index;
      const targetQ = this.activeSession.questions[this.activeSession.currentIndex];
      const saved = store.answers[String(targetQ.id)];
      this.activeSession.userSelected = saved ? [...saved.selected] : [];
      this.renderTestView();
      window.scrollTo(0, 0);
    }
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
    if (confirm(`¿Estás seguro de que deseas reiniciar la Sesión ${blockNumber}? Se eliminarán todas las respuestas y fallos de este bloque para que puedas entrenarlo desde cero.`)) {
      store.resetBlock(blockNumber);
      this.showToast(`Sesión ${blockNumber} reiniciada desde cero.`, "info");
      if (this.currentView === "test" && this.activeSession.blockNumber === blockNumber) {
        this.startBlockSession(blockNumber);
      } else {
        this.render();
      }
    }
  }

  forceCorrectAnswer(questionId) {
    store.forceCorrect(questionId, "Alineado con consenso de la comunidad");
    if (store.settings.soundEnabled) {
      this.pomodoro.playTone(880, "sine", 0.12, 0.08);
    }
    this.showToast("✓ Marcada como correcta según el consenso de la comunidad.", "success");
    this.renderTestView();
  }

  revertCorrectAnswer(questionId) {
    store.revertToIncorrect(questionId);
    this.showToast("Respuesta devuelta a estado de fallo original.", "info");
    this.renderTestView();
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
  // RENDERIZADO GENERAL & VISTAS
  // =========================================================================

  render() {
    const container = document.getElementById("view-container");
    if (!container) return;

    if (this.currentView === "dashboard") {
      this.renderDashboard();
    } else if (this.currentView === "test") {
      this.renderTestView();
    } else if (this.currentView === "repemill") {
      this.renderRepemillView();
    } else if (this.currentView === "failures") {
      this.renderFailuresView();
    }

    // Actualizar iconos Lucide
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  renderPomodoroWidget(data) {
    const el = document.getElementById("pomodoro-display");
    if (!el) return;

    const modeLabel = data.mode === "focus" ? "Foco Intenso" : "Descanso";
    const modeBadgeClass = data.mode === "focus" ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    const playIcon = data.isRunning ? "pause" : "play";

    el.innerHTML = `
      <div class="flex items-center gap-2 sm:gap-3 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl px-3 py-1.5 shadow-lg ${data.isRunning && data.mode === 'focus' ? 'pomodoro-active-pulse' : ''}">
        <div class="flex flex-col">
          <div class="flex items-center gap-1.5">
            <span class="inline-block w-2 h-2 rounded-full ${data.isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}"></span>
            <span class="text-xs font-mono font-bold tracking-tight text-white text-base">${data.formatted}</span>
          </div>
          <span class="text-[10px] uppercase tracking-wider font-semibold text-slate-400">${modeLabel}</span>
        </div>
        <div class="flex items-center gap-1">
          <button onclick="app.pomodoro.toggle()" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition" title="${data.isRunning ? 'Pausar' : 'Iniciar'}">
            <i data-lucide="${playIcon}" class="w-3.5 h-3.5"></i>
          </button>
          <button onclick="app.pomodoro.reset()" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition" title="Reiniciar">
            <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  }

  // =========================================================================
  // VISTA 1: DASHBOARD GENERAL (PARKINSON & MÉTRICAS)
  // =========================================================================

  renderDashboard() {
    const container = document.getElementById("view-container");
    const stats = store.getGlobalStats();
    const blocks = store.getBlocksSummary();
    const recallCount = store.getRecallQuestions().length;

    container.innerHTML = `
      <div class="max-w-7xl mx-auto space-y-8 animate-fadeIn">
        
        <!-- Header Principal & Estado de Preparación -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
          <div>
            <div class="flex items-center gap-2 text-indigo-400 font-semibold text-xs uppercase tracking-wider mb-1">
              <i data-lucide="shield-check" class="w-4 h-4"></i>
              AWS Solutions Architect Professional (SAP-C02)
            </div>
            <h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Plataforma de Entrenamiento Intensivo <span class="text-indigo-400 font-mono">SAP-C02</span>
            </h1>
            <p class="text-slate-400 text-sm mt-1">
              Bloques cerrados de 25 preguntas (Ley de Parkinson), feedback de descarte inmediato y repetición espaciada 24h.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <button onclick="app.openIngestModal()" class="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-sm font-semibold border border-slate-700 transition shadow-sm">
              <i data-lucide="upload-cloud" class="w-4 h-4 text-cyan-400"></i>
              <span>Cargar PDF / JSON</span>
            </button>

            <button onclick="app.startRecallSession()" class="flex items-center gap-2 ${recallCount > 0 ? 'bg-rose-600 hover:bg-rose-500 animate-pulse' : 'bg-slate-800 text-slate-400'} text-white px-4 py-2 rounded-xl text-sm font-semibold transition shadow-lg shadow-rose-900/20">
              <i data-lucide="flame" class="w-4 h-4"></i>
              <span>Active Recall 24h (${recallCount})</span>
            </button>
          </div>
        </div>

        <!-- Tarjetas de Métricas de Examen Oficial -->
        <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <!-- Total Preguntas -->
          <div class="bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
            <div class="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
              <span>Banco Total</span>
              <i data-lucide="layers" class="w-4 h-4 text-slate-500"></i>
            </div>
            <div class="mt-2 text-2xl sm:text-3xl font-extrabold text-white font-mono">
              ${stats.totalQuestions}
            </div>
            <div class="text-xs text-slate-400 mt-1">
              ${stats.answered} respondidas (${Math.round((stats.answered / (stats.totalQuestions || 1)) * 100)}%)
            </div>
          </div>

          <!-- Precisión Bruta -->
          <div class="bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
            <div class="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
              <span>Precisión Bruta</span>
              <i data-lucide="target" class="w-4 h-4 text-emerald-400"></i>
            </div>
            <div class="mt-2 text-2xl sm:text-3xl font-extrabold ${stats.accuracy >= 75 ? 'text-emerald-400' : 'text-amber-400'} font-mono">
              ${stats.accuracy}%
            </div>
            <div class="text-xs text-slate-400 mt-1">
              Meta SAP-C02: ≥ 75%
            </div>
          </div>

          <!-- Puntuación Neta -->
          <div class="bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
            <div class="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
              <span>Puntuación Neta</span>
              <i data-lucide="award" class="w-4 h-4 text-cyan-400"></i>
            </div>
            <div class="mt-2 text-2xl sm:text-3xl font-extrabold text-cyan-400 font-mono">
              ${stats.netScore}
            </div>
            <div class="text-xs text-slate-400 mt-1" title="Fórmula oficial: Aciertos - (Fallos / 3)">
              Penalización 1/3 por fallo
            </div>
          </div>

          <!-- Base de Fallos (Rojas) -->
          <div class="bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
            <div class="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
              <span>Preguntas Rojas</span>
              <i data-lucide="alert-triangle" class="w-4 h-4 text-rose-400"></i>
            </div>
            <div class="mt-2 text-2xl sm:text-3xl font-extrabold text-rose-400 font-mono">
              ${stats.totalFailuresInDb}
            </div>
            <div class="text-xs text-slate-400 mt-1">
              En base de datos de fallos
            </div>
          </div>

          <!-- Sesiones de Enfoque Pomodoro -->
          <div class="col-span-2 lg:col-span-1 bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
            <div class="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
              <span>Sesiones de Enfoque</span>
              <i data-lucide="clock" class="w-4 h-4 text-indigo-400"></i>
            </div>
            <div class="mt-2 text-2xl sm:text-3xl font-extrabold text-indigo-400 font-mono">
              ${stats.completedPomodoros} <span class="text-sm font-normal text-slate-400">bloques</span>
            </div>
            <div class="text-xs text-slate-400 mt-1">
              ${stats.totalFocusMinutes} min en pico de atención
            </div>
          </div>
        </div>

        <!-- Grid de Sesiones / Bloques Parkinson (25 Preguntas Cada Una) -->
        <div>
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <i data-lucide="layout-grid" class="w-5 h-5 text-indigo-400"></i>
                Sesiones Cerradas de Entrenamiento (Ley de Parkinson)
              </h2>
              <p class="text-xs text-slate-400 mt-0.5">
                Cada bloque de 25 preguntas está calibrado para completarse en un Pomodoro de 35 minutos sin fatiga mental.
              </p>
            </div>
            <button onclick="app.navigate('repemill')" class="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition">
              <span>Ver todos los Patrones Repemill</span>
              <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            ${blocks.map(b => this.renderBlockCard(b)).join("")}
          </div>
        </div>

      </div>
    `;
  }

  renderBlockCard(b) {
    const statusBg = {
      completed: "border-emerald-500/40 bg-slate-900/95",
      in_progress: "border-indigo-500/50 bg-slate-900/95 shadow-lg shadow-indigo-950/20",
      pending: "border-slate-800 bg-slate-900/60"
    }[b.status];

    const statusBadge = {
      completed: `<span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Completado</span>`,
      in_progress: `<span class="bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">En Curso</span>`,
      pending: `<span class="bg-slate-800 text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Pendiente</span>`
    }[b.status];

    const repemillEntry = REPEMILL_DATA[b.blockNumber];
    const triggerPreview = repemillEntry && repemillEntry.patterns.length > 0 ? repemillEntry.patterns[0].trigger : "Patrones clave de arquitectura AWS";

    return `
      <div class="flex flex-col justify-between border ${statusBg} rounded-2xl p-4 transition-all hover:border-slate-700 hover:shadow-md">
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-mono font-bold text-slate-400">BLOQUE ${String(b.blockNumber).padStart(2, "0")}</span>
            ${statusBadge}
          </div>
          
          <h3 class="text-base font-bold text-white mb-1">
            Sesión ${b.blockNumber} <span class="text-slate-400 font-mono text-xs font-normal">(${b.rangeLabel})</span>
          </h3>

          <p class="text-xs text-slate-400 line-clamp-2 mb-3" title="${triggerPreview}">
            <span class="text-cyan-400 font-medium">Gatillo:</span> ${triggerPreview}
          </p>

          <!-- Barra de Progreso del Bloque -->
          <div class="space-y-1 mb-3">
            <div class="flex justify-between text-[11px] text-slate-400">
              <span>Progreso: ${b.answered}/${b.total}</span>
              <span class="font-semibold ${b.accuracy >= 75 ? 'text-emerald-400' : 'text-amber-400'}">${b.accuracy}% acierto</span>
            </div>
            <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div class="bg-indigo-500 h-full rounded-full transition-all duration-500" style="width: ${(b.answered / (b.total || 1)) * 100}%"></div>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 pt-2 border-t border-slate-800/80">
          <button onclick="app.startBlockSession(${b.blockNumber})" class="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white py-2 px-3 rounded-xl text-xs font-semibold transition shadow-sm">
            <i data-lucide="play" class="w-3.5 h-3.5"></i>
            <span>${b.status === 'completed' ? 'Repetir Test' : (b.status === 'in_progress' ? 'Continuar' : 'Comenzar')}</span>
          </button>

          ${b.answered > 0 ? `
            <button onclick="app.confirmResetBlock(${b.blockNumber})" class="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 border border-slate-700/60 hover:border-rose-900/60 transition" title="Reiniciar Bloque (Borrar respuestas)">
              <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
            </button>
          ` : ''}

          <button onclick="app.openRepemillModal(${b.blockNumber})" class="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition" title="Consultar Patrones Repemill">
            <i data-lucide="book-open" class="w-3.5 h-3.5 text-indigo-400"></i>
          </button>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // VISTA 2: SIMULADOR DE TEST DE ALTO RENDIMIENTO (MESA DE ESTUDIO LIMPIA)
  // =========================================================================

  renderTestView() {
    const container = document.getElementById("view-container");
    if (!container || this.activeSession.questions.length === 0) return;

    const q = this.activeSession.questions[this.activeSession.currentIndex];
    const totalQ = this.activeSession.questions.length;
    const qId = String(q.id);
    const existingAnswer = store.answers[qId];
    const isAnswered = !!existingAnswer;
    const isDoubt = store.isDoubt(q.id);
    const userMnemonic = store.getMnemonic(q.id);

    const isMulti = (q.multiSelectCount || 1) > 1;
    const requiredChoicesText = isMulti ? `(Selecciona ${q.multiSelectCount} opciones)` : `(Selección única)`;

    // Preparar opciones A, B, C, D, etc.
    const choicesEntries = Object.entries(q.choices || {});
    const correctLetters = (q.correctAnswer || "").split("");

    container.innerHTML = `
      <div class="max-w-4xl mx-auto space-y-6 pb-20 animate-fadeIn">
        
        <!-- Barra de Control del Test (Header Zen) -->
        <div class="flex items-center justify-between bg-slate-900/90 border border-slate-800 p-3 rounded-2xl shadow-lg sticky top-3 z-30 backdrop-blur">
          <div class="flex items-center gap-2 sm:gap-3">
            <button onclick="app.navigate('dashboard')" class="flex items-center gap-1 text-slate-400 hover:text-white text-xs font-semibold py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition">
              <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
              <span class="hidden sm:inline">Dashboard</span>
            </button>

            <div class="flex flex-col">
              <span class="text-xs font-bold text-white tracking-tight">${this.activeSession.title}</span>
              <span class="text-[11px] text-slate-400">Pregunta ${this.activeSession.currentIndex + 1} de ${totalQ} ${requiredChoicesText}</span>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <!-- Botón de Duda (Amarilla) -->
            <button onclick="app.toggleCurrentDoubt()" class="flex items-center gap-1 text-xs font-semibold py-1.5 px-3 rounded-lg border transition ${isDoubt ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'}" title="Marcar como Dudosa [D]">
              <i data-lucide="help-circle" class="w-3.5 h-3.5 ${isDoubt ? 'text-amber-400' : ''}"></i>
              <span class="hidden sm:inline">${isDoubt ? 'Dudosa' : 'Marcar Duda'}</span>
              <span class="key-badge ml-1 hidden md:inline-flex">D</span>
            </button>

            <!-- Botón Ver Repemill del Bloque -->
            <button onclick="app.openRepemillModal(${q.blockNumber})" class="flex items-center gap-1 text-xs font-semibold py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-400 border border-slate-700 transition" title="Patrones del Bloque">
              <i data-lucide="book-open" class="w-3.5 h-3.5"></i>
              <span class="hidden md:inline">Repemill</span>
            </button>

            <!-- Botón Reiniciar Bloque en Curso -->
            ${this.activeSession.type === 'block' ? `
              <button onclick="app.confirmResetBlock(${this.activeSession.blockNumber})" class="flex items-center gap-1 text-xs font-semibold py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700 transition" title="Reiniciar este Bloque">
                <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                <span class="hidden lg:inline">Reiniciar</span>
              </button>
            ` : ''}

            <!-- Modo Zen -->
            <button onclick="app.toggleZenMode()" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition" title="Modo Zen [Z]">
              <i data-lucide="${store.settings.zenMode ? 'minimize-2' : 'maximize-2'}" class="w-4 h-4"></i>
            </button>
          </div>
        </div>

        <!-- Matriz Rápida de Preguntas del Bloque -->
        <div class="flex items-center gap-1.5 overflow-x-auto py-1 px-0.5 no-scrollbar">
          ${this.activeSession.questions.map((item, idx) => {
            const itemAns = store.answers[String(item.id)];
            let color = "bg-slate-800 text-slate-400 hover:bg-slate-700";
            if (itemAns) {
              color = itemAns.isCorrect ? "bg-emerald-600 text-white" : "bg-rose-600 text-white";
            }
            if (store.isDoubt(item.id)) {
              color = "bg-amber-500 text-slate-950 font-black ring-2 ring-amber-400/50";
            }
            const isCurrent = idx === this.activeSession.currentIndex;
            return `
              <button onclick="app.jumpToQuestion(${idx})" class="w-7 h-7 flex-shrink-0 text-[11px] font-mono font-bold rounded-lg transition ${color} ${isCurrent ? 'ring-2 ring-indigo-400 scale-110' : ''}">
                ${idx + 1}
              </button>
            `;
          }).join("")}
        </div>

        <!-- Tarjeta Central de la Pregunta (Mesa de Estudio Limpia) -->
        <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          
          <!-- Encabezado de Pregunta -->
          <div class="flex items-center justify-between text-xs text-slate-400 pb-3 border-b border-slate-800/80">
            <span class="font-mono font-bold text-indigo-400 uppercase tracking-wider">Identificador: Q#${q.questionNumber}</span>
            <div class="flex items-center gap-2">
              ${isAnswered && q.communityVote ? `<span class="bg-slate-800 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[11px] font-mono">Comunidad: ${q.communityVote}</span>` : ''}
              <span class="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[11px] font-mono">Bloque ${q.blockNumber}</span>
            </div>
          </div>

          <!-- Enunciado de la Pregunta con Resaltado Inteligente -->
          <div class="question-body text-slate-100 text-base sm:text-lg">
            ${Highlighter.highlight(q.question)}
          </div>

          <!-- Opciones de Respuesta A, B, C, D... -->
          <div class="space-y-3 pt-2">
            ${choicesEntries.map(([letter, text], index) => {
              const isSelected = this.activeSession.userSelected.includes(letter);
              const isOfficialCorrect = correctLetters.includes(letter);
              const isForced = isAnswered && existingAnswer.forcedCorrect && isSelected;
              let optionClass = "border-slate-800 bg-slate-800/40 hover:bg-slate-800/90 hover:border-slate-700 text-slate-200";

              if (isAnswered) {
                if (isOfficialCorrect || isForced) {
                  optionClass = "border-emerald-500/70 bg-emerald-950/40 text-emerald-100 ring-1 ring-emerald-500/50";
                } else if (isSelected && !isOfficialCorrect) {
                  optionClass = "border-rose-500/70 bg-rose-950/40 text-rose-100 ring-1 ring-rose-500/50";
                } else {
                  optionClass = "border-slate-800/50 bg-slate-900/30 text-slate-400 opacity-60";
                }
              } else if (isSelected) {
                optionClass = "border-indigo-500 bg-indigo-950/50 text-indigo-100 ring-2 ring-indigo-500/40";
              }

              const badgeColor = isSelected
                ? (isAnswered && (isOfficialCorrect || isForced) ? 'bg-emerald-600 text-white' : (isAnswered && !isOfficialCorrect ? 'bg-rose-600 text-white' : 'bg-indigo-600 text-white'))
                : 'bg-slate-800 text-slate-300 border border-slate-700';

              return `
                <div onclick="app.toggleOptionSelection('${letter}')" class="flex items-start gap-4 p-4 rounded-2xl border ${optionClass} cursor-pointer transition-all">
                  <div class="flex items-center gap-2 pt-0.5">
                    <span class="w-6 h-6 rounded-lg flex items-center justify-center font-mono text-xs font-bold ${badgeColor}">
                      ${letter}
                    </span>
                    <span class="key-badge text-[10px] hidden sm:inline-flex">${index + 1}</span>
                  </div>
                  <div class="flex-1 text-sm sm:text-base leading-relaxed">
                    ${Highlighter.highlight(text)}
                    ${isForced ? '<span class="ml-2 inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">✓ Acierto validado por comunidad</span>' : ''}
                  </div>
                  ${isAnswered && (isOfficialCorrect || isForced) ? '<i data-lucide="check-circle" class="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5"></i>' : ''}
                  ${isAnswered && isSelected && !isOfficialCorrect && !isForced ? '<i data-lucide="x-circle" class="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5"></i>' : ''}
                </div>
              `;
            }).join("")}
          </div>

          <!-- Botón de Confirmación / Avance -->
          <div class="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800">
            <div class="text-xs text-slate-400 flex items-center gap-2">
              <span class="key-badge">Espacio</span> o <span class="key-badge">Enter</span> para confirmar/avanzar
              <span class="key-badge">←</span> <span class="key-badge">→</span> navegar
            </div>

            <div class="flex items-center gap-3 w-full sm:w-auto">
              ${!isAnswered ? `
                <button onclick="app.confirmAnswer()" ${this.activeSession.userSelected.length === 0 ? 'disabled' : ''} class="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition shadow-lg shadow-indigo-900/30">
                  <span>Confirmar Respuesta</span>
                  <i data-lucide="check" class="w-4 h-4"></i>
                </button>
              ` : `
                <button onclick="app.nextQuestion()" class="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition shadow-lg shadow-emerald-900/30">
                  <span>Siguiente Pregunta</span>
                  <i data-lucide="arrow-right" class="w-4 h-4"></i>
                </button>
              `}
            </div>
          </div>

          <!-- Desplegable Técnico de Descarte & Nemotecnia (Active Recall Feedback) -->
          ${isAnswered ? this.renderAnswerFeedback(q, existingAnswer, userMnemonic) : ''}

        </div>

      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  }

  renderAnswerFeedback(q, answer, userMnemonic) {
    const isCorrect = answer.isCorrect;
    const isForced = !!answer.forcedCorrect;
    const repemillPattern = (typeof findBestPatternForQuestion === 'function') 
      ? findBestPatternForQuestion(q) 
      : ((REPEMILL_DATA[q.blockNumber] && REPEMILL_DATA[q.blockNumber].patterns[0]) || null);

    return `
      <div class="mt-6 p-5 sm:p-6 rounded-2xl border ${isCorrect ? 'border-emerald-500/40 bg-emerald-950/20' : 'border-rose-500/40 bg-rose-950/20'} space-y-5 animate-fadeIn">
        
        <!-- Encabezado de Estado de Respuesta -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b ${isCorrect ? 'border-emerald-500/30' : 'border-rose-500/30'}">
          <div class="flex items-center gap-2.5">
            <span class="w-3.5 h-3.5 rounded-full ${isCorrect ? 'bg-emerald-400' : 'bg-rose-400'}"></span>
            <div>
              <h4 class="text-base font-bold ${isCorrect ? 'text-emerald-300' : 'text-rose-300'}">
                ${isForced ? '¡Acierto Validado por Consenso de Comunidad!' : (isCorrect ? '¡Acierto Técnico Consolidado!' : 'Fallo Registrado en Base de Datos Roja')}
              </h4>
              <span class="text-xs text-slate-400">
                ${isForced ? 'Forzado manualmente basándote en el debate técnico de la comunidad' : (isCorrect ? 'Tu respuesta coincide con la clave oficial' : 'Revisa el patrón que debiste haber seguido a continuación')}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-mono text-slate-300 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
              Respuesta Oficial: <strong class="text-emerald-400">${q.correctAnswer}</strong>
            </span>
          </div>
        </div>

        <!-- Consenso de la Comunidad & Botón de Forzar Acierto -->
        <div class="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
          <div class="text-xs text-slate-300">
            <span class="font-bold text-cyan-400">Votación de la Comunidad:</span> 
            ${q.communityVote ? `<span class="font-mono text-emerald-400 font-semibold ml-1">${q.communityVote}</span>` : '<span class="text-slate-500 ml-1">Sin porcentaje registrado</span>'}
          </div>

          <div>
            ${!isCorrect ? `
              <button onclick="app.forceCorrectAnswer('${q.id}')" class="flex items-center gap-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 px-3.5 py-2 rounded-xl text-xs font-semibold transition shadow-sm hover:shadow-emerald-950/50">
                <i data-lucide="check-check" class="w-4 h-4 text-emerald-400"></i>
                <span>Forzar Acierto (La comunidad me da la razón)</span>
              </button>
            ` : (isForced ? `
              <div class="flex items-center gap-2 text-xs">
                <span class="text-emerald-400 font-medium">✓ Acierto forzado por comunidad</span>
                <button onclick="app.revertCorrectAnswer('${q.id}')" class="text-slate-400 hover:text-rose-400 underline text-xs transition ml-2">
                  Revertir a fallo
                </button>
              </div>
            ` : '')}
          </div>
        </div>

        <!-- ASOCIACIÓN CON EL REPEMILL (EXPLICACIÓN DEL PATRÓN QUE DEBIÓ SEGUIR) -->
        ${repemillPattern ? `
          <div class="bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 border ${!isCorrect ? 'border-amber-500/60 shadow-amber-950/30' : 'border-indigo-500/40'} p-5 sm:p-6 rounded-2xl space-y-4 shadow-xl">
            <div class="flex items-center justify-between pb-3 border-b border-indigo-500/25">
              <div class="flex items-center gap-2.5">
                <span class="p-1.5 rounded-xl ${!isCorrect ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'}">
                  <i data-lucide="compass" class="w-4 h-4"></i>
                </span>
                <div>
                  <h4 class="text-sm sm:text-base font-bold text-white tracking-tight">
                    ${!isCorrect ? 'Patrón Repemill que debiste haber seguido' : 'Patrón Repemill Asociado a este Requisito'}
                  </h4>
                  <span class="text-[11px] text-slate-400">Regla de decisión rápida para exámenes de certificación</span>
                </div>
              </div>
              <span class="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-300 bg-indigo-950/90 px-2.5 py-1 rounded-lg border border-indigo-800/50">
                ${repemillPattern.category}
              </span>
            </div>

            <!-- Fila de Comparativa: Gatillo vs Servicio Óptimo -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
              <div class="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/90 space-y-1.5">
                <span class="text-amber-400 font-bold block flex items-center gap-1.5">
                  <i data-lucide="target" class="w-3.5 h-3.5 text-amber-400"></i>
                  Palabra Gatillo / Requisito Clave:
                </span>
                <p class="text-slate-200 leading-relaxed font-medium">${repemillPattern.trigger}</p>
              </div>

              <div class="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/90 space-y-1.5">
                <span class="text-cyan-400 font-bold block flex items-center gap-1.5">
                  <i data-lucide="zap" class="w-3.5 h-3.5 text-cyan-400"></i>
                  Servicio AWS Óptimo que debiste elegir:
                </span>
                <p class="text-cyan-200 leading-relaxed font-semibold">${repemillPattern.optimalService}</p>
              </div>
            </div>

            <!-- Por qué fallaron las otras opciones (Descarte Rápido) -->
            <div class="bg-rose-950/25 border border-rose-900/50 p-4 rounded-xl text-xs space-y-1.5">
              <span class="text-rose-300 font-bold flex items-center gap-1.5">
                <i data-lucide="shield-alert" class="w-3.5 h-3.5 text-rose-400"></i>
                Patrón de Descarte Rápido (Por qué descartar las otras opciones):
              </span>
              <p class="text-slate-300 leading-relaxed">${repemillPattern.discardPattern}</p>
            </div>

            <!-- Píldora Mnemotécnica de Fijación -->
            ${repemillPattern.mnemonic ? `
              <div class="text-xs text-indigo-300 bg-indigo-950/40 p-3 rounded-xl border border-indigo-500/30 flex items-start gap-2.5">
                <i data-lucide="lightbulb" class="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5"></i>
                <span><strong>Regla de Fijación:</strong> ${repemillPattern.mnemonic}</span>
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- Bloque de Nota Técnica Personal -->
        <div class="bg-indigo-950/20 border border-indigo-500/30 p-4 rounded-xl space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 text-indigo-300 font-semibold text-xs uppercase tracking-wider">
              <i data-lucide="edit-3" class="w-4 h-4 text-indigo-400"></i>
              <span>Nota Técnica Personal & Nemotecnia de Fijación</span>
            </div>
            <span class="text-[11px] text-slate-400">Anotación persistente vinculada a Q#${q.questionNumber}</span>
          </div>

          <div class="flex flex-col sm:flex-row gap-2">
            <input id="mnemonic-input" type="text" placeholder="Anota tu regla personal o nemotecnia para no volver a fallar esta pregunta..." value="${userMnemonic ? userMnemonic.text : ''}" class="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500">
            <button onclick="app.saveCurrentMnemonic(document.getElementById('mnemonic-input').value)" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition flex items-center justify-center gap-1">
              <i data-lucide="save" class="w-3.5 h-3.5"></i>
              <span>Guardar Nota</span>
            </button>
          </div>
        </div>

      </div>
    `;
  }

  // =========================================================================
  // VISTA 3: EL REPEMILL (TABLAS DE PATRONES POR SESIÓN)
  // =========================================================================

  renderRepemillView() {
    const container = document.getElementById("view-container");
    const blocksCount = 17;
    const blocksList = Array.from({ length: blocksCount }, (_, i) => i + 1);

    container.innerHTML = `
      <div class="max-w-7xl mx-auto space-y-8 animate-fadeIn">
        
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-2xl border border-slate-800">
          <div>
            <div class="flex items-center gap-2 text-indigo-400 font-semibold text-xs uppercase tracking-wider mb-1">
              <i data-lucide="table" class="w-4 h-4"></i>
              El "Repemill" Conceptual (Desgloses de Alta Frecuencia)
            </div>
            <h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Tablas de Patrones & Palabras Gatillo por Bloque
            </h1>
            <p class="text-slate-400 text-sm mt-1">
              Estructura: [Palabra Gatillo / Requisito Clave] | [Servicio AWS Óptimo] | [Patrón de Descarte Rápido].
            </p>
          </div>

          <div class="flex items-center gap-2">
            <input id="repemill-search" oninput="app.filterRepemill(this.value)" type="text" placeholder="Buscar servicio o palabra gatillo..." class="bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-64">
          </div>
        </div>

        <!-- Acordeones / Tablas por Bloque -->
        <div id="repemill-content" class="space-y-6">
          ${blocksList.map(bNum => this.renderRepemillBlockTable(bNum)).join("")}
        </div>

      </div>
    `;
  }

  renderRepemillBlockTable(blockNumber) {
    const data = REPEMILL_DATA[blockNumber];
    if (!data) return "";

    return `
      <div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div class="bg-slate-800/60 p-4 border-b border-slate-800 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
            <h3 class="text-base font-bold text-white">${data.title}</h3>
          </div>
          <button onclick="app.startBlockSession(${blockNumber})" class="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
            <span>Iniciar Test del Bloque</span>
            <i data-lucide="play" class="w-3 h-3"></i>
          </button>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-sm">
            <thead>
              <tr class="border-b border-slate-800 text-xs font-semibold text-slate-400 bg-slate-900/50">
                <th class="p-3.5 w-1/3">Palabra Gatillo / Requisito Clave</th>
                <th class="p-3.5 w-1/3">Servicio AWS Óptimo</th>
                <th class="p-3.5 w-1/3">Patrón de Descarte Rápido</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60 text-slate-300">
              ${data.patterns.map(p => `
                <tr class="hover:bg-slate-800/30 transition">
                  <td class="p-3.5 font-medium text-slate-200">
                    <span class="text-amber-400 font-bold block mb-1">${p.trigger}</span>
                    <span class="text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">${p.category}</span>
                  </td>
                  <td class="p-3.5 font-semibold text-cyan-300">
                    ${p.optimalService}
                    ${p.mnemonic ? `<div class="text-[11px] text-indigo-300 font-normal mt-1 italic">💡 ${p.mnemonic}</div>` : ''}
                  </td>
                  <td class="p-3.5 text-xs text-slate-400 leading-relaxed">
                    ${p.discardPattern}
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  filterRepemill(query) {
    const q = query.toLowerCase().trim();
    const rows = document.querySelectorAll("#repemill-content tr");
    rows.forEach(r => {
      const text = r.textContent.toLowerCase();
      r.style.display = text.includes(q) ? "" : "none";
    });
  }

  // =========================================================================
  // VISTA 4: BASE DE DATOS DE FALLOS (PREGUNTAS ROJAS & AMARILLAS)
  // =========================================================================

  renderFailuresView() {
    const container = document.getElementById("view-container");
    const failures = Object.values(store.failures);
    const doubts = Object.keys(store.doubts);

    container.innerHTML = `
      <div class="max-w-7xl mx-auto space-y-8 animate-fadeIn">
        
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-2xl border border-slate-800">
          <div>
            <div class="flex items-center gap-2 text-rose-400 font-semibold text-xs uppercase tracking-wider mb-1">
              <i data-lucide="alert-octagon" class="w-4 h-4"></i>
              Gestión de Errores & Repaso Espaciado (Curva del Olvido)
            </div>
            <h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Base de Datos de Fallos <span class="text-rose-400 font-mono">(${failures.length} Rojas, ${doubts.length} Amarillas)</span>
            </h1>
            <p class="text-slate-400 text-sm mt-1">
              El registro de fallos permite priorizar los conceptos no consolidados. Repásalos antes de 24 horas para consolidar la retención.
            </p>
          </div>

          <div class="flex items-center gap-3">
            <button onclick="app.startRecallSession()" ${failures.length === 0 && doubts.length === 0 ? 'disabled' : ''} class="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition shadow-lg shadow-rose-900/30">
              <i data-lucide="play" class="w-4 h-4"></i>
              <span>Simulacro Dinámico de Errores</span>
            </button>
          </div>
        </div>

        <!-- Lista de Preguntas Falladas -->
        ${failures.length === 0 ? `
          <div class="text-center py-16 bg-slate-900/50 border border-slate-800 rounded-2xl">
            <i data-lucide="check-circle-2" class="w-12 h-12 text-emerald-400 mx-auto mb-3"></i>
            <h3 class="text-lg font-bold text-white">¡Base de Fallos Vacía!</h3>
            <p class="text-sm text-slate-400 max-w-md mx-auto mt-1">
              No tienes preguntas registradas en la base roja. Sigue entrenando bloques en el simulador.
            </p>
          </div>
        ` : `
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${failures.map(f => {
              const q = store.questions.find(item => String(item.id) === String(f.questionId));
              const mnemonic = store.getMnemonic(f.questionId);
              if (!q) return "";
              return `
                <div class="bg-slate-900 border border-rose-950/60 p-5 rounded-2xl flex flex-col justify-between space-y-3">
                  <div>
                    <div class="flex items-center justify-between text-xs text-slate-400 mb-2">
                      <span class="font-mono font-bold text-rose-400">Pregunta Q#${q.questionNumber} (Bloque ${q.blockNumber})</span>
                      <span class="bg-rose-950/60 text-rose-300 border border-rose-900/60 text-[10px] px-2 py-0.5 rounded-full font-bold">Fallada ${f.failureCount}x</span>
                    </div>
                    <p class="text-sm text-slate-200 line-clamp-3">
                      ${q.question}
                    </p>
                    <div class="text-xs text-slate-400 mt-2">
                      <strong class="text-emerald-400">Respuesta Oficial: ${q.correctAnswer}</strong>
                      ${q.communityVote ? ` | Comunidad: ${q.communityVote}` : ''}
                    </div>
                    ${mnemonic ? `
                      <div class="mt-2.5 p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-300">
                        <span class="font-bold">💡 Nota / Nemotecnia:</span> ${mnemonic.text}
                      </div>
                    ` : ''}
                  </div>

                  <div class="flex items-center justify-between pt-3 border-t border-slate-800">
                    <button onclick="app.launchSingleQuestionReview(${q.id})" class="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                      <span>Repasar Pregunta</span>
                      <i data-lucide="arrow-right" class="w-3 h-3"></i>
                    </button>
                    <button onclick="store.removeFailure(${q.id}); app.renderFailuresView()" class="text-xs text-slate-500 hover:text-rose-400 transition" title="Marcar como superada">
                      Eliminar de fallos
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
    const q = store.questions.find(item => item.id === questionId);
    if (!q) return;

    this.activeSession = {
      type: "single",
      blockNumber: q.blockNumber,
      title: `Repaso Quirúrgico: Pregunta Q#${q.questionNumber}`,
      questions: [q],
      currentIndex: 0,
      userSelected: []
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
    const previewContainer = document.getElementById("ingest-preview");

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
          <span class="text-emerald-400 font-bold">${Math.ceil(questions.length / 25)} Bloques Parkinson</span>
        </div>
        <div class="space-y-2 max-h-48 overflow-y-auto p-2 bg-slate-950 rounded-xl border border-slate-800 text-xs">
          ${sample.map(q => `
            <div class="p-2 border-b border-slate-800 last:border-none">
              <span class="font-bold text-indigo-400">Q#${q.questionNumber}:</span> ${q.question.slice(0, 100)}...
              <div class="text-[10px] text-emerald-400 font-mono mt-0.5">Resp: ${q.correctAnswer} | Opciones: ${Object.keys(q.choices).join(", ")}</div>
            </div>
          `).join("")}
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button onclick="app.confirmAndSaveDump()" class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition">
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

  openRepemillModal(blockNumber) {
    const data = REPEMILL_DATA[blockNumber];
    if (!data) return;

    const modal = document.getElementById("repemill-modal");
    const content = document.getElementById("repemill-modal-content");
    if (!modal || !content) return;

    content.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 class="text-base font-bold text-white">${data.title}</h3>
          <span class="text-xs font-mono text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/50">Bloque ${blockNumber}</span>
        </div>

        <div class="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          ${data.patterns.map(p => `
            <div class="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/60 space-y-1.5 text-xs">
              <div class="flex items-center justify-between">
                <span class="text-amber-400 font-bold">${p.trigger}</span>
                <span class="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded">${p.category}</span>
              </div>
              <div class="text-cyan-300 font-semibold">
                → Servicio Óptimo: ${p.optimalService}
              </div>
              <div class="text-slate-400">
                <strong class="text-rose-400">Descarte Rápido:</strong> ${p.discardPattern}
              </div>
              ${p.mnemonic ? `<div class="text-indigo-300 italic pt-1 border-t border-slate-700/50">💡 Mnemotécnica: ${p.mnemonic}</div>` : ''}
            </div>
          `).join("")}
        </div>
      </div>
    `;

    modal.classList.remove("hidden");
    modal.classList.add("flex");
    if (window.lucide) window.lucide.createIcons();
  }

  closeRepemillModal() {
    const modal = document.getElementById("repemill-modal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }

  // =========================================================================
  // TOAST NOTIFICATIONS
  // =========================================================================

  showToast(message, type = "info", duration = 4000) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    const colors = {
      success: "bg-emerald-600 text-white border-emerald-500 shadow-emerald-950/50",
      error: "bg-rose-600 text-white border-rose-500 shadow-rose-950/50",
      warning: "bg-amber-600 text-white border-amber-500 shadow-amber-950/50",
      info: "bg-slate-800 text-slate-100 border-slate-700 shadow-slate-950/50"
    }[type] || "bg-slate-800 text-white border-slate-700";

    toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-xl text-xs font-semibold animate-fadeIn ${colors}`;
    toast.innerHTML = `<span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("opacity-0", "transition-opacity", "duration-300");
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
}

// Inicialización global
window.app = new App();
