import { cn } from "../../lib/utils"
import React from "react"

interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ className, label, ...props }, ref) => {
    return (
      <div className="flex">
        <input
          type="radio"
          className={cn(
            "shrink-0 mt-0.5 border-gray-200 rounded-full text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none dark:bg-gray-800 dark:border-gray-700 dark:checked:bg-blue-500 dark:checked:border-blue-500 dark:focus:ring-offset-gray-800",
            className
          )}
          ref={ref}
          {...props}
        />
        {label && (
          <label className="text-sm text-gray-500 ms-2 dark:text-gray-400">
            {label}
          </label>
        )}
      </div>
    )
  }
)

Radio.displayName = "Radio"

export { Radio } 