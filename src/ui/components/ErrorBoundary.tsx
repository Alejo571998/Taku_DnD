'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { fromError } from '@application/observability/diagnostics';
import { recordDiagnostic } from '@ui/hooks/useDiagnostics';
import { Button } from '@ui/design-system/Button';

/**
 * LÍMITE DE ERROR (MASTER PROMPT §81)
 *
 * Un fallo de renderizado NO puede dejar la pantalla en blanco en mitad de una
 * partida. Se contiene acá, se explica en lenguaje humano, y se deja anotado
 * en el diagnóstico local para que después se pueda arreglar.
 *
 * Lo importante: los datos del usuario están en IndexedDB, no en la memoria de
 * React. Que esta pantalla falle no pierde nada, y el mensaje lo dice.
 */
type Props = { children: ReactNode; area?: string; onGoHome?: () => void };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    void recordDiagnostic(
      fromError(error, 'render', 'render.crashed', {
        area: this.props.area ?? 'desconocida',
        // El stack de componentes no lleva datos del usuario: solo nombres de
        // componente. Es justo lo que hace falta para localizar el fallo.
        component: (info.componentStack ?? '').split('\n')[1]?.trim().slice(0, 80) ?? '',
      }),
    );
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-[50dvh] flex-col items-center justify-center px-6 text-center">
        <span className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-[var(--danger-muted)]">
          <AlertTriangle className="size-6 text-[var(--danger-text)]" strokeWidth={1.9} />
        </span>
        <h2 className="font-display text-xl">Se nos rompió esta pantalla</h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--text-tertiary)]">
          Tus personajes están a salvo: se guardan en el dispositivo, no en esta pantalla. Quedó
          anotado en el diagnóstico y podés seguir desde otra sección.
        </p>

        <div className="mt-6 flex gap-2">
          <Button variant="primary" onClick={() => this.setState({ error: null })}>
            <RotateCcw className="size-4" />
            Reintentar
          </Button>
          {this.props.onGoHome && (
            <Button variant="ghost" onClick={this.props.onGoHome}>
              Ir al inicio
            </Button>
          )}
        </div>

        <p className="mt-6 max-w-sm break-words text-2xs text-[var(--text-tertiary)]">
          {this.state.error.name}: {this.state.error.message}
        </p>
      </div>
    );
  }
}
