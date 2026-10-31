import {
  generatePaymentsInput,
  idInput,
  paymentFilterSchema,
  paymentUpdateInput,
  recordPaymentSchema,
} from '@shared/schemas';
import * as payments from '../db/payments.repo';
import { handle } from '../ipc/handle';

export function registerPaymentHandlers(): void {
  handle('payments:list', paymentFilterSchema.optional(), (filter) => payments.listPayments(filter));
  handle('payments:get', idInput, ({ id }) => payments.getPayment(id));
  handle('payments:generate', generatePaymentsInput, ({ competition_id, tariff }) =>
    payments.generatePayments(competition_id, tariff),
  );
  handle('payments:record', recordPaymentSchema, async (input) => ({
    transaction_id: await payments.recordPayment(input),
  }));
  handle('payments:deleteTransaction', idInput, async ({ id }) => {
    await payments.deleteTransaction(id);
    return null;
  });
  handle('payments:update', paymentUpdateInput, async ({ id, ...patch }) => {
    await payments.updatePayment(id, patch);
    return null;
  });
  handle('payments:delete', idInput, async ({ id }) => {
    await payments.deletePayment(id);
    return null;
  });
}
