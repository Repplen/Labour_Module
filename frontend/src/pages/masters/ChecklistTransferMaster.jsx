import ChecklistTransferAlerts from "../../components/masters/checklistTransfer/ChecklistTransferAlerts";
import ChecklistTransferConfirmation from "../../components/masters/checklistTransfer/ChecklistTransferConfirmation";
import ChecklistTransferEmployeeForm from "../../components/masters/checklistTransfer/ChecklistTransferEmployeeForm";
import ChecklistTransferHeader from "../../components/masters/checklistTransfer/ChecklistTransferHeader";
import ChecklistTransferHistoryTable from "../../components/masters/checklistTransfer/ChecklistTransferHistoryTable";
import ChecklistTransferOptions from "../../components/masters/checklistTransfer/ChecklistTransferOptions";
import ChecklistTransferSelection from "../../components/masters/checklistTransfer/ChecklistTransferSelection";
import { useChecklistTransferMaster } from "../../hooks/checklistTransfer/useChecklistTransferMaster";

export default function ChecklistTransferMaster() {
  const transfer = useChecklistTransferMaster();

  return (
    <div className="container-fluid mt-4 mb-5">
      <ChecklistTransferHeader
        checklistsCount={transfer.checklists.length}
        historyCount={transfer.historyRows.length}
        selectedCount={transfer.selectedChecklistIds.length}
        transferIntroText={transfer.transferIntroText}
      />

      <ChecklistTransferOptions
        activeOption={transfer.activeOption}
        onOptionOpen={transfer.handleOptionOpen}
      />

      <ChecklistTransferAlerts
        canTransferChecklist={transfer.canTransferChecklist}
        error={transfer.error}
        success={transfer.success}
      />

      {transfer.isPermanentTransfer || transfer.isTemporaryTransfer ? (
        <>
          <ChecklistTransferEmployeeForm
            form={transfer.form}
            fromEmployeeDepartmentLabel={transfer.fromEmployeeDepartmentLabel}
            fromEmployeeSiteLabel={transfer.fromEmployeeSiteLabel}
            hasInvalidTemporaryDateRange={transfer.hasInvalidTemporaryDateRange}
            isTemporaryTransfer={transfer.isTemporaryTransfer}
            onEmployeeChange={transfer.handleEmployeeChange}
            pageLoading={transfer.pageLoading}
            selectedFromEmployee={transfer.selectedFromEmployee}
            selectedToEmployee={transfer.selectedToEmployee}
            sortedEmployees={transfer.sortedEmployees}
            submitting={transfer.submitting}
            toEmployeeOptions={transfer.toEmployeeOptions}
          />

          <ChecklistTransferSelection
            allChecklistIds={transfer.allChecklistIds}
            allChecklistsSelected={transfer.allChecklistsSelected}
            checklistLoading={transfer.checklistLoading}
            checklistOptions={transfer.checklistOptions}
            form={transfer.form}
            onClearSelectedChecklists={transfer.clearSelectedChecklists}
            onSelectAllChecklists={transfer.selectAllChecklists}
            selectedChecklistIds={transfer.selectedChecklistIds}
            setSelectedChecklistIds={transfer.setSelectedChecklistIds}
            submitting={transfer.submitting}
          />

          <ChecklistTransferConfirmation
            canTransferChecklist={transfer.canTransferChecklist}
            form={transfer.form}
            handlePermanentTransfer={transfer.handlePermanentTransfer}
            handleTemporaryTransfer={transfer.handleTemporaryTransfer}
            hasInvalidTemporaryDateRange={transfer.hasInvalidTemporaryDateRange}
            isTemporaryTransfer={transfer.isTemporaryTransfer}
            selectedChecklistIds={transfer.selectedChecklistIds}
            submitting={transfer.submitting}
            usesApprovalRequestFlow={transfer.usesApprovalRequestFlow}
          />
        </>
      ) : (
        <div className="soft-card mb-4">
          <div className="text-muted">
            Open <span className="fw-semibold">Permanent Transfer</span> or{" "}
            <span className="fw-semibold">Temporary Transfer</span> to choose
            the employees and the checklist masters you want to move.
          </div>
        </div>
      )}

      <ChecklistTransferHistoryTable
        historyLoading={transfer.historyLoading}
        historyRows={transfer.historyRows}
        pageLoading={transfer.pageLoading}
      />
    </div>
  );
}
