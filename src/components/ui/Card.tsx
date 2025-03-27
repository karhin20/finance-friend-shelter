
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  glassmorphism?: boolean;
}

export function Card({
  children,
  className,
  glassmorphism = false,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow-sm transition-all duration-200",
        glassmorphism && "bg-white/80 backdrop-blur-md border-white/20",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode;
  className?: string;
}

export function CardTitle({ children, className, ...props }: CardTitleProps) {
  return (
    <h3
      className={cn("text-lg font-semibold leading-none tracking-tight", className)}
      {...props}
    >
      {children}
    </h3>
  );
}

interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode;
  className?: string;
}

export function CardDescription({
  children,
  className,
  ...props
}: CardDescriptionProps) {
  return (
    <p
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    >
      {children}
    </p>
  );
}

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className, ...props }: CardContentProps) {
  return (
    <div className={cn("p-6 pt-0", className)} {...props}>
      {children}
    </div>
  );
}

interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className, ...props }: CardFooterProps) {
  return (
    <div
      className={cn("flex items-center p-6 pt-0", className)}
      {...props}
    >
      {children}
    </div>
  );
}
