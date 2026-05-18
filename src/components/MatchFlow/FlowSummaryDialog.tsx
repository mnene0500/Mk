"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Sparkles, Loader2, RefreshCcw } from "lucide-react"
import { automatedConversationSummary } from "@/ai/flows/automated-conversation-summary"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface FlowSummaryDialogProps {
  conversationText: string
}

export function FlowSummaryDialog({ conversationText }: FlowSummaryDialogProps) {
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const generateSummary = async () => {
    if (!conversationText.trim()) return
    setLoading(true)
    try {
      const result = await automatedConversationSummary({ conversation: conversationText })
      setSummary(result.summary)
    } catch (error) {
      console.error("Failed to generate summary", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog onOpenChange={(open) => open && !summary && generateSummary()}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 border-primary/30 text-primary hover:bg-primary/10">
          <Sparkles className="h-4 w-4" />
          Flow Insights
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-card border-primary/20">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-primary/10 rounded-full">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle className="font-headline text-xl">Flow Insights</DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground">
            Intelligent AI synthesis of the current conversation flow.
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-4 min-h-[150px] relative">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <span className="text-sm font-medium animate-pulse">Analyzing conversation flow...</span>
            </div>
          ) : summary ? (
            <ScrollArea className="h-[250px] pr-4">
              <div className="p-4 bg-secondary/50 rounded-xl border border-white/5 leading-relaxed text-sm">
                {summary}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <p className="text-sm">No insights available for this conversation yet.</p>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-4">
          <Button 
            onClick={generateSummary} 
            disabled={loading}
            variant="ghost"
            className="gap-2"
          >
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
            Regenerate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
