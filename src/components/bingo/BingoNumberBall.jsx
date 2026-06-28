import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useBrandName } from "@/hooks/useBrandName";
import { getLetterForNumber, getColumnIndex, COLUMN_GRADIENT } from "@/lib/brandConfig";

export default function BingoNumberBall({ number, size = "md", animated = false, isDrawn = false, minimal = false }) {
  const { brandName } = useBrandName();
  const letter = getLetterForNumber(number, brandName);
  const gradient = COLUMN_GRADIENT[getColumnIndex(number)] || "from-gray-500 to-gray-600";

  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-12 h-12 text-sm",
    lg: "w-16 h-16 text-lg",
    xl: "w-24 h-24 text-3xl",
  };

  if (minimal) {
    return (
      <div className={cn(
        "rounded-full flex items-center justify-center font-bold font-heading transition-all",
        sizeClasses[size],
        isDrawn
          ? `bg-gradient-to-br ${gradient} text-white shadow-lg`
          : "bg-muted text-muted-foreground"
      )}>
        {number}
      </div>
    );
  }

  const Wrapper = animated ? motion.div : "div";
  const animProps = animated
    ? {
        initial: { scale: 0, rotate: -180 },
        animate: { scale: 1, rotate: 0 },
        transition: { type: "spring", stiffness: 200, damping: 15 },
      }
    : {};

  return (
    <Wrapper
      {...animProps}
      className={cn(
        "rounded-full flex flex-col items-center justify-center font-bold font-heading",
        `bg-gradient-to-br ${gradient} text-white shadow-xl`,
        sizeClasses[size]
      )}
    >
      {size !== "sm" && <span className="text-[0.6em] opacity-80 leading-none">{letter}</span>}
      <span className="leading-none">{number}</span>
    </Wrapper>
  );
}