export default function ConversationLoading() {
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 max-w-5xl mx-auto w-full animate-pulse">
      <div className="flex items-center gap-3 pb-2 border-b border-border">
        <div className="size-9 bg-muted rounded-lg" />
        <div className="space-y-1.5">
          <div className="h-5 w-40 bg-muted rounded-md" />
          <div className="h-3 w-56 bg-muted/60 rounded-md" />
        </div>
      </div>

      <div className="h-[650px] bg-card rounded-xl border border-border" />
    </div>
  );
}
