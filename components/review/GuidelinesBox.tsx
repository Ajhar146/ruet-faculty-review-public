// The rules in full, on the page, not a link to somewhere else. Someone
// about to write is the only person who will ever read them.
export function GuidelinesBox({ className = '' }: { className?: string }) {
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Review guidelines"
      className={`max-h-64 overflow-y-auto rounded-card border border-line bg-mist p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink md:p-6 ${className}`}
    >
      <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-ink">
        <p className="font-medium">Write about the teaching and the course.</p>

        <p>
          You can write about: lecture quality, how clearly things were explained,
          exam difficulty, workload, fairness in marking, how the class was run.
        </p>

        <p>
          Do not write about: personal life, appearance, religion, family, phone
          numbers or addresses, accusations of crime or misconduct, anything you
          did not experience yourself.
        </p>
      </div>
    </div>
  )
}
