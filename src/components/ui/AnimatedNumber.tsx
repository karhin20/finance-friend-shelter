import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
    value: number;
    formatFn?: (value: number) => string;
    duration?: number;
    className?: string;
}

export const AnimatedNumber = ({
    value,
    formatFn = (v) => v.toFixed(2),
    duration = 500,
    className = '',
}: AnimatedNumberProps) => {
    const [displayValue, setDisplayValue] = useState(value);
    const previousValue = useRef(value);
    const animationRef = useRef<number | null>(null);

    useEffect(() => {
        const startValue = previousValue.current;
        const endValue = value;
        const startTime = performance.now();

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function (ease-out cubic)
            const easeOut = 1 - Math.pow(1 - progress, 3);

            const currentValue = startValue + (endValue - startValue) * easeOut;
            setDisplayValue(currentValue);

            if (progress < 1) {
                animationRef.current = requestAnimationFrame(animate);
            } else {
                setDisplayValue(endValue);
                previousValue.current = endValue;
            }
        };

        // Cancel any existing animation
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
        }

        animationRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [value, duration]);

    return <span className={className}>{formatFn(displayValue)}</span>;
};

export default AnimatedNumber;
