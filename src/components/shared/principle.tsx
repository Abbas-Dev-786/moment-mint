function Principle({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
      <div className="grid gap-1">
        <strong className="text-sm font-medium">{title}</strong>
        <span className="text-sm leading-5 text-muted-foreground">{text}</span>
      </div>
    </div>
  )
}

export { Principle }
