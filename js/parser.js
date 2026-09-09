/**
 * PARSER UNIVERSAL DE DUMPS (PDF.JS EN NAVEGADOR & JSON)
 * Extrae sistemáticamente Question #, Enunciado, Opciones (A-F), Respuesta Oficial y Votos de Comunidad
 */

const DumpParser = {
  /**
   * Corrige ligaduras tipográficas habituales en PDFs (fi, fl, ffi, ff) y fallos de extracción
   */
  fixLigatures(str) {
    if (!str) return "";
    let s = str
      .replace(/tra\s*\u0000\s*c/gi, "traffic")
      .replace(/su\s*\u0000\s*cient/gi, "sufficient")
      .replace(/e\s*\u0000\s*cient/gi, "efficient")
      .replace(/o\s*\u0000\s*ce/gi, "office")
      .replace(/di\s*\u0000\s*cult/gi, "difficult");

    // Ligaduras al inicio de palabra
    s = s.replace(/\s+\u0000\s*([a-z0-9]+)/gi, (m, word) => {
      const w = word.toLowerCase();
      if (w.startsWith("eet") || w.startsWith("ow") || w.startsWith("ex") || w.startsWith("oat") || w.startsWith("ight")) {
        return " fl" + word;
      }
      return " fi" + word;
    });

    // Ligaduras dentro de palabra
    s = s.replace(/([a-zA-Z0-9])\s*\u0000\s*([a-zA-Z0-9])/g, "$1fi$2");
    s = s.replace(/\u0000/g, "fi");

    // Corrección de palabras cortadas frecuentes
    const wordFixes = [
      [/\bcon\s+figure\b/gi, "configure"],
      [/\bcon\s+figured\b/gi, "configured"],
      [/\bcon\s+figuring\b/gi, "configuring"],
      [/\bcon\s+figuration\b/gi, "configuration"],
      [/\bcon\s+figurations\b/gi, "configurations"],
      [/\bspeci\s+fic\b/gi, "specific"],
      [/\bspeci\s+fically\b/gi, "specifically"],
      [/\bbene\s+fit\b/gi, "benefit"],
      [/\bbene\s+fits\b/gi, "benefits"],
      [/\bsigni\s+ficant\b/gi, "significant"],
      [/\bsigni\s+ficantly\b/gi, "significantly"],
      [/\bidenti\s+fied\b/gi, "identified"],
      [/\be\s+fficient\b/gi, "efficient"],
      [/\be\s+ffective\b/gi, "effective"],
      [/\bsu\s+fficient\b/gi, "sufficient"],
      [/\bmodi\s+fied\b/gi, "modified"],
      [/\bveri\s+fied\b/gi, "verified"],
      [/\bnoti\s+fication\b/gi, "notification"],
      [/\bpre\s+fix\b/gi, "prefix"],
      [/\bde\s+fined\b/gi, "defined"],
      [/\bVPCreate\b/g, "VPC. Create"],
      [/\bVPAttach\b/g, "VPC. Attach"],
      [/\bALDisable\b/g, "ALB. Disable"],
      [/\bMFCon\s*figure\b/g, "MFA. Configure"]
    ];

    wordFixes.forEach(([reg, rep]) => {
      s = s.replace(reg, rep);
    });

    return s;
  },

  /**
   * Extrae el texto completo de un documento PDF usando PDF.js en el cliente
   */
  async extractTextFromPDF(arrayBuffer, onProgress = () => {}) {
    if (!window.pdfjsLib) {
      throw new Error("Librería PDF.js no encontrada en el navegador.");
    }

    // Configurar worker de PDF.js si no está activo
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }

    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const doc = await loadingTask.promise;
    const numPages = doc.numPages;
    let fullText = "";

    for (let i = 1; i <= numPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const pageStrings = textContent.items.map(item => item.str);
      fullText += "\n" + pageStrings.join(" ");

      onProgress(i, numPages, Math.round((i / numPages) * 100));
    }

    return fullText;
  },

  /**
   * Parsea el texto crudo del dump a un array de preguntas normalizadas
   */
  parseRawText(rawText) {
    const cleanedText = this.fixLigatures(rawText);
    const qRegex = /Topic\s+\d+\s+Question\s+#(\d+)([\s\S]*?)(?=(?:Topic\s+\d+\s+Question\s+#\d+)|$)/gi;
    let match;
    const questions = [];
    const letters = ["A", "B", "C", "D", "E", "F"];

    while ((match = qRegex.exec(cleanedText)) !== null) {
      const qNum = parseInt(match[1], 10);
      const body = match[2];

      // Eliminar marcas de agua de ExamTopics, cabeceras y pies
      const cleanedBody = body
        .replace(/\d{1,2}\/\d{1,2}\/\d{2,4},\s*\d{1,2}:\d{2}\s*AWS Certified Solutions Architect[^\n]*\n?/gi, " ")
        .replace(/https:\/\/www\.examtopics\.com[^\n]*\n?/gi, " ")
        .replace(/Study Guide\s+\d+\s+PDF Pages[^\n]*Buy Now/gi, " ")
        .replace(/Video Course\s+\d+\s+Lectures[^\n]*Buy Now/gi, " ")
        .replace(/Expert Verified,\s*Online,\s*Free\s*\./gi, " ")
        .replace(/Prepare for your AWS Certified[^\n]*/gi, " ")
        .replace(/\s*Custom View Settings/gi, " ")
        .replace(/\s+/g, " ");

      // Extraer Respuesta Correcta
      const ansMatch = cleanedBody.match(/Correct\s*Answer\s*:\s*([A-F]+)/i);
      const correctAnswer = ansMatch ? ansMatch[1].toUpperCase().trim() : "";

      // Extraer Distribución de Votos de la Comunidad
      const commMatch = cleanedBody.match(/Community\s*vote\s*distribution\s*([A-F0-9%(),\sOther]+?)(?=(?:Topic\s+\d+\s+Question)|$)/i);
      let communityVote = commMatch ? commMatch[1].trim() : "";
      if (communityVote.includes("Topic")) {
        communityVote = communityVote.split("Topic")[0].trim();
      }

      // Delimitar cuerpo antes de la respuesta correcta para opciones
      const bodyBeforeAns = ansMatch ? cleanedBody.substring(0, ansMatch.index) : cleanedBody;

      // Dividir enunciado y opciones A-F
      const firstChoiceIdx = bodyBeforeAns.search(/\s+A\.\s+/);
      let qContext = "";
      const choices = {};

      if (firstChoiceIdx !== -1) {
        qContext = bodyBeforeAns.substring(0, firstChoiceIdx).trim();
        let choicesStr = bodyBeforeAns.substring(firstChoiceIdx).trim();

        for (let i = 0; i < letters.length; i++) {
          const curL = letters[i];
          const nextL = letters[i + 1];

          const curPattern = new RegExp(`(?:^|\\s+)${curL}\\.\\s+`);
          const curMatch = choicesStr.match(curPattern);
          if (!curMatch) break;

          const startIdx = curMatch.index + curMatch[0].length;
          let endIdx = choicesStr.length;

          if (nextL) {
            const nextPattern = new RegExp(`\\s+${nextL}\\.\\s+`);
            const nextMatch = choicesStr.substring(startIdx).match(nextPattern);
            if (nextMatch) {
              endIdx = startIdx + nextMatch.index;
            }
          }

          choices[curL] = choicesStr.substring(startIdx, endIdx).trim();
          choicesStr = choicesStr.substring(endIdx).trim();
        }
      } else {
        qContext = bodyBeforeAns.trim();
      }

      // Detección de selección múltiple ("Choose two", "Choose three", etc.)
      let multiCount = 1;
      if (/choose\s+two/i.test(qContext)) multiCount = 2;
      else if (/choose\s+three/i.test(qContext)) multiCount = 3;
      else if (/choose\s+four/i.test(qContext)) multiCount = 4;
      else if (correctAnswer.length > 1) multiCount = correctAnswer.length;

      questions.push({
        id: qNum,
        questionNumber: qNum,
        question: qContext,
        choices: choices,
        correctAnswer: correctAnswer,
        communityVote: communityVote,
        multiSelectCount: multiCount,
        blockNumber: Math.ceil(qNum / 25)
      });
    }

    return questions;
  },

  /**
   * Normaliza y valida un banco de preguntas en formato JSON
   */
  validateAndNormalizeQuestions(data) {
    if (!Array.isArray(data)) {
      throw new Error("El archivo JSON debe contener un arreglo de preguntas.");
    }

    return data.map((item, idx) => {
      const qNum = item.questionNumber || item.id || (idx + 1);
      const correctAnswer = (item.correctAnswer || item.answer || "").toUpperCase().trim();
      const question = item.question || item.enunciado || "";
      const choices = item.choices || item.options || {};

      let multiCount = item.multiSelectCount || 1;
      if (/choose\s+two/i.test(question)) multiCount = 2;
      else if (/choose\s+three/i.test(question)) multiCount = 3;
      else if (correctAnswer.length > 1) multiCount = correctAnswer.length;

      return {
        id: qNum,
        questionNumber: qNum,
        question: question.trim(),
        choices: choices,
        correctAnswer: correctAnswer,
        communityVote: item.communityVote || "",
        multiSelectCount: multiCount,
        blockNumber: Math.ceil(qNum / 25)
      };
    });
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DumpParser };
}
