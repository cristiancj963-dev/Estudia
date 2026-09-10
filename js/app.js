/**
 * APLICACIÓN PRINCIPAL (APP CONTROLLER)
 * Single Page Application de Alto Rendimiento para AWS SAP-C02
 * Metodología: Active Recall, Descarte Rápido 2x2, Bloques de Estudio y Repaso Espaciado
 */

class App {
  constructor() {
    this.currentView = "dashboard"; // "dashboard" | "test" | "repemill" | "failures"
    this.activeSession = {
      type: "block", // "block" | "recall_24h"
      mode: "exam",  // "exam" | "review"
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
    // Si no hay preguntas en el store local, cargar el dump preprocesado por defecto
    if (!store.questions || store.questions.length === 0) {
      await this.loadDefaultQuestions();
    }

    this.setupEventListeners();
    this.setupKeyboardShortcuts();
    this.render();
    this.renderPomodoroWidget(this.pomodoro.getTimeData());
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
          if (this.activeSession.type === "block" && this.activeSession.mode === "review") {
            return;
          }
          e.preventDefault();
          this.toggleOptionSelection(letterPicked);
          return;
        }

        // Espacio o Enter: En bloque (examen o revisión) avanza; en recall confirma o avanza
        if (e.key === "Enter" || e.code === "Space") {
          e.preventDefault();
          if (this.activeSession.type === "block") {
            this.nextQuestion();
          } else {
            const qId = String(q.id);
            const sessionAns = this.activeSession.sessionAnswers ? this.activeSession.sessionAnswers[qId] : null;
            const alreadyAnswered = !!sessionAns;
            if (!alreadyAnswered && this.activeSession.userSelected.length > 0) {
              this.confirmAnswer();
            } else if (alreadyAnswered) {
              this.nextQuestion();
            }
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

        // Tecla T: Alternar Cronómetro de Foco (Foco Intenso manual)
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
  // CONTROLADOR DE SESIONES DE TEST (BLOQUES & ACTIVE RECALL)
  // =========================================================================

  startBlockSession(blockNumber) {
    const startIdx = (blockNumber - 1) * 25;
    const endIdx = Math.min(blockNumber * 25, store.questions.length);
    const questions = store.questions.slice(startIdx, endIdx);

    if (questions.length === 0) {
      this.showToast("No hay preguntas disponibles en este bloque.", "error");
      return;
    }

    const isCompleted = store.isBlockCompleted(blockNumber);
    const sessionMode = isCompleted ? "review" : "exam";

    let sessionAnswers = {};
    let initialIndex = 0;

    if (isCompleted) {
      // MODO REVISIÓN: Precargar respuestas evaluadas para este bloque
      questions.forEach(q => {
        const saved = store.answers[String(q.id)];
        if (saved) {
          sessionAnswers[String(q.id)] = { ...saved };
        }
      });
    } else {
      // MODO EXAMEN: Precargar borrador pendiente si existe
      let pending = store.getPendingExam(blockNumber);
      if (pending && pending.sessionAnswers) {
        sessionAnswers = { ...pending.sessionAnswers };
        initialIndex = Math.min(pending.currentIndex || 0, questions.length - 1);
      } else {
        // Migración retroactiva: comprobar si había respuestas parciales guardadas
        const legacyAnswers = {};
        questions.forEach(q => {
          const saved = store.answers[String(q.id)];
          if (saved && saved.selected) {
            legacyAnswers[String(q.id)] = { selected: [...saved.selected] };
          }
        });
        if (Object.keys(legacyAnswers).length > 0) {
          sessionAnswers = legacyAnswers;
          store.savePendingExam(blockNumber, sessionAnswers, 0);
        }
      }
    }

    const firstQ = questions[initialIndex];
    const firstSaved = firstQ ? sessionAnswers[String(firstQ.id)] : null;

    this.activeSession = {
      type: "block",
      mode: sessionMode,
      blockNumber: blockNumber,
      title: isCompleted 
        ? `Revisión Bloque ${blockNumber}: Q${startIdx + 1} - Q${endIdx}`
        : `Examen Bloque ${blockNumber}: Q${startIdx + 1} - Q${endIdx}`,
      questions: questions,
      currentIndex: initialIndex,
      userSelected: firstSaved ? [...firstSaved.selected] : [],
      sessionAnswers: sessionAnswers,
      startedAt: new Date().toISOString()
    };

    // No activar foco intenso automáticamente: el usuario lo inicia manualmente cuando lo desee
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
      mode: "review",
      blockNumber: 0,
      title: `Active Recall: ${recallQuestions.length} Preguntas Críticas`,
      questions: recallQuestions,
      currentIndex: 0,
      userSelected: [],
      sessionAnswers: {}, // ¡Mesa limpia! Ninguna respuesta marcada para Active Recall en frío
      startedAt: new Date().toISOString(),
      initialNetScore: store.getGlobalStats().netScore
    };

    // No activar foco intenso automáticamente: el usuario lo inicia manualmente cuando lo desee
    this.navigate("test");
  }

  toggleOptionSelection(letter) {
    const q = this.activeSession.questions[this.activeSession.currentIndex];
    if (!q) return;

    const isBlock = this.activeSession.type === "block";
    const isReview = isBlock && this.activeSession.mode === "review";

    // En modo revisión de un bloque completado, las respuestas son de solo lectura
    if (isReview) return;

    // En recall_24h, si ya está respondida y confirmada, no modificar
    if (!isBlock) {
      const sessionAns = this.activeSession.sessionAnswers ? this.activeSession.sessionAnswers[String(q.id)] : null;
      if (sessionAns) return;
    }

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

    // En Modo Examen de Bloque: guardar inmediatamente la selección en sessionAnswers y persistir borrador
    if (isBlock && this.activeSession.mode === "exam") {
      if (!this.activeSession.sessionAnswers) this.activeSession.sessionAnswers = {};
      const qId = String(q.id);
      if (this.activeSession.userSelected.length > 0) {
        this.activeSession.sessionAnswers[qId] = {
          selected: [...this.activeSession.userSelected]
          // isCorrect NO se define aquí: se evaluará solo al finalizar el bloque
        };
      } else {
        delete this.activeSession.sessionAnswers[qId];
      }
      store.savePendingExam(this.activeSession.blockNumber, this.activeSession.sessionAnswers, this.activeSession.currentIndex);
    }

    this.renderTestView();
  }

  confirmAnswer() {
    const q = this.activeSession.questions[this.activeSession.currentIndex];
    const qId = String(q.id);
    const selectedSorted = [...this.activeSession.userSelected].sort().join("");
    const effectiveCorrect = store.getEffectiveCorrectAnswer(q);
    const isCorrect = selectedSorted === effectiveCorrect;

    // Guardar en sessionAnswers de la sesión activa
    if (!this.activeSession.sessionAnswers) this.activeSession.sessionAnswers = {};
    this.activeSession.sessionAnswers[qId] = {
      selected: [...this.activeSession.userSelected],
      isCorrect: isCorrect,
      timestamp: new Date().toISOString()
    };

    // Registrar en el Store persistente
    if (this.activeSession.type === "recall_24h") {
      store.recordRecallAnswer(q.id, this.activeSession.userSelected, isCorrect, q.question.slice(0, 100));
    } else {
      store.recordAnswer(q.id, this.activeSession.userSelected, isCorrect, q.question.slice(0, 100));
    }

    // Feedback sonoro sintético
    if (store.settings.soundEnabled) {
      if (isCorrect) {
        this.pomodoro.playTone(880, "sine", 0.12, 0.08);
      } else {
        this.pomodoro.playTone(220, "sawtooth", 0.25, 0.1);
      }
    }

    this.renderTestView();

    // Avance rápido automático si acierta y está configurado
    if (isCorrect && store.settings.autoAdvanceOnCorrect) {
      setTimeout(() => {
        if (this.activeSession.questions[this.activeSession.currentIndex] && this.activeSession.questions[this.activeSession.currentIndex].id === q.id) {
          if (this.activeSession.currentIndex < this.activeSession.questions.length - 1) {
            this.nextQuestion();
          }
        }
      }, 900);
    }
  }

  nextQuestion() {
    if (this.activeSession.currentIndex < this.activeSession.questions.length - 1) {
      this.activeSession.currentIndex++;
      const nextQ = this.activeSession.questions[this.activeSession.currentIndex];
      const sessionAns = this.activeSession.sessionAnswers ? this.activeSession.sessionAnswers[String(nextQ.id)] : null;
      this.activeSession.userSelected = sessionAns ? [...sessionAns.selected] : [];
      if (this.activeSession.type === "block" && this.activeSession.mode === "exam") {
        store.savePendingExam(this.activeSession.blockNumber, this.activeSession.sessionAnswers, this.activeSession.currentIndex);
      }
      this.renderTestView();
      window.scrollTo(0, 0);
    } else {
      // Si está en la última pregunta, sugerir finalizar la sesión
      this.requestFinishSession();
    }
  }

  prevQuestion() {
    if (this.activeSession.currentIndex > 0) {
      this.activeSession.currentIndex--;
      const prevQ = this.activeSession.questions[this.activeSession.currentIndex];
      const sessionAns = this.activeSession.sessionAnswers ? this.activeSession.sessionAnswers[String(prevQ.id)] : null;
      this.activeSession.userSelected = sessionAns ? [...sessionAns.selected] : [];
      if (this.activeSession.type === "block" && this.activeSession.mode === "exam") {
        store.savePendingExam(this.activeSession.blockNumber, this.activeSession.sessionAnswers, this.activeSession.currentIndex);
      }
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
      if (this.activeSession.type === "block" && this.activeSession.mode === "exam") {
        store.savePendingExam(this.activeSession.blockNumber, this.activeSession.sessionAnswers, this.activeSession.currentIndex);
      }
      this.renderTestView();
      window.scrollTo(0, 0);
    }
  }

  requestFinishSession() {
    const totalQ = this.activeSession.questions.length;
    const sessionAnswers = this.activeSession.sessionAnswers || {};

    let answeredCount = 0;
    this.activeSession.questions.forEach(q => {
      const ans = sessionAnswers[String(q.id)];
      if (ans && ans.selected && ans.selected.length > 0) {
        answeredCount++;
      }
    });

    const unansweredCount = totalQ - answeredCount;

    if (this.activeSession.type === "recall_24h") {
      if (unansweredCount > 0) {
        const confirmMsg = `Tienes ${unansweredCount} pregunta(s) sin responder de ${totalQ}. Se contabilizarán como fallos. ¿Seguro que deseas finalizar el simulacro de errores ahora?`;
        if (!confirm(confirmMsg)) return;
      }
    } else if (this.activeSession.type === "block") {
      if (this.activeSession.mode === "exam") {
        if (unansweredCount > 0) {
          const confirmMsg = `Tienes ${unansweredCount} pregunta(s) sin responder de ${totalQ}. Las preguntas no respondidas se marcarán como erróneas. ¿Deseas finalizar el examen y ver los resultados?`;
          if (!confirm(confirmMsg)) return;
        } else {
          const confirmMsg = `Has respondido las ${totalQ} preguntas. ¿Deseas finalizar el examen ahora y ver tus resultados?`;
          if (!confirm(confirmMsg)) return;
        }
      } else {
        // En modo revisión, Finalizar redirige al Dashboard
        this.navigate("dashboard");
        return;
      }
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
        if (ans && ans.selected && ans.selected.length > 0) {
          if (ans.isCorrect) correctCount++;
          else failedCount++;
        } else {
          unansweredCount++;
          failedCount++;
          sessionAnswers[qId] = {
            selected: [],
            isCorrect: false,
            unanswered: true,
            timestamp: new Date().toISOString()
          };
          store.recordRecallAnswer(q.id, [], false, q.question.slice(0, 100));
        }
      });

      if (window.confetti) {
        window.confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
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
      // EVALUAR BLOQUE OFICIAL (CORRECCIÓN FINAL)
      const blockNum = this.activeSession.blockNumber;
      let correctCount = 0;
      let failedCount = 0;
      let unansweredCount = 0;

      this.activeSession.questions.forEach(q => {
        const qId = String(q.id);
        const ans = sessionAnswers[qId];
        const effectiveCorrect = store.getEffectiveCorrectAnswer(q);

        if (ans && ans.selected && ans.selected.length > 0) {
          const selectedSorted = [...ans.selected].sort().join("");
          const isCorrect = selectedSorted === effectiveCorrect;

          ans.isCorrect = isCorrect;
          ans.unanswered = false;
          ans.timestamp = ans.timestamp || new Date().toISOString();

          if (isCorrect) {
            correctCount++;
          } else {
            failedCount++;
          }

          // Registrar oficialmente en el Store
          store.recordAnswer(q.id, ans.selected, isCorrect, q.question.slice(0, 100));
        } else {
          // Pregunta dejada sin responder: se contabiliza y marca como errónea
          unansweredCount++;
          failedCount++;

          const blankAnswer = {
            selected: [],
            isCorrect: false,
            unanswered: true,
            timestamp: new Date().toISOString()
          };
          sessionAnswers[qId] = blankAnswer;

          // Registrar oficialmente en el Store como fallo
          store.recordAnswer(q.id, [], false, q.question.slice(0, 100));
        }
      });

      const evaluatedCount = correctCount + failedCount;
      const accuracy = evaluatedCount > 0 ? Math.round((correctCount / evaluatedCount) * 100) : 0;
      const netScore = Math.max(0, +(correctCount - (failedCount / 3)).toFixed(1));

      // Guardar bloque como completado en el Store y limpiar borrador
      store.markBlockCompleted(blockNum, {
        totalQuestions: totalQ,
        correctCount,
        failedCount,
        unansweredCount,
        accuracy,
        netScore
      });

      // Transicionar la sesión activa a MODO REVISIÓN
      this.activeSession.mode = "review";
      const startIdx = (blockNum - 1) * 25;
      const endIdx = Math.min(blockNum * 25, store.questions.length);
      this.activeSession.title = `Revisión Bloque ${blockNum}: Q${startIdx + 1} - Q${endIdx}`;

      // Posicionar en la primera pregunta para facilitar la revisión
      this.activeSession.currentIndex = 0;
      const firstQ = this.activeSession.questions[0];
      const firstAns = firstQ ? sessionAnswers[String(firstQ.id)] : null;
      this.activeSession.userSelected = firstAns ? [...firstAns.selected] : [];

      if (window.confetti) {
        window.confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }

      if (store.settings.soundEnabled) {
        if (accuracy >= 75) {
          this.pomodoro.playTone(880, "sine", 0.15, 0.08);
        } else {
          this.pomodoro.playTone(440, "sine", 0.2, 0.08);
        }
      }

      this.showBlockCompletionModal({
        blockNumber: blockNum,
        totalQuestions: totalQ,
        correctCount,
        failedCount,
        unansweredCount,
        accuracy,
        netScore
      });

      // Re-renderizar la vista de test en segundo plano (para que al cerrar el modal ya esté en modo revisión)
      this.renderTestView();
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
    const content = `
      <div class="text-center space-y-4">
        <div class="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
          <i data-lucide="award" class="w-8 h-8"></i>
        </div>

        <div>
          <span class="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Sesión ${data.blockNumber} Finalizada</span>
          <h2 class="text-2xl font-black text-white mt-1">¡Examen de Bloque Finalizado!</h2>
          <p class="text-xs text-slate-400 mt-1">Has completado el examen oficial. A continuación se muestran tus resultados y correcciones detalladas.</p>
        </div>

        <!-- Grid de Estadísticas del Bloque -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div class="bg-slate-950/80 p-3 rounded-2xl border border-slate-800 text-center">
            <span class="text-[10px] uppercase font-bold text-slate-400 block">Punt. Neta</span>
            <span class="text-xl font-extrabold text-indigo-400 font-mono">${data.netScore}</span>
          </div>
          <div class="bg-slate-950/80 p-3 rounded-2xl border border-slate-800 text-center">
            <span class="text-[10px] uppercase font-bold text-slate-400 block">Precisión</span>
            <span class="text-xl font-extrabold ${data.accuracy >= 75 ? 'text-emerald-400' : 'text-amber-400'} font-mono">${data.accuracy}%</span>
          </div>
          <div class="bg-slate-950/80 p-3 rounded-2xl border border-slate-800 text-center">
            <span class="text-[10px] uppercase font-bold text-slate-400 block">Aciertos</span>
            <span class="text-xl font-extrabold text-emerald-400 font-mono">${data.correctCount}</span>
          </div>
          <div class="bg-slate-950/80 p-3 rounded-2xl border border-slate-800 text-center">
            <span class="text-[10px] uppercase font-bold text-slate-400 block">Fallos</span>
            <span class="text-xl font-extrabold text-rose-400 font-mono">${data.failedCount}</span>
          </div>
        </div>

        ${data.unansweredCount > 0 ? `
          <div class="text-[11px] text-rose-300 bg-rose-950/40 border border-rose-500/30 p-2.5 rounded-xl">
            ⚠️ Dejaste ${data.unansweredCount} pregunta(s) sin responder (contabilizadas como erróneas).
          </div>
        ` : ''}

        <!-- Botones de Acción -->
        <div class="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 border-t border-slate-800">
          <button onclick="app.closeCompletionModal()" class="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2.5 rounded-xl text-xs transition">
            <i data-lucide="eye" class="w-4 h-4"></i>
            <span>Revisar Respuestas y Explicaciones</span>
          </button>
          <button onclick="app.closeCompletionModal(); app.navigate('dashboard')" class="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-5 py-2.5 rounded-xl text-xs border border-slate-700 transition">
            <i data-lucide="layout-dashboard" class="w-4 h-4"></i>
            <span>Dashboard</span>
          </button>
          <button onclick="app.closeCompletionModal(); app.openSyncModal()" class="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 font-semibold px-5 py-2.5 rounded-xl text-xs border border-slate-700 transition">
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
        <div class="w-16 h-16 rounded-3xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/30">
          <i data-lucide="flame" class="w-8 h-8 text-amber-400"></i>
        </div>

        <div>
          <span class="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Simulacro Dinámico de Errores</span>
          <h2 class="text-2xl font-black text-white mt-1">¡Consolidación Finalizada!</h2>
          <p class="text-xs text-slate-400 mt-1">Has reevaluado ${data.totalQuestions} preguntas críticas en Active Recall.</p>
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
            <span class="text-[10px] text-slate-400 block mt-0.5">Pendientes de repaso 24h</span>
          </div>

          <div class="bg-indigo-950/30 border border-indigo-500/40 p-4 rounded-2xl text-center">
            <span class="text-2xl font-black text-indigo-400 font-mono block">${data.netScoreGain >= 0 ? '+' : ''}${data.netScoreGain}</span>
            <span class="text-xs font-bold text-indigo-300 block mt-1">Puntuación Neta</span>
            <span class="text-[10px] text-slate-400 block mt-0.5">Recuperada en el total</span>
          </div>
        </div>

        <!-- Botones de Acción -->
        <div class="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 border-t border-slate-800">
          <button onclick="app.closeCompletionModal()" class="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2.5 rounded-xl text-xs transition">
            <i data-lucide="eye" class="w-4 h-4"></i>
            <span>Revisar Preguntas</span>
          </button>
          <button onclick="app.closeCompletionModal(); app.navigate('failures')" class="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-rose-300 font-semibold px-5 py-2.5 rounded-xl text-xs border border-slate-700 transition">
            <i data-lucide="alert-octagon" class="w-4 h-4"></i>
            <span>Base de Fallos</span>
          </button>
          <button onclick="app.closeCompletionModal(); app.navigate('dashboard')" class="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-5 py-2.5 rounded-xl text-xs border border-slate-700 transition">
            <i data-lucide="layout-dashboard" class="w-4 h-4"></i>
            <span>Dashboard</span>
          </button>
          <button onclick="app.closeCompletionModal(); app.openSyncModal()" class="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 font-semibold px-5 py-2.5 rounded-xl text-xs border border-slate-700 transition">
            <i data-lucide="cloud-upload" class="w-4 h-4"></i>
            <span>Subir a Drive</span>
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
    this.openForceAnswerModal(questionId);
  }

  revertCorrectAnswer(questionId) {
    this.resetForcedAnswer(questionId);
  }

  /**
   * Abre un modal interactivo para que el usuario pueda elegir qué opción o combinación
   * considerar correcta (A, B, C, D...), o restaurar al consenso de la comunidad o clave oficial.
   */
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
      modal.className = "fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn";
      modal.innerHTML = `
        <div class="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          
          <!-- Modal Header -->
          <div class="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-850">
            <div class="flex items-center gap-2.5">
              <span class="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
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
            <button onclick="app.closeForceAnswerModal()" class="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>

          <!-- Modal Body -->
          <div class="p-5 space-y-4 overflow-y-auto flex-1">
            
            <!-- Estado Actual -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div class="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-1">
                <span class="text-slate-400 block text-[10px] uppercase font-semibold">Consenso Comunidad:</span>
                <span class="font-mono font-bold text-emerald-400 text-sm">${commVote || 'N/A'}</span>
                ${q.communityVote ? `<div class="text-[10px] text-slate-500 truncate">${q.communityVote}</div>` : ''}
              </div>
              <div class="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-1">
                <span class="text-slate-400 block text-[10px] uppercase font-semibold">Clave Oficial Examen:</span>
                <span class="font-mono font-bold text-slate-200 text-sm">${officialAns}</span>
                <div class="text-[10px] text-slate-500">Dump / oficial original</div>
              </div>
              <div class="bg-slate-950/80 p-3 rounded-xl border ${hasCustom ? 'border-amber-500/50 bg-amber-950/20' : 'border-slate-800'} space-y-1">
                <span class="text-slate-400 block text-[10px] uppercase font-semibold">Activa en tu Sistema:</span>
                <div class="flex items-center gap-1.5">
                  <span class="font-mono font-bold ${hasCustom ? 'text-amber-400' : 'text-emerald-400'} text-sm">${currentEffective}</span>
                  <span class="text-[9px] px-1.5 py-0.5 rounded ${hasCustom ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}">
                    ${hasCustom ? 'Personalizada' : 'Por Defecto'}
                  </span>
                </div>
              </div>
            </div>

            <!-- Enunciado corto -->
            <div class="text-xs text-slate-300 bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
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
                  <div onclick="app.toggleModalLetter('${letter}', ${isMulti})" class="flex items-start gap-3 p-3 rounded-xl border ${isChecked ? 'border-amber-500/60 bg-amber-950/30 ring-1 ring-amber-500/40' : 'border-slate-800 bg-slate-950/60 hover:bg-slate-800/50'} cursor-pointer transition">
                    <div class="w-5 h-5 rounded-md flex items-center justify-center font-mono text-xs font-bold ${isChecked ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'} mt-0.5">
                      ${letter}
                    </div>
                    <div class="flex-1 text-xs text-slate-200 leading-relaxed">
                      ${text}
                      <div class="flex items-center gap-2 mt-1.5">
                        ${isComm ? '<span class="text-[10px] text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono">Consenso Comunidad</span>' : ''}
                        ${isOff ? '<span class="text-[10px] text-slate-400 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded font-mono">Clave Oficial</span>' : ''}
                      </div>
                    </div>
                    ${isChecked ? '<i data-lucide="check" class="w-4 h-4 text-amber-400 flex-shrink-0 mt-1"></i>' : ''}
                  </div>
                `;
              }).join("")}
            </div>

          </div>

          <!-- Modal Footer / Acciones Rápidas -->
          <div class="p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              ${commVote ? `
                <button onclick="app.applyModalAnswer('${q.id}', '${commVote}')" class="text-xs bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 px-3 py-1.5 rounded-xl font-semibold transition">
                  Usar Comunidad (${commVote})
                </button>
              ` : ''}
              <button onclick="app.applyModalAnswer('${q.id}', '${officialAns}')" class="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-xl font-semibold transition">
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
              <button onclick="app.saveCustomModalSelection('${q.id}')" class="text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl transition shadow-md flex items-center gap-1.5">
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
    
    // 1. Guardar el estado JSON en trozos seguros (evita límite de celda de 50.000 caracteres)
    backupSheet.clear();
    var chunkSize = 30000;
    var numChunks = Math.ceil(payload.length / chunkSize);
    var chunks = [];
    for (var i = 0; i < numChunks; i++) {
      chunks.push([payload.substr(i * chunkSize, chunkSize)]);
    }
    backupSheet.getRange(1, 1, chunks.length, 1).setValues(chunks);
    
    // 2. Generar Hoja Visual de Resumen
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
    
    summarySheet.getRange("A1:B1").setFontWeight("bold").setBackground("#4f46e5").setFontColor("#ffffff");
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
      if (!modal) {
        console.error("No se encontró el elemento sync-modal");
        return;
      }
      
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
      const modal = document.getElementById("sync-modal");
      if (modal) {
        modal.classList.remove("hidden");
        modal.classList.add("flex");
        modal.style.display = "flex";
      }
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
        dot.className = "w-2.5 h-2.5 rounded-full bg-amber-400";
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
      this.showToast("❌ Has pegado el enlace de la hoja (docs.google.com). Debes pegar la URL de la Web App de Apps Script (script.google.com/.../exec). Despliega la guía de abajo.", "error", 9000);
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
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(() => {
        this.showToast("Código Apps Script copiado al portapapeles.", "success");
      }).catch(() => {
        this.showToast("Selecciona y copia el código manualmente.", "warning");
      });
    } else {
      this.showToast("Copia el código directamente desde el recuadro.", "info");
    }
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
        input.classList.add("ring-2", "ring-amber-400");
        setTimeout(() => input.classList.remove("ring-2", "ring-amber-400"), 2500);
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
      // Google Apps Script requiere text/plain para evitar preflight CORS
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
        input.classList.add("ring-2", "ring-amber-400");
        setTimeout(() => input.classList.remove("ring-2", "ring-amber-400"), 2500);
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

  renderFocusWidget(data) {
    return this.renderPomodoroWidget(data);
  }

  renderPomodoroWidget(data) {
    const el = document.getElementById("focus-display") || document.getElementById("pomodoro-display");
    if (el) {
      const modeLabel = data.mode === "focus" ? "Foco Intenso" : "Descanso";
      const playIcon = data.isRunning ? "pause" : "play";

      el.innerHTML = `
        <div class="flex items-center gap-1.5 sm:gap-2.5 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl px-2 sm:px-3 py-1 sm:py-1.5 shadow-lg ${data.isRunning && data.mode === 'focus' ? 'focus-active-pulse' : ''}">
          <div class="flex flex-col">
            <div class="flex items-center gap-1 sm:gap-1.5">
              <span class="inline-block w-2 h-2 rounded-full ${data.isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}"></span>
              <span class="text-xs sm:text-sm font-mono font-bold tracking-tight text-white">${data.formatted}</span>
            </div>
            <span class="hidden sm:inline text-[9px] uppercase tracking-wider font-semibold text-slate-400">${modeLabel}</span>
          </div>
          <div class="flex items-center gap-0.5 sm:gap-1">
            <button onclick="app.pomodoro.toggle()" class="p-1 sm:p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition" title="${data.isRunning ? 'Pausar Foco' : 'Iniciar Foco Intenso'}">
              <i data-lucide="${playIcon}" class="w-3.5 h-3.5"></i>
            </button>
            <button onclick="app.pomodoro.reset()" class="hidden sm:inline-flex p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition" title="Reiniciar">
              <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      `;
    }

    const testFocusBtn = document.getElementById("test-focus-btn") || document.getElementById("test-pomo-btn");
    if (testFocusBtn) {
      testFocusBtn.innerHTML = `
        <i data-lucide="${data.isRunning ? 'pause' : 'play'}" class="w-3.5 h-3.5 ${data.isRunning ? 'text-indigo-400' : ''}"></i>
        <span class="font-mono text-xs font-bold">${data.formatted}</span>
        <span class="hidden xl:inline text-[10px] uppercase font-semibold text-slate-400 ml-0.5">${data.mode === 'focus' ? 'Foco' : 'Descanso'}</span>
        <span class="key-badge ml-1 hidden lg:inline-flex">T</span>
      `;
      testFocusBtn.className = `flex items-center gap-1.5 text-xs font-semibold py-1.5 px-2.5 rounded-lg border transition ${data.isRunning ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50 focus-active-pulse' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'}`;
      testFocusBtn.title = `${data.isRunning ? 'Pausar Foco Intenso' : 'Activar Foco Intenso Manualmente'} [T]`;
    }

    if (window.lucide) window.lucide.createIcons();
  }

  // =========================================================================
  // VISTA 1: DASHBOARD GENERAL (BLOQUES & MÉTRICAS)
  // =========================================================================

  renderDashboard() {
    const container = document.getElementById("view-container");
    const stats = store.getGlobalStats();
    const blocks = store.getBlocksSummary();
    const recallCount = store.getRecallQuestions().length;

    container.innerHTML = `
      <div class="max-w-7xl mx-auto space-y-8 animate-fadeIn">
        
        <!-- Header Principal & Estado de Preparación -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-800 shadow-xl">
          <div>
            <div class="flex items-center gap-2 text-indigo-400 font-semibold text-xs uppercase tracking-wider mb-1">
              <i data-lucide="shield-check" class="w-4 h-4"></i>
              AWS Solutions Architect Professional (SAP-C02)
            </div>
            <h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Plataforma de Entrenamiento Intensivo <span class="text-indigo-400 font-mono">SAP-C02</span>
            </h1>
            <p class="text-slate-400 text-sm mt-1">
              Simulacros de examen en bloques de 25 preguntas, corrección al finalizar y repetición espaciada 24h.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <button onclick="app.openSyncModal()" class="flex-1 sm:flex-initial justify-center flex items-center gap-2 bg-indigo-950/70 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-500/40 px-3.5 py-2 rounded-xl text-sm font-semibold transition shadow-sm">
              <i data-lucide="cloud" class="w-4 h-4 text-indigo-400"></i>
              <span>Drive Sync</span>
            </button>

            <button onclick="app.openIngestModal()" class="flex-1 sm:flex-initial justify-center flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-sm font-semibold border border-slate-700 transition shadow-sm">
              <i data-lucide="upload-cloud" class="w-4 h-4 text-cyan-400"></i>
              <span>Cargar Dump</span>
            </button>

            <button onclick="app.startRecallSession()" class="w-full sm:w-auto justify-center flex items-center gap-2 ${recallCount > 0 ? 'bg-rose-600 hover:bg-rose-500 animate-pulse' : 'bg-slate-800 text-slate-400'} text-white px-4 py-2 rounded-xl text-sm font-semibold transition shadow-lg shadow-rose-900/20">
              <i data-lucide="flame" class="w-4 h-4"></i>
              <span>Active Recall (${recallCount})</span>
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

          <!-- Sesiones de Enfoque (Foco Intenso) -->
          <div class="col-span-2 lg:col-span-1 bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
            <div class="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
              <span>Sesiones de Enfoque</span>
              <i data-lucide="clock" class="w-4 h-4 text-indigo-400"></i>
            </div>
            <div class="mt-2 text-2xl sm:text-3xl font-extrabold text-indigo-400 font-mono">
              ${stats.completedFocusSessions || stats.completedPomodoros} <span class="text-sm font-normal text-slate-400">bloques</span>
            </div>
            <div class="text-xs text-slate-400 mt-1">
              ${stats.totalFocusMinutes} min en pico de atención
            </div>
          </div>
        </div>

        <!-- Grid de Sesiones / Bloques de Entrenamiento (25 Preguntas Cada Una) -->
        <div>
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <i data-lucide="layout-grid" class="w-5 h-5 text-indigo-400"></i>
                Sesiones de Entrenamiento (Bloques de 25 Preguntas)
              </h2>
              <p class="text-xs text-slate-400 mt-0.5">
                Cada bloque de 25 preguntas está calibrado para completarse en 35 minutos de foco sin fatiga mental.
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
              <span>${b.status === 'completed' ? `Finalizado: ${b.answered}/${b.total}` : (b.status === 'in_progress' ? `En examen: ${b.answered}/${b.total}` : `Sin iniciar (${b.total} preguntas)`)}</span>
              ${b.status === 'completed' ? `<span class="font-semibold ${b.accuracy >= 75 ? 'text-emerald-400' : 'text-amber-400'}">${b.accuracy}% acierto (Neto: ${b.netScore})</span>` : `<span class="text-slate-500">Modo Examen</span>`}
            </div>
            <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div class="bg-indigo-500 h-full rounded-full transition-all duration-500" style="width: ${(b.answered / (b.total || 1)) * 100}%"></div>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 pt-2 border-t border-slate-800/80">
          <button onclick="app.startBlockSession(${b.blockNumber})" class="flex-1 flex items-center justify-center gap-1.5 ${b.status === 'completed' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-500'} text-white py-2 px-3 rounded-xl text-xs font-semibold transition shadow-sm">
            <i data-lucide="${b.status === 'completed' ? 'eye' : 'play'}" class="w-3.5 h-3.5"></i>
            <span>${b.status === 'completed' ? 'Revisar Respuestas' : (b.status === 'in_progress' ? 'Continuar Examen' : 'Comenzar Examen')}</span>
          </button>

          ${(b.status === 'completed' || b.answered > 0) ? `
            <button onclick="app.confirmResetBlock(${b.blockNumber})" class="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 border border-slate-700/60 hover:border-rose-900/60 transition" title="Reiniciar Bloque (Borrar respuestas y repetir examen)">
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
    const isBlock = this.activeSession.type === "block";
    const isExam = isBlock && this.activeSession.mode === "exam";
    const isReview = isBlock && this.activeSession.mode === "review";
    const isRecall = this.activeSession.type === "recall_24h";

    const sessionAns = this.activeSession.sessionAnswers ? this.activeSession.sessionAnswers[qId] : null;
    const existingAnswer = sessionAns;
    const answeredSelected = sessionAns ? (sessionAns.selected || []) : [];
    const isGraded = !isExam && sessionAns && typeof sessionAns.isCorrect === "boolean";
    const isDoubt = store.isDoubt(q.id);
    const userMnemonic = store.getMnemonic(q.id);

    const isMulti = (q.multiSelectCount || 1) > 1;
    const requiredChoicesText = isMulti ? `(Selecciona ${q.multiSelectCount} opciones)` : `(Selección única)`;

    // Preparar opciones A, B, C, D, etc.
    const choicesEntries = Object.entries(q.choices || {});
    const effectiveCorrect = store.getEffectiveCorrectAnswer(q);
    const effectiveCorrectLetters = (effectiveCorrect || "").split("");
    const hasCustomOverride = store.hasCustomCorrectAnswer(q.id);
    const commVoteAns = store.getCommunityVoteAnswer(q);
    const officialAns = store.getOfficialAnswer(q);

    container.innerHTML = `
      <div class="max-w-4xl mx-auto space-y-4 pb-20 animate-fadeIn">
        
        <!-- Barra de Control del Test (Header Zen / Test Header Bar) -->
        <div class="test-header-bar flex items-center justify-between bg-slate-900/95 border border-slate-800 p-2 sm:p-3 rounded-2xl shadow-lg sticky top-2 sm:top-3 z-30 backdrop-blur transition-all">
          <div class="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1 mr-1 sm:mr-2">
            <button onclick="app.navigate('dashboard')" class="flex-shrink-0 flex items-center gap-1 text-slate-400 hover:text-white text-xs font-semibold p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition" title="Volver al Dashboard">
              <i data-lucide="arrow-left" class="w-4 h-4 sm:w-3.5 sm:h-3.5"></i>
              <span class="hidden sm:inline">Dashboard</span>
            </button>

            <div class="flex flex-col min-w-0">
              <div class="flex items-center gap-1 sm:gap-2">
                <span class="text-xs font-bold text-white tracking-tight truncate">${this.activeSession.title}</span>
                ${isExam ? `<span class="hidden sm:inline-block bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase flex-shrink-0">Examen</span>` : ''}
                ${isReview ? `<span class="hidden sm:inline-block bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase flex-shrink-0">Revisión</span>` : ''}
              </div>
              <span class="text-[10px] sm:text-[11px] text-slate-400 truncate">Q ${this.activeSession.currentIndex + 1} de ${totalQ} ${isMulti ? `(Elige ${q.multiSelectCount})` : ''}</span>
            </div>
          </div>

          <div class="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <!-- Botón de Duda (Amarilla) -->
            <button onclick="app.toggleCurrentDoubt()" class="flex items-center gap-1 text-xs font-semibold py-1.5 px-2 sm:px-3 rounded-lg border transition ${isDoubt ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'}" title="Marcar como Dudosa [D]">
              <i data-lucide="help-circle" class="w-3.5 h-3.5 ${isDoubt ? 'text-amber-400' : ''}"></i>
              <span class="hidden md:inline">${isDoubt ? 'Dudosa' : 'Marcar Duda'}</span>
            </button>

            <!-- Botón Ver Repemill del Bloque (Solo en Revisión o Pregunta Calificada) -->
            ${(isReview || isGraded) ? `
              <button onclick="app.openRepemillModal(${q.blockNumber})" class="flex items-center gap-1 text-xs font-semibold py-1.5 px-2 sm:px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-400 border border-slate-700 transition" title="Patrones del Bloque">
                <i data-lucide="book-open" class="w-3.5 h-3.5"></i>
                <span class="hidden md:inline">Repemill</span>
              </button>
            ` : ''}

            <!-- Botón Finalizar / Salir -->
            ${isReview ? `
              <button onclick="app.navigate('dashboard')" class="flex items-center gap-1 text-xs font-bold py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition" title="Volver al Dashboard">
                <i data-lucide="layout-dashboard" class="w-3.5 h-3.5"></i>
                <span class="hidden sm:inline">Dashboard</span>
              </button>
            ` : `
              <button onclick="app.requestFinishSession()" class="flex items-center gap-1 text-xs font-bold py-1.5 px-2 sm:px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition" title="Finalizar Sesión y ver Resultados">
                <i data-lucide="check-square" class="w-3.5 h-3.5"></i>
                <span class="text-xs">Finalizar</span>
              </button>
            `}

            <!-- Botón Reiniciar Bloque en Curso (solo sm+) -->
            ${isBlock ? `
              <button onclick="app.confirmResetBlock(${this.activeSession.blockNumber})" class="hidden sm:flex items-center gap-1 text-xs font-semibold py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700 transition" title="Reiniciar este Bloque desde cero">
                <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                <span class="hidden lg:inline">Reiniciar</span>
              </button>
            ` : ''}

            <!-- Botón Foco Intenso (Manual) (en móvil está en el cronómetro global, aquí para sm+) -->
            <button id="test-focus-btn" onclick="app.pomodoro.toggle()" class="hidden sm:flex items-center gap-1.5 text-xs font-semibold py-1.5 px-2.5 rounded-lg border transition ${this.pomodoro.isRunning ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50 focus-active-pulse' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'}" title="${this.pomodoro.isRunning ? 'Pausar Foco Intenso' : 'Activar Foco Intenso Manualmente'} [T]">
              <i data-lucide="${this.pomodoro.isRunning ? 'pause' : 'play'}" class="w-3.5 h-3.5 ${this.pomodoro.isRunning ? 'text-indigo-400' : ''}"></i>
              <span class="font-mono text-xs font-bold">${this.pomodoro.getTimeData().formatted}</span>
            </button>

            <!-- Modo Zen -->
            <button onclick="app.toggleZenMode()" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition" title="Modo Zen [Z]">
              <i data-lucide="${store.settings.zenMode ? 'minimize-2' : 'maximize-2'}" class="w-3.5 h-3.5 sm:w-4 sm:h-4"></i>
            </button>
          </div>
        </div>

        <!-- Selector Compacto de Preguntas (Números pequeños centrados) -->
        <div class="flex items-center justify-center w-full overflow-hidden px-1">
          <div class="inline-flex flex-wrap items-center justify-center gap-1 bg-slate-900/80 border border-slate-800/80 px-2 py-1 rounded-xl shadow-sm max-w-full">
            ${this.activeSession.questions.map((item, idx) => {
              const itemAns = this.activeSession.sessionAnswers ? this.activeSession.sessionAnswers[String(item.id)] : null;
              const itemIsAnswered = itemAns && itemAns.selected && itemAns.selected.length > 0;
              const itemDoubt = store.isDoubt(item.id);
              const isCurrent = idx === this.activeSession.currentIndex;

              let dotColor = "bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700";
              if (isExam) {
                if (itemDoubt) dotColor = "bg-amber-500/30 border-amber-500/70 text-amber-200 ring-1 ring-amber-400/40";
                else if (itemIsAnswered) dotColor = "bg-indigo-600/80 border-indigo-500 text-white font-bold";
              } else if (itemAns) {
                if (itemAns.isCorrect) dotColor = "bg-emerald-600/80 border-emerald-500 text-white font-bold";
                else dotColor = "bg-rose-600/80 border-rose-500 text-white font-bold";
              } else if (itemDoubt) {
                dotColor = "bg-amber-500/30 border-amber-500/60 text-amber-300";
              }

              return `
                <button onclick="app.jumpToQuestion(${idx})" class="w-6 h-6 rounded-md text-[10px] font-mono flex items-center justify-center border transition-all ${dotColor} ${isCurrent ? 'ring-2 ring-indigo-400 scale-110 z-10 font-bold bg-indigo-700 border-indigo-400 text-white shadow-sm' : ''}" title="Ir a pregunta ${idx + 1} ${itemAns && itemAns.unanswered ? '(Sin responder - Errónea)' : (itemDoubt ? '(Dudosa)' : '')}">
                  ${idx + 1}
                </button>
              `;
            }).join("")}
          </div>
        </div>

        <!-- Tarjeta Central de la Pregunta (Mesa de Estudio Limpia) -->
        <div class="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-2xl space-y-4 sm:space-y-6">
          
          <!-- Encabezado de Pregunta -->
          <div class="flex items-center justify-between text-xs text-slate-400 pb-3 border-b border-slate-800/80 flex-wrap gap-2">
            <span class="font-mono font-bold text-indigo-400 uppercase tracking-wider">Identificador: Q#${q.questionNumber}</span>
            <div class="flex items-center gap-2">
              ${(isGraded || isReview) && q.communityVote ? `<span class="bg-slate-800 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[11px] font-mono">Comunidad: ${q.communityVote}</span>` : ''}
              <span class="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[11px] font-mono">Bloque ${q.blockNumber}</span>
            </div>
          </div>

          <!-- Enunciado de la Pregunta con Resaltado Inteligente -->
          <div class="question-body text-slate-100 text-base sm:text-lg">
            ${Highlighter.highlight(q.question)}
          </div>

          <!-- Opciones de Respuesta A, B, C, D... -->
          <div class="space-y-3 pt-2">
            ${choicesEntries.map(([letter, text]) => {
              const isSelected = isGraded
                ? answeredSelected.includes(letter)
                : this.activeSession.userSelected.includes(letter);
              const isEffectiveCorrect = effectiveCorrectLetters.includes(letter);
              let optionClass = "border-slate-800 bg-slate-800/40 hover:bg-slate-800/90 hover:border-slate-700 text-slate-200";

              if (isGraded) {
                if (isEffectiveCorrect) {
                  optionClass = "border-emerald-500/70 bg-emerald-950/40 text-emerald-100 ring-1 ring-emerald-500/50";
                } else if (isSelected && !isEffectiveCorrect) {
                  optionClass = "border-rose-500/70 bg-rose-950/40 text-rose-100 ring-1 ring-rose-500/50";
                } else {
                  optionClass = "border-slate-800/50 bg-slate-900/30 text-slate-400 opacity-60";
                }
              } else if (isSelected) {
                optionClass = "border-indigo-500 bg-indigo-950/50 text-indigo-100 ring-2 ring-indigo-500/40";
              }

              const badgeColor = isSelected
                ? (isGraded && isEffectiveCorrect ? 'bg-emerald-600 text-white' : (isGraded && !isEffectiveCorrect ? 'bg-rose-600 text-white' : 'bg-indigo-600 text-white'))
                : (isGraded && isEffectiveCorrect ? 'bg-emerald-900/80 text-emerald-300 border border-emerald-600/50' : 'bg-slate-800 text-slate-300 border border-slate-700');

              return `
                <div onclick="app.toggleOptionSelection('${letter}')" class="flex items-start gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-2xl border ${optionClass} ${isReview ? 'cursor-default' : 'cursor-pointer'} transition-all">
                  <div class="flex-shrink-0 pt-0.5">
                    <span class="w-6 h-6 rounded-lg flex items-center justify-center font-mono text-xs font-bold ${badgeColor}">
                      ${letter}
                    </span>
                  </div>
                  <div class="flex-1 text-sm sm:text-base leading-relaxed">
                    ${Highlighter.highlight(text)}
                    ${isGraded && isEffectiveCorrect && hasCustomOverride ? '<span class="ml-2 inline-flex items-center gap-1 text-[11px] text-amber-400 font-semibold bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/40">✓ Respuesta personalizada activa</span>' : ''}
                    ${isGraded && isEffectiveCorrect && !hasCustomOverride && commVoteAns && commVoteAns !== officialAns ? '<span class="ml-2 inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">✓ Consenso comunidad</span>' : ''}
                  </div>
                  ${isGraded && isEffectiveCorrect ? '<i data-lucide="check-circle" class="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5"></i>' : ''}
                  ${isGraded && isSelected && !isEffectiveCorrect ? '<i data-lucide="x-circle" class="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5"></i>' : ''}
                </div>
              `;
            }).join("")}
          </div>

          <!-- Botón de Confirmación / Avance / Finalizar -->
          <div class="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800">
            <div class="text-xs text-slate-400 hidden sm:flex items-center gap-2">
              <span class="key-badge">Espacio</span> o <span class="key-badge">Enter</span> para avanzar
              <span class="key-badge">←</span> <span class="key-badge">→</span> navegar
            </div>

            <div class="flex items-center gap-2 w-full sm:w-auto">
              ${this.activeSession.currentIndex > 0 ? `
                <button onclick="app.prevQuestion()" class="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition" title="Pregunta anterior [←]">
                  <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
                  <span class="hidden sm:inline">Anterior</span>
                </button>
              ` : ''}

              ${isExam ? `
                ${this.activeSession.currentIndex < totalQ - 1 ? `
                  <button onclick="app.nextQuestion()" class="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition shadow-lg shadow-indigo-900/30">
                    <span>Siguiente Pregunta</span>
                    <i data-lucide="arrow-right" class="w-4 h-4"></i>
                  </button>
                ` : `
                  <button onclick="app.requestFinishSession()" class="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition shadow-lg shadow-emerald-900/30">
                    <i data-lucide="check-square" class="w-4 h-4"></i>
                    <span>Finalizar Examen</span>
                  </button>
                `}
                <button onclick="app.requestFinishSession()" class="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition" title="Finalizar Examen y ver corrección">
                  <i data-lucide="flag" class="w-3.5 h-3.5 text-amber-400"></i>
                  <span class="hidden sm:inline">Finalizar</span>
                </button>
              ` : (isReview ? `
                ${this.activeSession.currentIndex < totalQ - 1 ? `
                  <button onclick="app.nextQuestion()" class="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition shadow-lg shadow-indigo-900/30">
                    <span>Siguiente Pregunta</span>
                    <i data-lucide="arrow-right" class="w-4 h-4"></i>
                  </button>
                ` : `
                  <button onclick="app.navigate('dashboard')" class="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-6 py-2.5 rounded-xl text-sm transition border border-slate-700">
                    <i data-lucide="layout-dashboard" class="w-4 h-4"></i>
                    <span>Volver al Dashboard</span>
                  </button>
                `}
                <button onclick="app.navigate('dashboard')" class="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition" title="Volver al Dashboard">
                  <i data-lucide="layout-dashboard" class="w-3.5 h-3.5"></i>
                  <span class="hidden sm:inline">Dashboard</span>
                </button>
              ` : `
                <!-- Recall 24h -->
                ${!isGraded ? `
                  <button onclick="app.confirmAnswer()" ${this.activeSession.userSelected.length === 0 ? 'disabled' : ''} class="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition shadow-lg shadow-indigo-900/30">
                    <span>Confirmar Respuesta</span>
                    <i data-lucide="check" class="w-4 h-4"></i>
                  </button>
                ` : `
                  ${this.activeSession.currentIndex < totalQ - 1 ? `
                    <button onclick="app.nextQuestion()" class="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition shadow-lg shadow-indigo-900/30">
                      <span>Siguiente Pregunta</span>
                      <i data-lucide="arrow-right" class="w-4 h-4"></i>
                    </button>
                  ` : `
                    <button onclick="app.requestFinishSession()" class="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition shadow-lg shadow-emerald-900/30">
                      <i data-lucide="check-circle-2" class="w-4 h-4"></i>
                      <span>Finalizar Simulacro</span>
                    </button>
                  `}
                `}
                <button onclick="app.requestFinishSession()" class="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition" title="Finalizar Sesión">
                  <i data-lucide="flag" class="w-3.5 h-3.5 text-amber-400"></i>
                  <span class="hidden sm:inline">Finalizar</span>
                </button>
              `)}
            </div>
          </div>

          <!-- Desplegable Técnico de Descarte & Nemotecnia (Solo en Modo Revisión o Recall Corregido) -->
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

    return `
      <div class="mt-6 p-5 sm:p-6 rounded-2xl border ${isCorrect ? 'border-emerald-500/40 bg-emerald-950/20' : 'border-rose-500/40 bg-rose-950/20'} space-y-5 animate-fadeIn">
        
        <!-- Encabezado de Estado de Respuesta -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b ${isCorrect ? 'border-emerald-500/30' : 'border-rose-500/30'}">
          <div class="flex items-center gap-2.5">
            <span class="w-3.5 h-3.5 rounded-full ${isCorrect ? 'bg-emerald-400' : 'bg-rose-400'}"></span>
            <div>
              <h4 class="text-base font-bold ${isCorrect ? 'text-emerald-300' : 'text-rose-300'}">
                ${hasCustomOverride 
                  ? '¡Acierto Validado por Elección Personalizada!' 
                  : (isCorrect 
                      ? '¡Acierto Técnico Consolidado!' 
                      : (answer && answer.unanswered ? 'Pregunta Sin Responder (Marcada como Errónea)' : 'Fallo Registrado en Base de Datos Roja'))}
              </h4>
              <span class="text-xs text-slate-400">
                ${hasCustomOverride 
                  ? 'Respuesta personalizada guardada por el usuario' 
                  : (isCorrect 
                      ? 'Tu respuesta coincide con el criterio activo' 
                      : (answer && answer.unanswered ? 'No seleccionaste ninguna opción antes de finalizar el examen. Se contabiliza como fallo.' : 'Revisa el desglose de acierto y descarte a continuación'))}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-mono text-slate-300 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
              Válida: <strong class="text-emerald-400">${effectiveCorrect}</strong>
            </span>
          </div>
        </div>

        <!-- Consenso de la Comunidad & Selector de Respuesta Forzada -->
        <div class="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 p-4 rounded-xl border border-slate-800">
          <div class="space-y-1">
            <div class="flex items-center gap-2 text-xs">
              <span class="text-slate-400 font-semibold">Respuesta Válida:</span>
              <span class="font-mono text-base font-bold ${isCorrect ? 'text-emerald-400' : 'text-rose-400'} bg-slate-950 px-2.5 py-0.5 rounded-lg border border-slate-700">
                ${effectiveCorrect}
              </span>
              ${hasCustomOverride ? `
                <span class="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                  Personalizada (Forzada)
                </span>
              ` : (commVoteAns ? `
                <span class="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                  Consenso Comunidad (Por defecto)
                </span>
              ` : `
                <span class="bg-slate-700 text-slate-300 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                  Clave Oficial
                </span>
              `)}
            </div>
            <div class="text-[11px] text-slate-400 flex items-center gap-3">
              <span>Comunidad: <strong class="font-mono text-emerald-400">${commVoteAns || 'N/A'}</strong> ${q.communityVote ? `(${q.communityVote})` : ''}</span>
              <span>·</span>
              <span>Oficial: <strong class="font-mono text-slate-300">${officialAns}</strong></span>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button onclick="app.openForceAnswerModal('${q.id}')" class="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 px-3.5 py-2 rounded-xl text-xs font-semibold transition shadow-sm">
              <i data-lucide="sliders" class="w-3.5 h-3.5 text-amber-400"></i>
              <span>Elegir / Forzar Otra Respuesta</span>
            </button>
            ${hasCustomOverride ? `
              <button onclick="app.resetForcedAnswer('${q.id}')" class="text-xs text-slate-400 hover:text-rose-400 underline transition px-2 py-1" title="Restablecer al consenso por defecto">
                Restablecer
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Acceso directo a Biblioteca de Arquetipos Repemill -->
        <div class="flex items-center justify-between bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 text-xs">
          <div class="flex items-center gap-2 text-slate-300">
            <i data-lucide="book-open" class="w-4 h-4 text-indigo-400"></i>
            <span>¿Dudas de arquitectura? Consulta las reglas de descarte y duelos en el Repemill.</span>
          </div>
          <button onclick="app.navigate('repemill')" class="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 hover:underline transition">
            <span>Ver Repemill AWS</span>
            <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
          </button>
        </div>

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
  // VISTA 3: EL REPEMILL (ARQUETIPOS DE COMPONENTES & GUÍA POR BLOQUES)
  // =========================================================================

  setRepemillTab(tab) {
    this.repemillTab = tab;
    this.renderRepemillView();
  }

  setRepemillCategory(catId) {
    this.repemillCategory = catId;
    this.renderRepemillView();
  }

  renderRepemillView() {
    const container = document.getElementById("view-container");
    if (!container) return;

    const currentTab = this.repemillTab || "components";
    const currentCatId = this.repemillCategory || "todas";
    const blocksCount = 17;
    const blocksList = Array.from({ length: blocksCount }, (_, i) => i + 1);

    const components = (typeof AWS_COMPONENTS !== "undefined") ? AWS_COMPONENTS : [];

    const CATEGORIES = [
      { id: "todas", label: "Todas", match: () => true },
      { id: "seguridad", label: "Seguridad & Cifrado", match: (c) => /(seguridad|cifrado|identidad|gobernanza|privacidad|amenazas|autenticación|ddos|scp|kms)/i.test(c.category + " " + c.name) },
      { id: "redes", label: "Redes & Conectividad", match: (c) => /(redes|edge|dns|balanceo|aceleración|cloudfront|transit|direct connect|privatelink|route53)/i.test(c.category + " " + c.name) },
      { id: "computo", label: "Cómputo & Contenedores", match: (c) => /(cómputo|serverless|contenedores|kubernetes|lambda|fargate|ec2)/i.test(c.category + " " + c.name) },
      { id: "almacenamiento", label: "Almacenamiento", match: (c) => /(almacenamiento|s3|glacier|efs|fsx|ebs|backup)/i.test(c.category + " " + c.name) },
      { id: "database", label: "Bases de Datos & Caché", match: (c) => /(bases de datos|nosql|relacionales|caché|aurora|dynamodb|rds|elasticache)/i.test(c.category + " " + c.name) },
      { id: "messaging", label: "Mensajería, Eventos & Streaming", match: (c) => /(mensajería|notificaciones|eventos|streaming|orquestación|flujos|kinesis|sqs|sns|eventbridge|step)/i.test(c.category + " " + c.name) },
      { id: "migration", label: "Migración & Analítica", match: (c) => /(migración|analítica|transferencia|búsqueda|dms|opensearch)/i.test(c.category + " " + c.name) }
    ];

    const currentCatObj = CATEGORIES.find(cat => cat.id === currentCatId) || CATEGORIES[0];
    const filteredComponents = components.filter(c => currentCatObj.match(c));

    container.innerHTML = `
      <div class="max-w-7xl mx-auto space-y-8 animate-fadeIn">
        
        <!-- Header Principal de la Vista Repemill -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-2xl border border-slate-800">
          <div>
            <div class="flex items-center gap-2 text-indigo-400 font-semibold text-xs uppercase tracking-wider mb-1">
              <i data-lucide="cpu" class="w-4 h-4"></i>
              Biblioteca Repemill AWS (Patrones & Decisiones SAP-C02)
            </div>
            <h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              ${currentTab === 'components' ? 'Catálogo de Arquetipos de Componentes' : 'Guía de Palabras Gatillo por Bloques'}
            </h1>
            <p class="text-slate-400 text-sm mt-1">
              ${currentTab === 'components' 
                ? 'Estructura Bipolar: [Patrón de Acierto / Por qué gana] | [Patrón de Descarte / Anti-patrón] | [Duelo 2x2 Clásico].'
                : 'Guía técnica y descarte rápido organizada correlativamente por los 17 bloques oficiales de examen.'}
            </p>
          </div>

          <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
            <!-- Selector de Pestaña -->
            <div class="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 w-full sm:w-auto">
              <button onclick="app.setRepemillTab('components')" class="flex-1 sm:flex-initial text-center px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${currentTab === 'components' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}">
                Componentes AWS (${components.length})
              </button>
              <button onclick="app.setRepemillTab('blocks')" class="flex-1 sm:flex-initial text-center px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${currentTab === 'blocks' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}">
                Por Bloques (1-17)
              </button>
            </div>

            <!-- Buscador en tiempo real -->
            <input id="repemill-search" oninput="app.filterRepemill(this.value)" type="text" placeholder="${currentTab === 'components' ? 'Buscar componente, gatillo o trampa...' : 'Buscar en bloques...'}" class="bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-full sm:w-64">
          </div>
        </div>

        ${currentTab === 'components' ? `
          <!-- Filtro por Categorías -->
          <div class="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            ${CATEGORIES.map(cat => {
              const count = cat.id === 'todas' ? components.length : components.filter(c => cat.match(c)).length;
              const isActive = currentCatId === cat.id;
              return `
                <button onclick="app.setRepemillCategory('${cat.id}')" class="px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition border ${isActive ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'}">
                  ${cat.label} <span class="ml-1 text-[10px] font-mono opacity-80">(${count})</span>
                </button>
              `;
            }).join("")}
          </div>

          <!-- Grid de Arquetipos de Componentes AWS -->
          <div id="repemill-components" class="grid grid-cols-1 lg:grid-cols-2 gap-5">
            ${filteredComponents.map(comp => this.renderRepemillComponentCard(comp)).join("")}
          </div>
        ` : `
          <!-- Acordeones / Tablas por Bloque -->
          <div id="repemill-content" class="space-y-6">
            ${blocksList.map(bNum => this.renderRepemillBlockTable(bNum)).join("")}
          </div>
        `}

      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  }

  renderRepemillBlockTable(bNum) {
    const data = (typeof REPEMILL_DATA !== "undefined") ? REPEMILL_DATA[bNum] : null;
    if (!data) return "";

    return `
      <div class="block-card bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-lg space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <span class="text-xs font-mono font-bold text-indigo-400 uppercase tracking-wider">Bloque ${bNum} (Q${(bNum - 1) * 25 + 1} - Q${Math.min(bNum * 25, 411)})</span>
            <h3 class="text-base sm:text-lg font-bold text-white tracking-tight mt-0.5">${data.title}</h3>
          </div>
          <span class="text-[11px] text-slate-400 font-mono bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 w-fit">
            ${data.patterns.length} patrones clave
          </span>
        </div>

        <div class="space-y-3">
          ${data.patterns.map((p) => `
            <div class="bg-slate-950/80 p-4 rounded-xl border border-slate-800/80 space-y-2 text-xs">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-amber-400 font-bold text-xs flex items-center gap-1.5">
                  <i data-lucide="zap" class="w-3.5 h-3.5 text-amber-400"></i>
                  ${p.trigger}
                </span>
                <span class="text-[10px] bg-indigo-950/80 text-indigo-300 border border-indigo-800/40 px-2 py-0.5 rounded font-medium">
                  ${p.category}
                </span>
              </div>
              <div class="text-emerald-300 font-semibold flex items-start gap-1.5">
                <span class="text-emerald-400 font-bold flex-shrink-0">→ Solución Óptima:</span>
                <span>${p.optimalService}</span>
              </div>
              <div class="text-slate-400 flex items-start gap-1.5">
                <strong class="text-rose-400 font-semibold flex-shrink-0">Descarte Rápido:</strong>
                <span>${p.discardPattern}</span>
              </div>
              ${p.mnemonic ? `
                <div class="text-indigo-300 italic pt-1.5 border-t border-slate-800/60 flex items-center gap-1.5">
                  <span>💡</span>
                  <span><strong>Mnemotécnica:</strong> ${p.mnemonic}</span>
                </div>
              ` : ''}
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  renderRepemillComponentCard(comp) {
    return `
      <div class="component-card bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-lg space-y-4 hover:border-slate-700 transition flex flex-col justify-between" data-category="${comp.category.toLowerCase()}" data-name="${comp.name.toLowerCase()}">
        
        <!-- Header del Componente -->
        <div class="space-y-1.5 pb-3 border-b border-slate-800">
          <div class="flex items-start justify-between gap-2">
            <h3 class="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 flex-shrink-0"></span>
              <span>${comp.name}</span>
            </h3>
            <span class="text-[10px] font-mono font-semibold uppercase tracking-wider text-indigo-300 bg-indigo-950/80 px-2.5 py-1 rounded-lg border border-indigo-800/40 flex-shrink-0">
              ${comp.category}
            </span>
          </div>
          <p class="text-xs text-slate-400 font-medium leading-relaxed">${comp.archetype}</p>
        </div>

        <!-- Cuerpo Bipolar: Acierto vs Descarte -->
        <div class="space-y-3 flex-1 text-xs">
          
          <!-- Patrón de Acierto -->
          <div class="bg-slate-950/80 p-3.5 rounded-xl border border-emerald-500/25 space-y-2">
            <span class="text-emerald-400 font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i>
              Patrón de Acierto (Cuándo es la Elección Óptima)
            </span>
            <div>
              <strong class="text-amber-400 font-semibold block text-[11px]">Palabra Gatillo / Requisito Clave:</strong>
              <p class="text-slate-200 mt-0.5 leading-relaxed font-medium">${comp.winningPattern.trigger}</p>
            </div>
            <div>
              <strong class="text-emerald-400 font-semibold block text-[11px]">Por qué gana en AWS:</strong>
              <p class="text-slate-300 mt-0.5 leading-relaxed">${comp.winningPattern.whyWins}</p>
            </div>
            <div class="bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-500/20 text-emerald-200 text-[11px] font-medium leading-relaxed">
              💡 <strong>Regla de Decisión Rápida:</strong> ${comp.winningPattern.ruleOfThumb}
            </div>
          </div>

          <!-- Patrón de Descarte -->
          <div class="bg-slate-950/80 p-3.5 rounded-xl border border-rose-500/25 space-y-2">
            <span class="text-rose-400 font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              <i data-lucide="x-circle" class="w-3.5 h-3.5"></i>
              Patrón de Descarte (Cuándo Rechazarlo / Trampa)
            </span>
            <div>
              <strong class="text-rose-300 font-semibold block text-[11px]">Trampa / Anti-Patrón Habitual:</strong>
              <p class="text-slate-200 mt-0.5 leading-relaxed font-medium">${comp.discardPattern.antiPattern}</p>
            </div>
            <div>
              <strong class="text-slate-400 font-semibold block text-[11px]">Por qué se descarta:</strong>
              <p class="text-slate-300 mt-0.5 leading-relaxed">${comp.discardPattern.whyDiscard}</p>
            </div>
            <div class="bg-rose-950/40 p-2.5 rounded-lg border border-rose-500/20 text-rose-200 text-[11px] font-medium leading-relaxed">
              ⚠️ <strong>Regla de Descarte en 5s:</strong> ${comp.discardPattern.quickDiscard}
            </div>
          </div>

          <!-- Duelo 2x2 Clásico -->
          ${comp.duel ? `
            <div class="bg-indigo-950/40 p-3 rounded-xl border border-indigo-500/25 space-y-1 text-xs">
              <strong class="text-indigo-200 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <i data-lucide="swords" class="w-3.5 h-3.5 text-indigo-400"></i>
                ${comp.duel.vs}
              </strong>
              <p class="text-slate-300 leading-relaxed">${comp.duel.distinction}</p>
            </div>
          ` : ''}

        </div>

      </div>
    `;
  }

  filterRepemill(query) {
    const q = query.toLowerCase().trim();
    if (this.repemillTab === 'components' || !this.repemillTab) {
      const cards = document.querySelectorAll("#repemill-components .component-card");
      cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(q) ? "" : "none";
      });
    } else {
      const blocks = document.querySelectorAll("#repemill-content .block-card");
      blocks.forEach(b => {
        const text = b.textContent.toLowerCase();
        b.style.display = text.includes(q) ? "" : "none";
      });
    }
  }

  // =========================================================================
  // VISTA 4: BASE DE DATOS DE FALLOS (PREGUNTAS ROJAS & AMARILLAS)
  // =========================================================================

  renderFailuresView() {
    const container = document.getElementById("view-container");
    const failures = Object.values(store.failures);
    const resolvedFailures = Object.values(store.resolvedFailures || {});
    const recallHistory = store.recallHistory || [];
    const doubts = Object.keys(store.doubts);

    container.innerHTML = `
      <div class="max-w-7xl mx-auto space-y-8 animate-fadeIn">
        
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-800">
          <div>
            <div class="flex items-center gap-2 text-rose-400 font-semibold text-xs uppercase tracking-wider mb-1">
              <i data-lucide="alert-octagon" class="w-4 h-4"></i>
              Gestión de Errores & Repaso Espaciado (Curva del Olvido)
            </div>
            <h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Base de Datos de Fallos <span class="text-rose-400 font-mono">(${failures.length} Pendientes, ${resolvedFailures.length} Superados)</span>
            </h1>
            <p class="text-slate-400 text-sm mt-1">
              El registro de fallos permite priorizar conceptos en Active Recall en frío. Al acertar en el simulacro de errores, el fallo se consolida y se recupera la puntuación neta.
            </p>
          </div>

          <div class="flex items-center gap-3 w-full sm:w-auto">
            <button onclick="app.startRecallSession()" ${failures.length === 0 && doubts.length === 0 ? 'disabled' : ''} class="w-full sm:w-auto justify-center flex items-center gap-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition shadow-lg shadow-rose-900/30">
              <i data-lucide="play" class="w-4 h-4"></i>
              <span>Simulacro Dinámico de Errores</span>
            </button>
          </div>
        </div>

        <!-- Métricas Rápidas de Consolidación -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 flex items-center gap-3.5">
            <div class="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <i data-lucide="alert-circle" class="w-5 h-5"></i>
            </div>
            <div>
              <span class="text-xs text-slate-400 block font-medium">Errores Pendientes</span>
              <span class="text-2xl font-black text-rose-400 font-mono">${failures.length}</span>
            </div>
          </div>

          <div class="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 flex items-center gap-3.5">
            <div class="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <i data-lucide="check-circle" class="w-5 h-5"></i>
            </div>
            <div>
              <span class="text-xs text-slate-400 block font-medium">Errores Consolidados</span>
              <span class="text-2xl font-black text-emerald-400 font-mono">${resolvedFailures.length}</span>
            </div>
          </div>

          <div class="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 flex items-center gap-3.5">
            <div class="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <i data-lucide="history" class="w-5 h-5"></i>
            </div>
            <div>
              <span class="text-xs text-slate-400 block font-medium">Simulacros Ejecutados</span>
              <span class="text-2xl font-black text-indigo-400 font-mono">${recallHistory.length}</span>
            </div>
          </div>
        </div>

        <!-- Lista de Preguntas Falladas -->
        ${failures.length === 0 ? `
          <div class="text-center py-16 bg-slate-900/50 border border-slate-800 rounded-2xl">
            <i data-lucide="check-circle-2" class="w-12 h-12 text-emerald-400 mx-auto mb-3"></i>
            <h3 class="text-lg font-bold text-white">${resolvedFailures.length > 0 ? '¡Todos los Errores Han Sido Consolidados!' : '¡Base de Fallos Vacía!'}</h3>
            <p class="text-sm text-slate-400 max-w-md mx-auto mt-1">
              ${resolvedFailures.length > 0 ? `Has superado con éxito ${resolvedFailures.length} conceptos en los simulacros de errores. Sigue entrenando nuevos bloques.` : 'No tienes preguntas registradas en la base roja. Sigue entrenando bloques en el simulador.'}
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
                    <div class="text-xs text-slate-400 mt-2 flex flex-wrap items-center gap-2">
                      <span class="text-emerald-400 font-bold">Válida: ${store.getEffectiveCorrectAnswer(q)}</span>
                      ${store.hasCustomCorrectAnswer(q.id) ? '<span class="text-[10px] text-amber-300 bg-amber-950/80 px-1.5 py-0.5 rounded">Personalizada</span>' : ''}
                      ${q.communityVote ? `<span class="text-slate-400 font-medium">(Comunidad: ${store.getCommunityVoteAnswer(q) || 'N/A'})</span>` : ''}
                      <span class="text-slate-500 font-normal">Oficial: ${q.correctAnswer}</span>
                    </div>
                    ${mnemonic ? `
                      <div class="mt-2.5 p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-300">
                        <span class="font-bold">💡 Nota / Nemotecnia:</span> ${mnemonic.text}
                      </div>
                    ` : ''}
                  </div>

                  <div class="flex items-center justify-between pt-3 border-t border-slate-800">
                    <div class="flex items-center gap-2">
                      <button onclick="app.launchSingleQuestionReview(${q.id})" class="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                        <span>Repasar</span>
                        <i data-lucide="arrow-right" class="w-3 h-3"></i>
                      </button>
                      <button onclick="app.openForceAnswerModal('${q.id}')" class="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold ml-2" title="Elegir o forzar respuesta válida">
                        <i data-lucide="sliders" class="w-3.5 h-3.5"></i>
                        <span>Forzar/Elegir</span>
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
          <span class="text-emerald-400 font-bold">${Math.ceil(questions.length / 25)} Bloques de Estudio</span>
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
if (typeof window !== "undefined" && typeof document !== "undefined" && typeof store !== "undefined" && (typeof module === "undefined" || !module.exports)) {
  window.app = new App();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { App };
}
