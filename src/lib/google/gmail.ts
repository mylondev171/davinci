import { google } from 'googleapis'
import { getGoogleClient } from './auth'

export async function searchEmailThreads(orgId: string, userId: string, query: string, maxResults = 20) {
  const auth = await getGoogleClient(orgId, userId)
  const gmail = google.gmail({ version: 'v1', auth })

  const { data } = await gmail.users.threads.list({
    userId: 'me',
    q: query,
    maxResults,
  })

  if (!data.threads || data.threads.length === 0) return []

  const threads = await Promise.all(
    data.threads.slice(0, 10).map(async (t) => {
      const { data: thread } = await gmail.users.threads.get({
        userId: 'me',
        id: t.id!,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'To', 'Date'],
      })
      return thread
    })
  )

  return threads.map((t) => ({
    id: t.id,
    snippet: t.snippet,
    historyId: t.historyId,
    messages: t.messages?.map((m) => ({
      id: m.id,
      subject: m.payload?.headers?.find((h) => h.name === 'Subject')?.value,
      from: m.payload?.headers?.find((h) => h.name === 'From')?.value,
      to: m.payload?.headers?.find((h) => h.name === 'To')?.value,
      date: m.payload?.headers?.find((h) => h.name === 'Date')?.value,
      snippet: m.snippet,
    })),
  }))
}

export async function getThreadMessages(orgId: string, userId: string, threadId: string) {
  const auth = await getGoogleClient(orgId, userId)
  const gmail = google.gmail({ version: 'v1', auth })

  const { data } = await gmail.users.threads.get({
    userId: 'me',
    id: threadId,
    format: 'full',
  })

  return {
    id: data.id,
    messages: data.messages?.map((m) => {
      const headers = m.payload?.headers || []
      const getHeader = (name: string) => headers.find((h) => h.name === name)?.value

      // Extract plain text body
      let body = ''
      const extractBody = (part: typeof m.payload): string => {
        if (part?.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8')
        }
        if (part?.parts) {
          for (const p of part.parts) {
            const text = extractBody(p)
            if (text) return text
          }
        }
        return ''
      }
      body = extractBody(m.payload)

      return {
        id: m.id,
        subject: getHeader('Subject'),
        from: getHeader('From'),
        to: getHeader('To'),
        date: getHeader('Date'),
        body: body.substring(0, 2000), // Limit for AI context
      }
    }),
  }
}
