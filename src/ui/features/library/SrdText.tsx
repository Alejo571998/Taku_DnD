import { Fragment, type ReactNode } from 'react';

/**
 * EL TEXTO DEL SRD, PINTADO COMO LO QUE ES.
 *
 * Los packs del SRD traen Markdown dentro de cada párrafo: encabezados,
 * listas, tablas y negritas. La ficha los volcaba en un `<p>` tal cual, así que
 * la regla de Trampas empezaba literalmente por `## Traps` y su tabla de CD se
 * leía como una fila de barras verticales. En una aplicación cuyo motivo de
 * existir es consultar reglas en mesa, eso no es un detalle estético: la tabla
 * ES la regla.
 *
 * Es un intérprete DELIBERADAMENTE pequeño, no un Markdown completo. Solo
 * conoce lo que el contenido usa de verdad, contado sobre las 3.039
 * definiciones:
 *
 *   tablas 696 · encabezados 254 · listas 243 · numeradas 8
 *
 * No hay `dangerouslySetInnerHTML` ni una librería nueva. El texto del SRD es
 * dato de un archivo del repositorio, pero el contenido propio y los paquetes
 * importados pasan por acá igual, y ninguno de los dos debería poder inyectar
 * HTML por venir en una descripción (MASTER PROMPT §77).
 */

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'table'; header: string[]; rows: string[][] };

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^\s*[-*]\s+(.*)$/;
const NUMBERED = /^\s*\d+\.\s+(.*)$/;
const TABLE_ROW = /^\s*\|(.*)\|\s*$/;
/** `|---|:--:|` — la fila que separa el encabezado del cuerpo. */
const TABLE_RULE = /^\s*\|[\s|:-]+\|\s*$/;

const cells = (line: string) =>
  line
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((cell) => cell.trim());

function parse(source: string): Block[] {
  const lines = source.split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flush = () => {
    const text = paragraph.join(' ').trim();
    if (text.length > 0) blocks.push({ kind: 'paragraph', text });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    if (line.trim().length === 0) {
      flush();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      blocks.push({ kind: 'heading', level: heading[1]!.length, text: heading[2]!.trim() });
      continue;
    }

    // Una tabla necesita su fila de guiones. Sin ella son barras sueltas y se
    // quedan como párrafo: mejor un renglón feo que comerse una línea.
    if (TABLE_ROW.test(line) && i + 1 < lines.length && TABLE_RULE.test(lines[i + 1]!)) {
      flush();
      const header = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && TABLE_ROW.test(lines[i]!) && !TABLE_RULE.test(lines[i]!)) {
        rows.push(cells(lines[i]!));
        i++;
      }
      i--;
      blocks.push({ kind: 'table', header, rows });
      continue;
    }

    const bullet = BULLET.exec(line);
    const numbered = NUMBERED.exec(line);
    if (bullet || numbered) {
      flush();
      const ordered = numbered != null;
      const last = blocks[blocks.length - 1];
      const item = (bullet?.[1] ?? numbered![1]!).trim();
      if (last?.kind === 'list' && last.ordered === ordered) last.items.push(item);
      else blocks.push({ kind: 'list', ordered, items: [item] });
      continue;
    }

    paragraph.push(line.trim());
  }

  flush();
  return blocks;
}

/**
 * `***negrita cursiva***`, `**negrita**`, `*cursiva*`.
 *
 * Se parte la cadena en vez de sustituir con HTML: el resultado son nodos de
 * React, así que un asterisco en el sitio equivocado produce como mucho un
 * texto raro, nunca una etiqueta.
 */
function inline(text: string): ReactNode {
  const parts = text.split(/(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('***') && part.endsWith('***') && part.length > 6) {
      return (
        <strong key={index} className="font-medium italic text-[var(--text-primary)]">
          {part.slice(3, -3)}
        </strong>
      );
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={index} className="font-medium text-[var(--text-primary)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

const HEADING_CLASS: Record<number, string> = {
  1: 'font-display text-lg text-[var(--text-primary)]',
  2: 'font-display text-base text-[var(--text-primary)]',
  3: 'text-sm font-medium text-[var(--text-primary)]',
};

export function SrdText({ paragraphs }: { paragraphs: readonly string[] }) {
  const blocks = paragraphs.flatMap(parse);

  return (
    <div className="space-y-2.5 text-sm leading-relaxed text-[var(--text-secondary)]">
      {blocks.map((block, index) => {
        if (block.kind === 'heading') {
          return (
            <p
              key={index}
              // El encabezado de nivel más bajo se pinta como el 3: el SRD
              // llega a anidar cinco, y cinco tamaños distintos en una tarjeta
              // estrecha se leen peor que tres.
              className={`pt-1.5 ${HEADING_CLASS[Math.min(block.level, 3)]}`}
            >
              {inline(block.text)}
            </p>
          );
        }

        if (block.kind === 'list') {
          const ListTag = block.ordered ? 'ol' : 'ul';
          return (
            <ListTag
              key={index}
              className={`ml-4 space-y-1 ${block.ordered ? 'list-decimal' : 'list-disc'}`}
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{inline(item)}</li>
              ))}
            </ListTag>
          );
        }

        if (block.kind === 'table') {
          return (
            // Las tablas del SRD llegan a seis columnas (los tipos de cambio).
            // En un teléfono no caben, así que se desplazan solas en vez de
            // romper la maquetación de la ficha entera.
            <div key={index} className="-mx-1 overflow-x-auto px-1">
              <table className="w-full min-w-max border-collapse text-xs">
                <thead>
                  <tr>
                    {block.header.map((cell, cellIndex) => (
                      <th
                        key={cellIndex}
                        scope="col"
                        className="border-b border-[var(--border-default)] px-2 py-1.5 text-left font-medium text-[var(--text-primary)]"
                      >
                        {inline(cell)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className="border-b border-[var(--border-subtle)] px-2 py-1.5 align-top"
                        >
                          {inline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return <p key={index}>{inline(block.text)}</p>;
      })}
    </div>
  );
}
