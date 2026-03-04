import { google } from 'googleapis'
import { getGoogleClient } from './auth'

export async function readDocContent(orgId: string, userId: string, docId: string): Promise<string> {
  const auth = await getGoogleClient(orgId, userId)
  const docs = google.docs({ version: 'v1', auth })

  const { data } = await docs.documents.get({ documentId: docId })

  // Extract plain text from document
  let text = ''
  if (data.body?.content) {
    for (const element of data.body.content) {
      if (element.paragraph?.elements) {
        for (const el of element.paragraph.elements) {
          if (el.textRun?.content) {
            text += el.textRun.content
          }
        }
      }
    }
  }

  return text.substring(0, 10000) // Limit for AI context
}
