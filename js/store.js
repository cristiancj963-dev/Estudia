/**
 * GESTOR DE ESTADO Y PERSISTENCIA (STORE)
 * Manejo reactivo del banco de preguntas, sesiones, base de fallos (rojas),
 * preguntas dudosas (amarillas), notas/mnemotecnias y puntuación neta.
 */

const STORAGE_KEYS = {
  QUESTIONS: "estudia_aws_questions_v1",
  ANSWERS: "estudia_aws_answers_v1",
  FAILURES: "estudia_aws_failures_v1",
  DOUBTS: "estudia_aws_doubts_v1",
  MNEMONICS: "estudia_aws_mnemonics_v1",
  POMODORO: "estudia_aws_pomodoro_v1",
  SETTINGS: "estudia_aws_settings_v1"
};

class ExamStore {
  constructor() {
    this.questions = [];
    this.answers = {};      // { [qId]: { selected: ['A'], isCorrect: true/false, timestamp, attempts: 1 } }
    this.failures = {};     // { [qId]: { qId, blockNumber, concept, failureCount, timestamp } }
    this.doubts = {};       // { [qId]: true }
    this.mnemonics = {};    // { [qId]: { text, lockerNumber, updatedAt } }
    this.pomodoroStats = { completedSessions: 0, totalFocusMinutes: 0 };
    this.settings = {
      darkMode: true,
      soundEnabled: true,
      autoAdvanceOnCorrect: true,
      zenMode: false
    };

    this.listeners = [];
    this.loadFromStorage();
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(fn => fn(this));
  }

  loadFromStorage() {
    try {
      const qRaw = localStorage.getItem(STORAGE_KEYS.QUESTIONS);
      if (qRaw) this.questions = JSON.parse(qRaw);

      const aRaw = localStorage.getItem(STORAGE_KEYS.ANSWERS);
      if (aRaw) this.answers = JSON.parse(aRaw);

      const fRaw = localStorage.getItem(STORAGE_KEYS.FAILURES);
      if (fRaw) this.failures = JSON.parse(fRaw);

      const dRaw = localStorage.getItem(STORAGE_KEYS.DOUBTS);
      if (dRaw) this.doubts = JSON.parse(dRaw);

      const mRaw = localStorage.getItem(STORAGE_KEYS.MNEMONICS);
      if (mRaw) this.mnemonics = JSON.parse(mRaw);

      const pRaw = localStorage.getItem(STORAGE_KEYS.POMODORO);
      if (pRaw) this.pomodoroStats = JSON.parse(pRaw);

      const sRaw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (sRaw) this.settings = { ...this.settings, ...JSON.parse(sRaw) };
    } catch (e) {
      console.warn("Error cargando de localStorage:", e);
    }
  }

  saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(this.questions));
      localStorage.setItem(STORAGE_KEYS.ANSWERS, JSON.stringify(this.answers));
      localStorage.setItem(STORAGE_KEYS.FAILURES, JSON.stringify(this.failures));
      localStorage.setItem(STORAGE_KEYS.DOUBTS, JSON.stringify(this.doubts));
      localStorage.setItem(STORAGE_KEYS.MNEMONICS, JSON.stringify(this.mnemonics));
      localStorage.setItem(STORAGE_KEYS.POMODORO, JSON.stringify(this.pomodoroStats));
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
    } catch (e) {
      console.warn("Error guardando en localStorage:", e);
    }
    this.notify();
  }

  setQuestions(questions) {
    this.questions = questions;
    this.saveToStorage();
  }

  /**
   * Registra una respuesta del usuario a una pregunta
   */
  recordAnswer(questionId, selectedLetters, isCorrect, concept = "") {
    const qId = String(questionId);
    const prevAnswer = this.answers[qId];
    const attempts = (prevAnswer ? prevAnswer.attempts : 0) + 1;

    this.answers[qId] = {
      selected: selectedLetters,
      isCorrect: isCorrect,
      timestamp: new Date().toISOString(),
      attempts: attempts
    };

    const question = this.questions.find(q => String(q.id) === qId);
    const blockNum = question ? question.blockNumber : 1;

    if (!isCorrect) {
      // Registrar en la Base de Fallos (Preguntas Rojas)
      const prevFail = this.failures[qId];
      const failCount = (prevFail ? prevFail.failureCount : 0) + 1;
      this.failures[qId] = {
        questionId: qId,
        blockNumber: blockNum,
        concept: concept || (question ? question.question.slice(0, 80) + "..." : ""),
        failureCount: failCount,
        timestamp: new Date().toISOString()
      };
    } else {
      // Si acierta y estaba en fallos, la pregunta permanece registrada hasta que se consolide en el repaso de 24h
    }

    this.saveToStorage();
  }

  /**
   * Marca o desmarca una pregunta como Dudosa (Amarilla)
   */
  toggleDoubt(questionId) {
    const qId = String(questionId);
    if (this.doubts[qId]) {
      delete this.doubts[qId];
    } else {
      this.doubts[qId] = true;
    }
    this.saveToStorage();
  }

  isDoubt(questionId) {
    return !!this.doubts[String(questionId)];
  }

  /**
   * Guarda o actualiza una nemotecnia o nota técnica de fijación
   */
  saveMnemonic(questionId, text, lockerNumber = null) {
    const qId = String(questionId);
    this.mnemonics[qId] = {
      text: text.trim(),
      lockerNumber: lockerNumber,
      updatedAt: new Date().toISOString()
    };
    this.saveToStorage();
  }

  getMnemonic(questionId) {
    return this.mnemonics[String(questionId)] || null;
  }

  /**
   * Incrementa el contador de Pomodoros completados
   */
  addCompletedPomodoro(durationMinutes = 35) {
    this.pomodoroStats.completedSessions = (this.pomodoroStats.completedSessions || 0) + 1;
    this.pomodoroStats.totalFocusMinutes = (this.pomodoroStats.totalFocusMinutes || 0) + durationMinutes;
    this.saveToStorage();
  }

  /**
   * Divide las preguntas en bloques cerrados de 25 preguntas (Ley de Parkinson)
   */
  getBlocksSummary() {
    const blocks = [];
    const totalQuestions = this.questions.length;
    const numBlocks = Math.ceil(totalQuestions / 25) || 17;

    for (let b = 1; b <= numBlocks; b++) {
      const startIdx = (b - 1) * 25;
      const endIdx = Math.min(b * 25, totalQuestions);
      const blockQuestions = this.questions.slice(startIdx, endIdx);
      const totalInBlock = blockQuestions.length;

      let answered = 0;
      let correct = 0;
      let failed = 0;
      let doubtful = 0;

      blockQuestions.forEach(q => {
        const qId = String(q.id);
        if (this.answers[qId]) {
          answered++;
          if (this.answers[qId].isCorrect) correct++;
          else failed++;
        }
        if (this.doubts[qId]) doubtful++;
      });

      let status = "pending";
      if (answered === totalInBlock && totalInBlock > 0) {
        status = "completed";
      } else if (answered > 0) {
        status = "in_progress";
      }

      const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
      // Puntuación Neta para el bloque: Aciertos - (Fallos / 3)
      const netScore = Math.max(0, +(correct - (failed / 3)).toFixed(1));

      blocks.push({
        blockNumber: b,
        rangeLabel: `Q${startIdx + 1} - Q${endIdx}`,
        total: totalInBlock,
        answered,
        correct,
        failed,
        doubtful,
        accuracy,
        netScore,
        status
      });
    }

    return blocks;
  }

  /**
   * Devuelve métricas globales del usuario
   */
  getGlobalStats() {
    const totalQuestions = this.questions.length;
    let answered = 0;
    let correct = 0;
    let failed = 0;
    let doubtful = Object.keys(this.doubts).length;

    Object.values(this.answers).forEach(ans => {
      answered++;
      if (ans.isCorrect) correct++;
      else failed++;
    });

    const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
    // Fórmula de Puntuación Neta Oficial: Aciertos - (Fallos / 3)
    const netScore = Math.max(0, +(correct - (failed / 3)).toFixed(1));
    const totalFailuresInDb = Object.keys(this.failures).length;

    return {
      totalQuestions,
      answered,
      correct,
      failed,
      doubtful,
      accuracy,
      netScore,
      totalFailuresInDb,
      completedPomodoros: this.pomodoroStats.completedSessions || 0,
      totalFocusMinutes: this.pomodoroStats.totalFocusMinutes || 0
    };
  }

  /**
   * Genera el conjunto de preguntas para el "Modo Repaso de Fallos (Active Recall 24h)"
   */
  getRecallQuestions() {
    const failedIds = new Set(Object.keys(this.failures));
    const doubtIds = new Set(Object.keys(this.doubts));
    const targetIds = new Set([...failedIds, ...doubtIds]);

    if (targetIds.size === 0) return [];

    return this.questions.filter(q => targetIds.has(String(q.id)));
  }

  /**
   * Limpia el progreso de un bloque específico para repetirlo desde cero
   */
  resetBlock(blockNumber) {
    const startIdx = (blockNumber - 1) * 25;
    const endIdx = Math.min(blockNumber * 25, this.questions.length);
    const blockQuestions = this.questions.slice(startIdx, endIdx);

    blockQuestions.forEach(q => {
      const qId = String(q.id);
      delete this.answers[qId];
      delete this.doubts[qId];
      delete this.failures[qId];
    });

    this.saveToStorage();
  }

  /**
   * Fuerza el acierto de una pregunta (alineación con consenso de la comunidad)
   */
  forceCorrect(questionId, customReason = "Alineado con consenso de comunidad") {
    const qId = String(questionId);
    const existing = this.answers[qId];
    if (!existing) return;

    existing.isCorrect = true;
    existing.forcedCorrect = true;
    existing.forcedReason = customReason;

    // Eliminar de la base de fallos (rojas)
    if (this.failures[qId]) {
      delete this.failures[qId];
    }

    this.saveToStorage();
  }

  /**
   * Revierte el forzado de acierto devolviendo la pregunta a su estado de fallo original
   */
  revertToIncorrect(questionId) {
    const qId = String(questionId);
    const existing = this.answers[qId];
    if (!existing) return;

    existing.isCorrect = false;
    existing.forcedCorrect = false;

    const question = this.questions.find(q => String(q.id) === qId);
    this.failures[qId] = {
      questionId: qId,
      blockNumber: question ? question.blockNumber : 1,
      concept: question ? question.question.slice(0, 80) + "..." : "",
      failureCount: 1,
      timestamp: new Date().toISOString()
    };

    this.saveToStorage();
  }

  /**
   * Limpia un fallo de la base de datos de errores una vez superado
   */
  removeFailure(questionId) {
    delete this.failures[String(questionId)];
    this.saveToStorage();
  }

  /**
   * Exporta todo el estado en formato JSON descargable
   */
  exportStateJSON() {
    const exportData = {
      exportDate: new Date().toISOString(),
      appVersion: "1.0.0-pro",
      stats: this.getGlobalStats(),
      questionsCount: this.questions.length,
      answers: this.answers,
      failures: this.failures,
      doubts: this.doubts,
      mnemonics: this.mnemonics,
      pomodoroStats: this.pomodoroStats,
      settings: this.settings
    };
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Importa y restaura una copia de seguridad JSON
   */
  importStateJSON(jsonContent) {
    try {
      const data = typeof jsonContent === "string" ? JSON.parse(jsonContent) : jsonContent;
      if (data.answers) this.answers = data.answers;
      if (data.failures) this.failures = data.failures;
      if (data.doubts) this.doubts = data.doubts;
      if (data.mnemonics) this.mnemonics = data.mnemonics;
      if (data.pomodoroStats) this.pomodoroStats = data.pomodoroStats;
      if (data.settings) this.settings = { ...this.settings, ...data.settings };
      if (data.questions && Array.isArray(data.questions)) this.questions = data.questions;

      this.saveToStorage();
      return { success: true, message: "Progreso y estadísticas restaurados correctamente." };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Resetea completamente el progreso de estudio
   */
  resetAll() {
    this.answers = {};
    this.failures = {};
    this.doubts = {};
    this.mnemonics = {};
    this.pomodoroStats = { completedSessions: 0, totalFocusMinutes: 0 };
    this.saveToStorage();
  }
}

// Instancia única (Singleton)
const store = new ExamStore();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { store, ExamStore };
}
