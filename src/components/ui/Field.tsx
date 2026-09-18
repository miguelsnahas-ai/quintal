import {
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  forwardRef,
} from "react";

// Shared field chrome: label above, 1px border, 2px accent focus ring
// offset 2px, no floating labels — per the design spec.
const fieldClassName =
  "w-full rounded-sm border border-neutral bg-primary px-3 py-2 text-sm text-ink outline-none transition-shadow duration-200 focus:border-transparent focus:ring-2 focus:ring-accent focus:ring-offset-2";

export function Label(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label {...props} className={`text-sm font-medium text-ink ${props.className ?? ""}`} />;
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => (
    <input ref={ref} className={`${fieldClassName} ${className}`} {...props} />
  ),
);
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className = "", ...props }, ref) => (
  <textarea ref={ref} className={`${fieldClassName} ${className}`} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = "", ...props }, ref) => (
    <select ref={ref} className={`${fieldClassName} ${className}`} {...props} />
  ),
);
Select.displayName = "Select";

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="text-sm text-red-600" role="alert">
      {children}
    </p>
  );
}
