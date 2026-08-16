import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import useIsMobile from '../hooks/isMobile'

export type WorkflowStep = {
  id: string
  label: string
  description?: string
}

interface WorkflowStepperProps {
  steps: WorkflowStep[]
  activeIndex: number
  carouselIndex?: number
  visibleCount?: number
  showNavigation?: boolean
  onPrevious?: () => void
  onNext?: () => void
  className?: string
}

export default function WorkflowStepper({
  steps,
  activeIndex,
  carouselIndex = 0,
  visibleCount = 3,
  showNavigation = false,
  onPrevious,
  onNext,
  className = '',
}: WorkflowStepperProps) {
  if (useIsMobile()) {
    visibleCount = 2;
  }else {
    visibleCount = 3;
  }
  
  const safeVisibleCount = Math.min(visibleCount, steps.length || 1)
  const maxCarouselIndex = Math.max(0, steps.length - safeVisibleCount)
  const normalizedCarouselIndex = Math.min(Math.max(carouselIndex, 0), maxCarouselIndex)
  const isMobile = useIsMobile();


  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-2 shadow-sm sm:p-4 ${className}`}>
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="step-viewport flex-1 overflow-hidden">
          <div
            className="step-track flex transition-transform duration-450 ease-[cubic-bezier(0.4,0,0.2,1)] will-change-transform"
            style={{ transform: `translateX(-${normalizedCarouselIndex * (100 / safeVisibleCount)}%)` }}
          >
            {steps.map((step, index) => {
              const isCompleted = index < activeIndex
              const isActive = index === activeIndex

              return (
                <div
                  key={step.id}
                  className={`step-item flex items-center gap-2 px-1 sm:px-2 ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isMobile ? 'p-2' : 'p-1.5'}`
                    }
                  style={{ flex: `0 0 ${100 / safeVisibleCount}%`, opacity: isActive ? 1 : isCompleted ? 0.75 : 0.45, transform: isActive ? 'scale(1)' : 'scale(0.96)' }}
                >
                  <div
                    className={`step-circle flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] sm:h-10 sm:w-10 ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md ring-4 ring-indigo-100'
                        : isCompleted
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-200 text-slate-500'
                    }`}
                    style={isActive ? { transform: 'scale(1.08)' } : undefined}
                  >
                    {isCompleted ? <Check size={16} /> : index + 1}
                  </div>

                  <div className="step-content min-w-0 flex-1">
                    <div className="truncate text-[10px] font-semibold sm:text-xs">{step.label}</div>
                    {step.description && (
                      <div className="truncate text-[9px] text-slate-500 sm:text-[10px]">{step.description}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
