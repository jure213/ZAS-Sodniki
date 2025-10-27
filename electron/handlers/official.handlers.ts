import { ipcMain, dialog } from 'electron';
import * as XLSX from 'xlsx';
import * as fs from 'fs';

export function setupOfficialHandlers(db: any) {
  ipcMain.handle('official:list', async () => {
    return await db.listOfficials();
  });

  ipcMain.handle('official:create', async (_event, data: { name: string; email: string; phone: string; license_number: string; active?: number }) => {
    const id = await db.addOfficial(data);
    return { ok: id > 0, id };
  });

  ipcMain.handle('official:update', async (_event, { id, data }: { id: number; data: { name: string; email: string; phone: string; license_number: string; active: number } }) => {
    const success = await db.updateOfficial(id, data);
    return { ok: success };
  });

  ipcMain.handle('official:delete', async (_event, id: number) => {
    const success = await db.deleteOfficial(id);
    return { ok: success };
  });

  ipcMain.handle('official:setActive', async (_event, { id, active }: { id: number; active: number }) => {
    const success = await db.setOfficialActive(id, active);
    return { ok: success };
  });

  ipcMain.handle('official:importExcel', async (_event) => {
    try {
      // Open file picker dialog
      const result = await dialog.showOpenDialog({
        title: 'Izberi Excel datoteko',
        filters: [
          { name: 'Excel datoteke', extensions: ['xlsx', 'xls', 'csv'] }
        ],
        properties: ['openFile']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { ok: false, message: 'Uporabnik je preklical izbor' };
      }

      const filePath = result.filePaths[0];
      
      // Read the Excel file
      const fileBuffer = fs.readFileSync(filePath);
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      
      // Get the first sheet
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON (array of objects)
      const data = XLSX.utils.sheet_to_json(worksheet) as any[];
      
      if (!data || data.length === 0) {
        return { ok: false, message: 'Excel datoteka je prazna' };
      }

      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      // Process each row
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        
        // Expected columns: Name, Email, Phone, License Number (or similar variations)
        // Try to match different possible column names
        const name = row['Name'] || row['Ime'] || row['name'] || row['ime'] || '';
        const email = row['Email'] || row['E-mail'] || row['email'] || row['e-mail'] || '';
        const phone = row['Phone'] || row['Telefon'] || row['phone'] || row['telefon'] || '';
        const license = row['License Number'] || row['License'] || row['Licenca'] || row['license_number'] || row['licenca'] || '';

        // Validate required fields
        if (!name || name.toString().trim() === '') {
          errors.push(`Vrstica ${i + 2}: Manjka ime`);
          skipped++;
          continue;
        }

        try {
          // Check if official already exists (by name)
          const existingOfficials = await db.listOfficials();
          const existing = existingOfficials.find((o: any) => 
            o.name.toLowerCase().trim() === name.toString().toLowerCase().trim()
          );

          if (existing) {
            skipped++;
            continue;
          }

          // Add the official
          const id = await db.addOfficial({
            name: name.toString().trim(),
            email: email ? email.toString().trim() : '',
            phone: phone ? phone.toString().trim() : '',
            license_number: license ? license.toString().trim() : '',
            active: 1
          });

          if (id > 0) {
            imported++;
          } else {
            errors.push(`Vrstica ${i + 2}: Napaka pri dodajanju ${name}`);
            skipped++;
          }
        } catch (err) {
          errors.push(`Vrstica ${i + 2}: ${String(err)}`);
          skipped++;
        }
      }

      return {
        ok: true,
        imported,
        skipped,
        total: data.length,
        errors: errors.length > 0 ? errors.slice(0, 10) : [] // Return max 10 errors
      };

    } catch (error) {
      return {
        ok: false,
        message: `Napaka pri branju datoteke: ${String(error)}`
      };
    }
  });
}
