import React, { forwardRef, type ReactElement } from "react";

interface FormFieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  id: string;
  children: ReactElement;
}

export function FormField({ label, error, hint, required, id, children }: FormFieldProps) {
  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  const childProps = children.props;
  const childClassName = (childProps.className as string) ?? "";
  const mergedClassName = `input ${error ? "input-error" : ""} ${childClassName}`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="label">
        {label}
        {required && (
          <span className="ml-0.5 text-triage-red-solid" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {React.cloneElement(children, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? "true" : "false",
        className: mergedClassName,
      })}
      {error && (
        <p id={errorId} className="error-text" role="alert" aria-live="polite">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="text-xs text-ink-subtle">
          {hint}
        </p>
      )}
    </div>
  );
}

interface InputProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  id?: string;
  name?: string;
  type?: string;
  value?: string | number | readonly string[];
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  disabled?: boolean;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  className?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  const { label, error, hint, required, id, ...rest } = props;
  const inputId = id ?? props.name;
  if (label) {
    return (
      <FormField label={label} error={error} hint={hint} required={required} id={inputId ?? ""}>
        <input ref={ref} className={(props.className ?? "") as string} {...rest} />
      </FormField>
    );
  }
  return (
    <input
      ref={ref}
      id={inputId ?? ""}
      className={`input ${(props.className ?? "") as string} ${error ? "input-error" : ""}`}
      {...rest}
    />
  );
});
Input.displayName = "Input";

interface TextareaProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  id?: string;
  name?: string;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  className?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>((props, ref) => {
  const { label, error, hint, required, id, ...rest } = props;
  const inputId = id ?? (props as { name?: string }).name;
  if (label) {
    return (
      <FormField label={label} error={error} hint={hint} required={required} id={inputId ?? ""}>
        <textarea ref={ref} className={(props.className ?? "") as string} {...rest} />
      </FormField>
    );
  }
  return (
    <textarea
      ref={ref}
      id={inputId ?? ""}
      className={`input ${(props.className ?? "") as string} ${error ? "input-error" : ""}`}
      {...rest}
    />
  );
});
Textarea.displayName = "Textarea";

interface SelectProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  id?: string;
  name?: string;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>((props, ref) => {
  const { label, error, hint, required, id, options, placeholder, ...rest } = props;
  const selectId = id ?? (props as { name?: string }).name;
  if (label) {
    return (
      <FormField label={label} error={error} hint={hint} required={required} id={selectId ?? ""}>
        <select ref={ref} className={(props.className ?? "") as string} {...rest}>
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </FormField>
    );
  }
  return (
    <select
      ref={ref}
      id={selectId ?? ""}
      className={`input ${(props.className ?? "") as string} ${error ? "input-error" : ""}`}
      {...rest}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
});
Select.displayName = "Select";

interface CheckboxProps {
  label: string;
  hint?: string;
  className?: string;
  id?: string;
  name?: string;
  checked?: boolean;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>((props, ref) => {
  const { label, hint, ...rest } = props;
  const id = (props as { id?: string; name?: string }).id ?? (props as { name?: string }).name;
  return (
    <label className="flex items-start gap-3 cursor-pointer" htmlFor={id}>
      <input
        ref={ref}
        type="checkbox"
        id={id}
        className={`mt-0.5 h-4 w-4 rounded-sm border-line-strong text-primary focus:ring-primary-ring ${(props.className ?? "") as string}`}
        {...rest}
      />
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-900">{label}</span>
        {hint && <span className="text-xs text-gray-500">{hint}</span>}
      </div>
    </label>
  );
});
Checkbox.displayName = "Checkbox";
