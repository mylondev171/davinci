'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useOrg } from '@/providers/org-provider'
import { useRef, useEffect, useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, Sparkles, User, Loader2 } from 'lucide-react'

export default function ChatPage() {
  const { currentOrg } = useOrg()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')

  const transport = useMemo(
    () => new DefaultChatTransport({
      api: '/api/chat',
      headers: currentOrg?.id ? { 'x-org-id': currentOrg.id } : {},
    }),
    [currentOrg?.id]
  )

  const { messages, sendMessage, status } = useChat({ transport })

  const isLoading = status === 'streaming' || status === 'submitted'

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = () => {
    if (!input.trim() || isLoading) return
    sendMessage({ text: input })
    setInput('')
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">AI Assistant</h1>
        <p className="text-muted-foreground">Ask about clients, projects, emails, SEO data, and more</p>
      </div>

      {/* Messages */}
      <Card className="flex-1 border-border bg-card overflow-hidden">
        <ScrollArea className="h-full p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <div className="rounded-full bg-blue-600/10 p-4 mb-4">
                <Sparkles className="h-8 w-8 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How can I help?</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Ask me about any client, project, or campaign. I can pull data from your CRM, Gmail, Google Drive, SEMRush, and more.
              </p>
              <div className="flex flex-wrap gap-2 mt-6 max-w-lg justify-center">
                {[
                  "What's the status of all active clients?",
                  "Summarize recent emails from our top client",
                  "Show me overdue tasks across all projects",
                  "How are keyword rankings for example.com?",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="text-xs border border-border rounded-lg px-3 py-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <Avatar className="h-8 w-8 mt-1">
                      <AvatarFallback className="bg-blue-600 text-white">
                        <Sparkles className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-3 text-sm ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-accent text-foreground'
                    }`}
                  >
                    {message.parts?.map((part, i) => {
                      if (part.type === 'text') {
                        return (
                          <div key={i} className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                            {part.text}
                          </div>
                        )
                      }
                      if (part.type.startsWith('tool-')) {
                        return null
                      }
                      return null
                    })}
                  </div>
                  {message.role === 'user' && (
                    <Avatar className="h-8 w-8 mt-1">
                      <AvatarFallback className="bg-muted text-foreground">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-blue-600 text-white">
                      <Sparkles className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="rounded-lg bg-accent px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </Card>

      {/* Input */}
      <div className="mt-4 flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask about a client, project, or campaign..."
          className="min-h-[44px] max-h-32 resize-none"
          rows={1}
        />
        <Button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          size="icon"
          className="h-[44px] w-[44px]"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
