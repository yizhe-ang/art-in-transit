import { cn } from "@/lib/utils"

const Steps = () => {
  return (
    <div>
      <Step id="step-1" className="h-[200vh]"></Step>
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
