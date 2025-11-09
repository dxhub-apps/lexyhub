import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // Primary: black bg / white text (light) or white bg / black text (dark)
        default: "bg-primary text-primary-foreground hover:bg-secondary hover:text-secondary-foreground hover:border hover:border-foreground",
        // Accent: blue background / white text for key CTAs
        accent: "bg-accent text-accent-foreground hover:bg-accent/90",
        // Secondary: white background / black border
        secondary:
          "bg-secondary text-secondary-foreground border border-foreground hover:bg-primary hover:text-primary-foreground",
        // Destructive: red for warnings
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        // Outline: minimal border style
        outline:
          "border border-border bg-background hover:bg-muted hover:text-foreground",
        // Ghost: minimal style
        ghost: "hover:bg-muted hover:text-foreground",
        // Link: underline style
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-11 rounded-lg px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    // When loading is true, we need to wrap loader + children in a single element
    // to avoid React.Children.only errors when Button is used with asChild patterns
    const content = loading ? (
      <span className="inline-flex items-center">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {children}
      </span>
    ) : children;

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {content}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
