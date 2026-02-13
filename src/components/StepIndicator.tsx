'use client';

interface Step {
    label: string;
}

interface StepIndicatorProps {
    steps: Step[];
    currentStep: number; // 1-indexed
}

export default function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
    return (
        <div className="steps" role="list" aria-label="Registration progress">
            {steps.map((step, index) => {
                const stepNum = index + 1;
                const isDone = stepNum < currentStep;
                const isActive = stepNum === currentStep;
                const className = `step ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`.trim();

                return (
                    <div key={stepNum} className={className} role="listitem" aria-current={isActive ? 'step' : undefined}>
                        <div className="step-number" aria-hidden="true">{stepNum}</div>
                        <span className="step-label">{step.label}</span>
                    </div>
                );
            })}
        </div>
    );
}
