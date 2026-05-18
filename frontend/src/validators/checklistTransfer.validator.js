export const initialTransferFormState = {
  fromEmployeeId: "",
  toEmployeeId: "",
  fromDate: "",
  toDate: "",
};

const hasSelectedToEmployee = (toEmployeeOptions = [], toEmployeeId = "") =>
  toEmployeeOptions.some((employee) => String(employee._id) === String(toEmployeeId));

export const validatePermanentTransfer = ({
  form,
  selectedChecklistIds,
  toEmployeeOptions,
}) => {
  if (!form.fromEmployeeId) {
    return "Select a From Employee before loading checklist masters.";
  }

  if (!form.toEmployeeId) {
    return "Select a To Employee for the permanent transfer.";
  }

  if (String(form.fromEmployeeId) === String(form.toEmployeeId)) {
    return "From Employee and To Employee cannot be the same.";
  }

  if (!hasSelectedToEmployee(toEmployeeOptions, form.toEmployeeId)) {
    return "To Employee must be selected from the filtered same Site and Department employee list.";
  }

  if (!selectedChecklistIds.length) {
    return "Select at least one checklist to transfer permanently.";
  }

  return "";
};

export const validateTemporaryTransfer = ({
  form,
  selectedChecklistIds,
  toEmployeeOptions,
}) => {
  if (!form.fromEmployeeId) {
    return "Select a From Employee before loading checklist masters.";
  }

  if (!form.toEmployeeId) {
    return "Select a To Employee for the temporary transfer.";
  }

  if (String(form.fromEmployeeId) === String(form.toEmployeeId)) {
    return "From Employee and To Employee cannot be the same.";
  }

  if (!hasSelectedToEmployee(toEmployeeOptions, form.toEmployeeId)) {
    return "To Employee must be selected from the filtered same Site and Department employee list.";
  }

  if (!form.fromDate || !form.toDate) {
    return "Select From Date and To Date for the temporary transfer.";
  }

  if (form.fromDate > form.toDate) {
    return "From Date must be less than or equal to To Date.";
  }

  if (!selectedChecklistIds.length) {
    return "Select at least one checklist to transfer temporarily.";
  }

  return "";
};

export const buildTransferConfirmationMessage = ({
  transferType,
  count,
  fromEmployeeLabel,
  toEmployeeLabel,
  fromDate,
  toDate,
  requiresApproval = false,
}) =>
  [
    `${
      transferType === "temporary" ? "Temporarily" : "Permanently"
    } transfer ${count} checklist${count === 1 ? "" : "s"}?`,
    "",
    `From Employee: ${fromEmployeeLabel}`,
    `To Employee: ${toEmployeeLabel}`,
    ...(transferType === "temporary"
      ? [`From Date: ${fromDate || "-"}`, `To Date: ${toDate || "-"}`]
      : []),
    "",
    requiresApproval
      ? transferType === "temporary"
        ? "This will submit a temporary transfer request for admin approval. No checklist assignment will change until that approval is completed."
        : "This will submit a permanent transfer request for admin approval. No checklist assignment will change until that approval is completed."
      : transferType === "temporary"
      ? "This will temporarily move the selected checklist masters and their active checklist tasks for the selected date range, then automatically revert them to the original employee."
      : "This will update the checklist master assignment, move the selected checklist tasks to the new employee, and save transfer history.",
  ].join("\n");
