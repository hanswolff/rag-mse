interface AlertBoxProps {
  type: "error" | "success" | "warning";
  message: string | string[] | null | undefined;
  onDismiss?: () => void;
  className?: string;
}

const variantStyles = {
  error: "bg-red-100 border-red-400 text-red-700",
  success: "bg-green-100 border-green-400 text-green-700",
  warning: "bg-yellow-100 border-yellow-400 text-yellow-700",
};

const ariaConfig = {
  error: { role: "alert" as const, "aria-live": "assertive" as const },
  success: { role: "status" as const, "aria-live": "polite" as const },
  warning: { role: "status" as const, "aria-live": "polite" as const },
};

export function AlertBox({ type, message, onDismiss, className }: AlertBoxProps) {
  if (!message || (Array.isArray(message) && message.length === 0)) return null;

  return (
    <div
      className={`border px-4 py-3 rounded ${variantStyles[type]}${className ? ` ${className}` : ""}`}
      {...ariaConfig[type]}
    >
      {Array.isArray(message) ? (
        <ul className="list-disc list-inside">
          {message.map((msg, index) => (
            <li key={index}>{msg}</li>
          ))}
        </ul>
      ) : (
        message
      )}
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="ml-2 font-bold">
          ×
        </button>
      )}
    </div>
  );
}
