/**
 * Servicio de alerta por voz (Web Speech API).
 * Centraliza el pre-calentado del motor TTS y la voz seleccionada para evitar
 * el lag tipico del primer speak() en Chrome/Edge sobre Windows (~300-1000ms).
 *
 * Uso:
 *  - primeSpeech() debe llamarse desde un user-gesture (click en login),
 *    porque los navegadores bloquean audio sin interaccion previa.
 *  - announcePatient() / startAlertLoop() / stopAlertLoop() son seguros
 *    de llamar en cualquier momento posterior.
 */

const DEFAULT_TEXT = "Nuevo paciente en espera";
const DEFAULT_LANG = "es-MX";
const REPEAT_MS = 6000;
// El motor TTS de Windows (SAPI) puede entrar en idle tras unos minutos sin uso,
// devolviendo el lag inicial. Mantenemos un warm-up silencioso periodico mientras
// haya una vista activa que pueda recibir alertas (caja, doctor).
const KEEP_ALIVE_MS = 90_000;

let cachedVoice: SpeechSynthesisVoice | null = null;
let primed = false;
let intervalId: number | null = null;
let keepAliveId: number | null = null;

function pickSpanishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
    if (!voices.length) return null;
    return (
        voices.find((v) => v.lang === DEFAULT_LANG) ??
        voices.find((v) => v.lang.toLowerCase().startsWith("es-mx")) ??
        voices.find((v) => v.lang.toLowerCase().startsWith("es")) ??
        voices[0]
    );
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
    return new Promise((resolve) => {
        const synth = window.speechSynthesis;
        if (!synth) return resolve([]);

        const initial = synth.getVoices();
        if (initial.length) return resolve(initial);

        // En Chrome/Edge las voces llegan async via voiceschanged.
        // Algunos navegadores nunca disparan el evento si ya estan cargadas;
        // por eso combinamos listener + timeout de fallback.
        const onChange = () => {
            synth.removeEventListener("voiceschanged", onChange);
            resolve(synth.getVoices());
        };
        synth.addEventListener("voiceschanged", onChange);
        setTimeout(() => {
            synth.removeEventListener("voiceschanged", onChange);
            resolve(synth.getVoices());
        }, 1500);
    });
}

/**
 * Pre-calienta el motor TTS: fuerza la carga de voces, selecciona una en
 * espanol, y dispara un speak() silencioso para que el motor SAPI/macOS
 * arranque cold. Idempotente — solo corre una vez por sesion.
 *
 * IMPORTANTE: debe invocarse dentro de un user gesture (click), de lo contrario
 * los navegadores bloquearan el audio inicial.
 */
export async function primeSpeech(): Promise<void> {
    if (primed) return;
    if (!window.speechSynthesis) return;

    primed = true;
    const voices = await loadVoices();
    cachedVoice = pickSpanishVoice(voices);

    // Warm-up silencioso: arranca el motor TTS sin que el usuario oiga nada.
    try {
        const warmup = new SpeechSynthesisUtterance(" ");
        if (cachedVoice) warmup.voice = cachedVoice;
        warmup.lang = DEFAULT_LANG;
        warmup.volume = 0;
        warmup.rate = 1;
        window.speechSynthesis.speak(warmup);
    } catch {
        /* silencio: si falla, el primer announcePatient lo intentara */
    }
}

/**
 * Anuncia un paciente con voz. Usa la voz cacheada por primeSpeech() si
 * esta disponible. Si no, deja que el navegador escoja (con lag tipico).
 */
export function announcePatient(text: string = DEFAULT_TEXT): void {
    try {
        const synth = window.speechSynthesis;
        if (!synth) return;
        synth.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        if (cachedVoice) utter.voice = cachedVoice;
        utter.lang = DEFAULT_LANG;
        utter.rate = 0.9;
        utter.pitch = 1;
        utter.volume = 1;
        synth.speak(utter);
    } catch {
        /* silencio */
    }
}

/**
 * Inicia el ciclo de repeticion del anuncio cada REPEAT_MS hasta stopAlertLoop().
 * Si ya hay un ciclo activo, lo reinicia.
 */
export function startAlertLoop(text?: string): void {
    stopAlertLoop();
    announcePatient(text);
    intervalId = window.setInterval(() => announcePatient(text), REPEAT_MS);
}

export function stopAlertLoop(): void {
    if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
    }
    try {
        window.speechSynthesis?.cancel();
    } catch {
        /* silencio */
    }
}

/**
 * Dispara un speak() silencioso de un caracter, sin afectar al usuario, para
 * mantener despierto el motor TTS de Windows (SAPI) y evitar que el primer
 * anuncio real vuelva a tardar tras un periodo de inactividad. No interrumpe
 * un anuncio en curso.
 */
function ttsKeepAliveTick(): void {
    const synth = window.speechSynthesis;
    if (!synth) return;
    // Si ya esta hablando o pendiente, no interrumpas la alerta real.
    if (synth.speaking || synth.pending) return;
    try {
        const utter = new SpeechSynthesisUtterance(" ");
        if (cachedVoice) utter.voice = cachedVoice;
        utter.lang = DEFAULT_LANG;
        utter.volume = 0;
        utter.rate = 1;
        synth.speak(utter);
    } catch {
        /* silencio */
    }
}

/**
 * Inicia un warm-up periodico silencioso (cada KEEP_ALIVE_MS) para mantener
 * despierto el motor TTS. Idempotente. Se debe llamar al montar las vistas
 * que reciben alertas (caja, doctor).
 */
export function startKeepAlive(): void {
    if (keepAliveId !== null) return;
    if (!window.speechSynthesis) return;
    keepAliveId = window.setInterval(ttsKeepAliveTick, KEEP_ALIVE_MS);
}

/**
 * Detiene el warm-up periodico. Llamar al desmontar las vistas que lo iniciaron.
 */
export function stopKeepAlive(): void {
    if (keepAliveId !== null) {
        clearInterval(keepAliveId);
        keepAliveId = null;
    }
}
