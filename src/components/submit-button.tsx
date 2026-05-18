"use client";

import { ReactNode } from "react";
import { useFormStatus } from "react-dom";

type Props = Omit<React.ComponentProps<"button">, "children"> & {
  children: ReactNode;
  pendingLabel?: ReactNode;
};

export function SubmitButton({
  children,
  pendingLabel,
  className,
  ...rest
}: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      {...rest}
      disabled={pending || rest.disabled}
      aria-busy={pending || undefined}
      className={`press disabled:cursor-wait disabled:opacity-60 ${className ?? ""}`}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
