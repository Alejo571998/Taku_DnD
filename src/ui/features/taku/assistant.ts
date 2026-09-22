/**
 * EL HUECO DONDE VA EL CHATBOT.
 *
 * Hoy Taku no conversa, y el panel lo dice con esas palabras. Poner un campo
 * de texto que parezca un chat y no lo sea es exactamente la clase de mentira
 * que el proyecto no se permite (MASTER PROMPT §75): quien lo vea va a
 * escribir una pregunta y a quedarse esperando.
 *
 * Lo que sí está es la forma del enchufe. Cuando haya un asistente de verdad
 * se implementa esta interfaz, se registra con `setTakuAssistant` y el panel
 * cambia solo: la interfaz ya pregunta por `isAvailable()` antes de dibujar.
 *
 * El contexto se arma acá, en el cliente, y NUNCA incluye datos del personaje.
 * Cuando esto se conecte a un modelo, lo que se mande sale del dispositivo; la
 * ruta por la que viaja la ficha de alguien es una decisión de privacidad, no
 * un detalle de implementación, y se toma cuando toque y a la vista.
 */

export type TakuContext = {
  /** La ruta en la que está el usuario, sin identificadores. */
  readonly route: string;
  /** Qué está haciendo, en términos del producto: 'play', 'library', 'create'… */
  readonly activity: string;
  /** Si hay conexión: un asistente remoto no sirve de nada sin ella. */
  readonly online: boolean;
};

export type TakuAnswer = {
  readonly text: string;
  /** Enlaces dentro de la aplicación que respondan mejor que un párrafo. */
  readonly links?: readonly { readonly label: string; readonly href: string }[];
};

export interface TakuAssistant {
  /**
   * ¿Se puede preguntar ahora mismo?
   *
   * Devuelve false si no hay asistente, si no hay red o si el usuario no lo
   * habilitó. El panel no muestra el campo de texto mientras esto sea false.
   */
  isAvailable(context: TakuContext): boolean;
  ask(question: string, context: TakuContext): Promise<TakuAnswer>;
}

let registered: TakuAssistant | null = null;

export function setTakuAssistant(assistant: TakuAssistant | null): void {
  registered = assistant;
}

export function getTakuAssistant(): TakuAssistant | null {
  return registered;
}

/**
 * Atajos que sí funcionan hoy.
 *
 * Mientras no haya conversación, el panel ofrece lo que de verdad resuelve las
 * preguntas frecuentes: llevar al sitio donde está la respuesta. Es menos
 * vistoso que un chat y sirve más que uno que no contesta.
 */
export type TakuShortcut = {
  readonly label: string;
  readonly detail: string;
  readonly href: string;
};

export function shortcutsFor(context: TakuContext): readonly TakuShortcut[] {
  const always: TakuShortcut[] = [
    {
      label: 'Buscar una regla',
      detail: 'Condiciones, descansos, combate. En español o en inglés.',
      href: '/library?type=rule',
    },
    {
      label: 'Buscar un conjuro',
      detail: 'Los 319 del SRD, con su nivel y su escuela.',
      href: '/library?type=spell',
    },
  ];

  if (context.activity === 'play') {
    return [
      {
        label: 'Ver mis condiciones',
        detail: 'Qué te está afectando y qué implica cada una.',
        href: '/library?type=rule',
      },
      ...always,
    ];
  }

  if (context.activity === 'create') {
    return [
      {
        label: 'Ver las clases',
        detail: 'Qué hace cada una antes de decidir.',
        href: '/library?type=class',
      },
      ...always,
    ];
  }

  return [
    ...always,
    {
      label: 'Crear contenido propio',
      detail: 'Un arma, un conjuro, una especie o una clase entera.',
      href: '/homebrew',
    },
  ];
}
