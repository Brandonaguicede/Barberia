import styles from './FormField.module.css'
import { cloneElement, isValidElement, useId, type ReactElement } from 'react'

interface FormFieldProps {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}

export function FormField({ label, required, error, children }: FormFieldProps) {
  const generatedId = useId()
  const child = isValidElement(children) ? children as ReactElement<{id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean; 'aria-required'?: boolean}> : null
  const id = child?.props.id || generatedId
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}{required && <span className={styles.req} aria-hidden="true">*</span>}
      </label>
      {child ? cloneElement(child, { id, 'aria-required': required, 'aria-invalid': Boolean(error), 'aria-describedby': error ? `${id}-error` : child.props['aria-describedby'] }) : children}
      {error && <span id={`${id}-error`} className={styles.error}>{error}</span>}
    </div>
  )
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}
export function Input({ error, className, ...props }: InputProps) {
  return <input className={`${styles.input} ${error ? styles.inputError : ''} ${className || ''}`} {...props} />
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
}
export function Select({ error, className, children, ...props }: SelectProps) {
  return (
    <select className={`${styles.input} ${error ? styles.inputError : ''} ${className || ''}`} {...props}>
      {children}
    </select>
  )
}

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}
export function TextArea({ error, className, ...props }: TextAreaProps) {
  return <textarea className={`${styles.input} ${styles.textarea} ${error ? styles.inputError : ''} ${className || ''}`} {...props} />
}
