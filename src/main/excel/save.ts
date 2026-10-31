// The only part of the Excel code that touches Electron: native dialogs and
// the file write. Default folder, file names and dialog titles follow v1.
import { BrowserWindow, dialog } from 'electron';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Workbook } from 'exceljs';
import type { SaveFileResult } from '@shared/types';

const FILTERS = [
  { name: 'Excel Files', extensions: ['xlsx'] },
  { name: 'All Files', extensions: ['*'] },
];

export async function saveWorkbook(workbook: Workbook, title: string, fileName: string): Promise<SaveFileResult> {
  const options = {
    title,
    defaultPath: path.join(os.homedir(), 'Downloads', fileName),
    filters: FILTERS,
  };
  const parent = BrowserWindow.getFocusedWindow();
  const result = parent ? await dialog.showSaveDialog(parent, options) : await dialog.showSaveDialog(options);
  if (result.canceled || !result.filePath) return { saved: false };
  await workbook.xlsx.writeFile(result.filePath);
  return { saved: true, filePath: result.filePath };
}

export async function pickOfficialsFile(): Promise<string | null> {
  const options = {
    title: 'Izberi Excel datoteko',
    filters: [{ name: 'Excel datoteke', extensions: ['xlsx'] }],
    properties: ['openFile' as const],
  };
  const parent = BrowserWindow.getFocusedWindow();
  const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);
  return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
}
