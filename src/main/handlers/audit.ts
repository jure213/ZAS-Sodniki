import { auditQuery } from '@shared/schemas';
import * as audit from '../db/audit.repo';
import { handle } from '../ipc/handle';

// Admin only: the database grants SELECT on audit_log to administrators alone,
// so anyone else gets FORBIDDEN. Nothing here can write to the log.
export function registerAuditHandlers(): void {
  handle('audit:list', auditQuery, (query) => audit.listAudit(query));
}
