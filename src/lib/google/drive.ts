import { google } from 'googleapis'
import { getGoogleClient } from './auth'

export async function searchDriveFiles(orgId: string, userId: string, query?: string, maxResults = 20) {
  const auth = await getGoogleClient(orgId, userId)
  const drive = google.drive({ version: 'v3', auth })

  let q = "trashed = false"
  if (query) {
    q += ` and name contains '${query.replace(/'/g, "\\'")}'`
  }

  const { data } = await drive.files.list({
    q,
    pageSize: maxResults,
    fields: 'files(id, name, mimeType, webViewLink, thumbnailLink, modifiedTime, owners)',
    orderBy: 'modifiedTime desc',
  })

  return data.files || []
}

export async function getDriveFile(orgId: string, userId: string, fileId: string) {
  const auth = await getGoogleClient(orgId, userId)
  const drive = google.drive({ version: 'v3', auth })

  const { data } = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, webViewLink, thumbnailLink, modifiedTime, description',
  })

  return data
}
