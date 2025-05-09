import * as React from "react"
import { cn } from "../../lib/utils"

interface TypographyProps extends React.HTMLAttributes<HTMLElement> {
  variant?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "small" | "lead"
  color?: "default" | "primary" | "secondary" | "success" | "danger" | "warning"
}

const variantClasses = {
  h1: "scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl",
  h2: "scroll-m-20 text-3xl font-semibold tracking-tight",
  h3: "scroll-m-20 text-2xl font-semibold tracking-tight",
  h4: "scroll-m-20 text-xl font-semibold tracking-tight",
  h5: "scroll-m-20 text-lg font-semibold tracking-tight",
  h6: "scroll-m-20 text-base font-semibold tracking-tight",
  p: "leading-7",
  small: "text-sm font-medium leading-none",
  lead: "text-xl text-muted-foreground"
}

const colorClasses = {
  default: "text-foreground",
  primary: "text-primary",
  secondary: "text-muted-foreground",
  success: "text-green-600 dark:text-green-500",
  danger: "text-red-600 dark:text-red-500",
  warning: "text-yellow-600 dark:text-yellow-500"
}

const Typography = React.forwardRef<HTMLElement, TypographyProps>(
  ({ className, variant = "p", color = "default", children, ...props }, ref) => {
    const Component = variant === "small" ? "span" : variant

    return React.createElement(
      Component,
      {
        className: cn(variantClasses[variant], colorClasses[color], className),
        ref,
        ...props
      },
      children
    )
  }
)

Typography.displayName = "Typography"

export { Typography } 