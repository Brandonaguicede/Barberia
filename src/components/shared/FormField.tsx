import styles from './FormField.module.css'

interface FormFieldProps {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}

export function FormField({ label, required, error, children }: FormFieldProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>
        {label}{required && <span className={styles.req}>*</span>}
      </label>
      {children}
      {error && <span className={styles.error}>{error}</span>}
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
