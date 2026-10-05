export default function MessagesLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-48 bg-muted rounded-md" />
        <div className="h-4 w-96 bg-muted/60 rounded-md" />
      </div>

      <div className="h-20 bg-muted/40 rounded-xl border border-border" />

      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-card rounded-xl border border-border" />
        ))}
      </div>
    </div>
  );
}
