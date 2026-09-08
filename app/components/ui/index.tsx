import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger'

export function AppShell({ children, className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return <main className={`app-shell ui-shell ${className}`.trim()} {...props}>{children}</main>
}

export function Surface({ children, elevated = false, className = '', ...props }: HTMLAttributes<HTMLElement> & { elevated?: boolean }) {
  return <section className={`ui-surface${elevated ? ' ui-surface-elevated' : ''} ${className}`.trim()} {...props}>{children}</section>
}

export function Button({ variant = 'secondary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`ui-button ui-button-${variant} ${className}`.trim()} {...props} />
}

export function Field({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`ui-field ${className}`.trim()} {...props} />
}

export function TextField({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`ui-field ${className}`.trim()} {...props} />
}

export function Tabs({ children, className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`ui-tabs ${className}`.trim()} {...props}>{children}</div>
}

export function Modal({ children, className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`ui-modal-backdrop ${className}`.trim()} {...props}>{children}</div>
}

export function LoadingState({ children = '読み込み中です…' }: { children?: ReactNode }) {
  return <p className="ui-status" role="status">{children}</p>
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="ui-empty">{children}</p>
}

export function ErrorState({ children }: { children: ReactNode }) {
  return <p className="ui-error" role="alert">{children}</p>
}
