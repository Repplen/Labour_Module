const { hasModulePermission } = require("../services/permissionResolver.service");
const { isAdminRequester } = require("../services/checklistWorkflow.service");
const { normalizeText } = require("../helpers/checklistTransfer.helper");
const {
  CHECKLIST_TRANSFER_REQUEST_ACTIONS,
  applyPermanentTransferContext,
  applyTemporaryTransferContext,
  createChecklistTransferApprovalRequest,
  getChecklistTransferHistoryRows,
  getChecklistTransferSetup,
  getPendingTransferRequestConflict,
  loadPermanentTransferContext,
  loadTemporaryTransferContext,
} = require("../services/checklistTransfer.service");

const canViewChecklistTransfer = (user) =>
  hasModulePermission(user?.permissions, "checklist_transfer", "view");

const isMainAdminReviewer = (user) =>
  Boolean(user?.isDefaultAdmin) ||
  normalizeText(user?.roleKey).toLowerCase() === "main_admin";

const canBypassChecklistAdminApproval = (user) =>
  isAdminRequester(user) && isMainAdminReviewer(user);

exports.getChecklistTransferChecklists = async (req, res) => {
  try {
    if (!canViewChecklistTransfer(req.user)) {
      return res.status(403).json({ message: "Checklist Transfer access is required" });
    }

    const result = await getChecklistTransferSetup({
      fromEmployeeId: req.query.fromEmployeeId,
      requesterAccess: req.access,
    });

    if (result?.message) {
      return res.status(result.status || 400).json({ message: result.message });
    }

    return res.json(result.payload);
  } catch (err) {
    console.error("GET CHECKLIST TRANSFER CHECKLISTS ERROR:", err);
    return res.status(500).json({ message: "Failed to load employee checklist masters" });
  }
};

exports.createPermanentChecklistTransfer = async (req, res) => {
  try {
    if (!hasModulePermission(req.user?.permissions, "checklist_transfer", "transfer")) {
      return res.status(403).json({ message: "Checklist Transfer permission is required" });
    }

    const transferContext = await loadPermanentTransferContext({
      body: req.body,
      requesterAccess: req.access,
    });

    if (transferContext?.message) {
      return res
        .status(transferContext.status || 400)
        .json({ message: transferContext.message });
    }

    if (!canBypassChecklistAdminApproval(req.user)) {
      const pendingTransferConflict = await getPendingTransferRequestConflict(
        transferContext.payload?.checklistObjectIds
      );

      if (pendingTransferConflict) {
        return res.status(409).json({
          message:
            "A pending admin approval transfer request already exists for one or more selected checklists",
        });
      }

      const request = await createChecklistTransferApprovalRequest({
        requester: req.user,
        actionType: CHECKLIST_TRANSFER_REQUEST_ACTIONS.permanentTransfer,
        transferType: "permanent",
        fromEmployee: transferContext.payload.fromEmployee,
        toEmployee: transferContext.payload.toEmployee,
        selectedChecklists: transferContext.payload.selectedChecklists,
        siteIds: transferContext.payload.siteIds,
      });

      return res.json({
        message: "Checklist transfer saved as Pending Admin Approval",
        request,
      });
    }

    const transferResult = await applyPermanentTransferContext({
      actorUser: req.user,
      context: transferContext.payload,
    });

    return res.json({
      message: "Checklist transfer completed successfully",
      transferredCount: transferResult.transferredCount,
      updatedTaskCount: transferResult.updatedTaskCount,
      fromEmployee: transferResult.fromEmployee,
      toEmployee: transferResult.toEmployee,
      history: transferResult.history,
    });
  } catch (err) {
    console.error("CREATE PERMANENT CHECKLIST TRANSFER ERROR:", err);
    return res.status(500).json({ message: "Failed to transfer selected checklists" });
  }
};

exports.createTemporaryChecklistTransfer = async (req, res) => {
  try {
    if (!hasModulePermission(req.user?.permissions, "checklist_transfer", "transfer")) {
      return res.status(403).json({ message: "Checklist Transfer permission is required" });
    }

    const transferContext = await loadTemporaryTransferContext({
      body: req.body,
      requesterAccess: req.access,
    });

    if (transferContext?.message) {
      return res
        .status(transferContext.status || 400)
        .json({ message: transferContext.message });
    }

    if (!canBypassChecklistAdminApproval(req.user)) {
      const pendingTransferConflict = await getPendingTransferRequestConflict(
        transferContext.payload?.checklistObjectIds
      );

      if (pendingTransferConflict) {
        return res.status(409).json({
          message:
            "A pending admin approval transfer request already exists for one or more selected checklists",
        });
      }

      const request = await createChecklistTransferApprovalRequest({
        requester: req.user,
        actionType: CHECKLIST_TRANSFER_REQUEST_ACTIONS.temporaryTransfer,
        transferType: "temporary",
        fromEmployee: transferContext.payload.fromEmployee,
        toEmployee: transferContext.payload.toEmployee,
        selectedChecklists: transferContext.payload.selectedChecklists,
        transferStartDate: transferContext.payload.transferStartDate,
        transferEndDate: transferContext.payload.transferEndDate,
        siteIds: transferContext.payload.siteIds,
      });

      return res.json({
        message: "Temporary checklist transfer saved as Pending Admin Approval",
        request,
      });
    }

    const transferResult = await applyTemporaryTransferContext({
      actorUser: req.user,
      context: transferContext.payload,
    });

    return res.json({
      message: "Temporary checklist transfer saved successfully",
      transferType: "temporary",
      transferStatus: transferResult.transferStatus,
      transferredCount: transferResult.transferredCount,
      fromEmployee: transferResult.fromEmployee,
      toEmployee: transferResult.toEmployee,
      history: transferResult.history,
    });
  } catch (err) {
    console.error("CREATE TEMPORARY CHECKLIST TRANSFER ERROR:", err);
    return res.status(500).json({ message: "Failed to save temporary checklist transfer" });
  }
};

exports.getChecklistTransferHistory = async (req, res) => {
  try {
    if (!canViewChecklistTransfer(req.user)) {
      return res.status(403).json({ message: "Checklist Transfer access is required" });
    }

    const historyRows = await getChecklistTransferHistoryRows({
      requesterAccess: req.access,
      limit: req.query.limit,
    });

    return res.json(historyRows);
  } catch (err) {
    console.error("GET CHECKLIST TRANSFER HISTORY ERROR:", err);
    return res.status(500).json({ message: "Failed to load checklist transfer history" });
  }
};
