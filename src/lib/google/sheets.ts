import { google } from 'googleapis'
import { getGoogleClient } from './auth'

export async function readSpreadsheet(orgId: string, userId: string, spreadsheetId: string, range = 'A1:Z100') {
  const auth = await getGoogleClient(orgId, userId)
  const sheets = google.sheets({ version: 'v4', auth })

  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  })

  return {
    range: data.range,
    values: data.values || [],
  }
}

export async function writeSpreadsheet(
  orgId: string,
  userId: string,
  spreadsheetId: string,
  range: string,
  values: string[][]
) {
  const auth = await getGoogleClient(orgId, userId)
  const sheets = google.sheets({ version: 'v4', auth })

  const { data } = await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  })

  return data
}
