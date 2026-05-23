import { cn } from "@/lib/utils"
import { useStore } from "@/store"

const Steps = () => {
  const isMapInteractionUnlocked = useStore(
    (state) => state.isMapInteractionUnlocked
  )

  return (
    <div
      aria-hidden={isMapInteractionUnlocked}
      className={isMapInteractionUnlocked ? "pointer-events-none" : undefined}
    >
      <Step id="step-1" className="h-[300vh]"></Step>
    </div>
  )
}

const Step = ({ className, children, ...props }) => {
  return (
    <div className={cn("h-[100vh]", className)} {...props}>
      {children}
    </div>
  )
}

export default Steps
