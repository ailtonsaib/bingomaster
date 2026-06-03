import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const letterMap = {
  B: [1, 15],
  I: [16, 30],
  N: [31, 45],
  G: [46, 60],
  O: [61, 75],
};

function getLetterForNumber(num) {
  for (const [letter, [min, max]] of Object.entries(letterMap)) {
    if (num >= min && num <= max) return letter;
  }
  return "";
}

const letterColors = {
  B: "from-violet-500 to-purple-600",
  I: "from-blue-500 to-indigo-600",
  N: "from-emerald-500 to-green-600",
  G: "from-amber-500 to-yellow-600",
  O: "from-rose-500 to-red-600",
};

export default function BingoNumberBall({ number, size = "md", animated = false, isDrawn = false, minimal = false }) {
  const letter = getLetterForNumber(number);
  const gradient = letterColors[letter] || "from-gray-500 to-gray-600";

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